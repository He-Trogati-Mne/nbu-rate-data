import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = 'data';
await fs.mkdir(DATA_DIR, { recursive: true });

const UA = { 'User-Agent': 'nbu-rate-bot (https://github.com/He-Trogati-Mne/nbu-rate-data)' };

async function readJson(name) {
    try {
        const raw = await fs.readFile(path.join(DATA_DIR, name + '.json'), 'utf-8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function writeJson(name, data, extra = {}) {
    const payload = { updatedAt: new Date().toISOString(), ...extra, data };
    await fs.writeFile(path.join(DATA_DIR, name + '.json'), JSON.stringify(payload));
}

async function fetchJson(url, { retries = 4, baseDelay = 4000 } = {}) {
    let delay = baseDelay;
    for (let i = 0; i <= retries; i++) {
        try {
            const res = await fetch(url, { headers: UA });
            if (res.status === 429) {
                if (i === retries) return null;
                console.log(`    429 → wait ${(delay / 1000).toFixed(1)}s (${i + 1}/${retries})`);
                await new Promise(r => setTimeout(r, delay));
                delay *= 1.8;
                continue;
            }
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return await res.json();
        } catch (e) {
            if (i === retries) throw e;
            await new Promise(r => setTimeout(r, delay));
            delay *= 1.8;
        }
    }
    return null;
}

function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function isoToday() {
    return new Date().toISOString().slice(0, 10);
}

/* ─────────────── Fiat ─────────────── */

async function saveNBU() {
    const data = await fetchJson('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
    await writeJson('nbu', data);
    console.log(`nbu     : ${data.length} currencies`);
}

async function savePrivat() {
    const data = await fetchJson('https://api.privatbank.ua/p24api/pubinfo?exchange&json&coursid=11');
    await writeJson('privat', data);
    console.log(`privat  : ${data.length} rates`);
}

async function saveMono() {
    const data = await fetchJson('https://api.monobank.ua/bank/currency');
    await writeJson('mono', data);
    console.log(`mono    : ${data.length} rates`);
}

/* ─────────────── NBU history 2003 → now ─────────────── */

const NBU_HISTORY_CURRENCIES = [
    'USD','EUR','GBP','PLN','CNY','CHF','JPY','CAD','AUD','TRY',
    'SEK','NOK','DKK','CZK','HUF','RON','ILS','KRW','SGD','HKD',
    'NZD','MXN','INR','TND','EGP','DZD','AED','SAR','AZN','GEL',
    'KZT','MYR','THB','MDL','ZAR','RSD','XDR',
    'XAU','XAG','XPT','XPD'
];

const NBU_HISTORY_FIRST = '20030101';
const HISTORY_FORMAT_VERSION = 2;

// API НБУ возвращает rate вместе с полем units — количество единиц валюты,
// за которое указана цена. Для валют units обычно 100, для металлов 1.
// Универсально: цена за 1 единицу = rate / units.
function normalizeNBURate(code, rate, units) {
    if (rate == null) return null;
    const u = (Number.isFinite(Number(units)) && Number(units) > 0) ? Number(units) : 1;
    return Math.round((rate / u) * 10000) / 10000;
}

async function rebuildHistory() {
    console.log(`nbuhist : FULL REBUILD ${NBU_HISTORY_FIRST} → today`);
    const history = {};
    const end = isoToday().replace(/-/g, '');
    let totalPts = 0;

    for (const code of NBU_HISTORY_CURRENCIES) {
        const url = `https://bank.gov.ua/NBU_Exchange/exchange_site?start=${NBU_HISTORY_FIRST}&end=${end}&valcode=${code.toLowerCase()}&sort=exchangedate&order=asc&json`;
        try {
            const data = await fetchJson(url, { retries: 3, baseDelay: 5000 });
            if (!Array.isArray(data)) {
                console.log(`  ${code.padEnd(4)}: not an array`);
                continue;
            }
            let count = 0;
            for (const item of data) {
                const [d, m, y] = item.exchangedate.split('.');
                const iso = `${y}-${m}-${d}`;
                if (!history[iso]) history[iso] = {};
                const v = normalizeNBURate(code, item.rate, item.units);
                if (v != null) {
                    history[iso][code] = v;
                    count++;
                }
            }
            totalPts += count;
            console.log(`  ${code.padEnd(4)}: ${count} pts (sample: ${data[0]?.rate} / units ${data[0]?.units} → ${normalizeNBURate(code, data[0]?.rate, data[0]?.units)})`);
        } catch (e) {
            console.log(`  ${code.padEnd(4)}: FAIL ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 500));
    }

    const dates = Object.keys(history).sort();
    const first = dates[0];
    const last = dates[dates.length - 1];
    console.log(`nbuhist : rebuilt ${dates.length} dates (${first} → ${last}), ${totalPts} pts`);
    console.log(`nbuhist : USD ${first} = ${history[first]?.USD}, USD ${last} = ${history[last]?.USD}`);
    console.log(`nbuhist : XAU ${first} = ${history[first]?.XAU}, XAU ${last} = ${history[last]?.XAU}`);
    console.log(`nbuhist : XPD ${first} = ${history[first]?.XPD}, XPD ${last} = ${history[last]?.XPD}`);

    await writeJson('nbu-history', history, { formatVersion: HISTORY_FORMAT_VERSION });
    return history;
}

async function appendHistory(history) {
    const known = Object.keys(history).sort();
    const lastKnown = known[known.length - 1];

    const start = new Date(new Date(lastKnown).getTime() + 86400000)
        .toISOString().slice(0, 10).replace(/-/g, '');
    const end = isoToday().replace(/-/g, '');

    if (start > end) {
        console.log(`nbuhist : up to date (${known.length} dates, last ${lastKnown})`);
        return;
    }

    console.log(`nbuhist : appending ${start} → ${end} (have ${known.length} dates)`);
    let totalAdded = 0;

    for (const code of NBU_HISTORY_CURRENCIES) {
        const url = `https://bank.gov.ua/NBU_Exchange/exchange_site?start=${start}&end=${end}&valcode=${code.toLowerCase()}&sort=exchangedate&order=asc&json`;
        try {
            const data = await fetchJson(url, { retries: 2, baseDelay: 5000 });
            if (!Array.isArray(data)) continue;
            let count = 0;
            for (const item of data) {
                const [d, m, y] = item.exchangedate.split('.');
                const iso = `${y}-${m}-${d}`;
                if (!history[iso]) history[iso] = {};
                const v = normalizeNBURate(code, item.rate, item.units);
                if (v != null) {
                    history[iso][code] = v;
                    count++;
                }
            }
            totalAdded += count;
            console.log(`  ${code.padEnd(4)}: +${count}`);
        } catch (e) {
            console.log(`  ${code.padEnd(4)}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 400));
    }

    await writeJson('nbu-history', history, { formatVersion: HISTORY_FORMAT_VERSION });
    console.log(`nbuhist : saved ${Object.keys(history).length} dates (+${totalAdded} this run)`);
}

async function saveNBUHistory() {
    const existing = await readJson('nbu-history');
    const formatVersion = existing?.formatVersion || 1;
    const history = existing?.data || {};

    // Формат v1 (или отсутствует) — битые металлы и, возможно, валюты. Пересобираем.
    if (formatVersion < HISTORY_FORMAT_VERSION) {
        console.log(`nbuhist : format v${formatVersion} < v${HISTORY_FORMAT_VERSION} → full rebuild`);
        await rebuildHistory();
        return;
    }

    if (Object.keys(history).length === 0) {
        console.log('nbuhist : empty history → full rebuild');
        await rebuildHistory();
        return;
    }

    await appendHistory(history);
}

/* ─────────────── Kuna ─────────────── */

const KUNA_SYMBOLS = [
    'btcuah', 'ethuah', 'usdtuah', 'usdthuah', 'bnbuah',
    'soltuah', 'xrpuah', 'adauah', 'doge-uah', 'trxuah',
    'usdcuah', 'tonuah', 'linkuah', 'dotuah', 'ltcuah',
    'btcusdt', 'ethusdt', 'ethbtc', 'solusdt'
];

function normalizeKuna(raw) {
    const out = [];

    if (Array.isArray(raw)) {
        for (const row of raw) {
            if (Array.isArray(row) && row.length >= 2) {
                const [pair, last, low, high, vol, buy, sell] = row;
                out.push({
                    pair: String(pair),
                    last: num(last), low: num(low), high: num(high),
                    vol:  num(vol),  buy: num(buy), sell: num(sell)
                });
            } else if (row && typeof row === 'object') {
                const pair = row.symbol || row.pair || row.name;
                if (!pair) continue;
                out.push({
                    pair: String(pair),
                    last: num(row.last ?? row.price ?? row.lastPrice ?? row.close),
                    low:  num(row.low),
                    high: num(row.high),
                    vol:  num(row.vol ?? row.volume),
                    buy:  num(row.buy ?? row.bid),
                    sell: num(row.sell ?? row.ask)
                });
            }
        }
    } else if (raw && typeof raw === 'object') {
        for (const [pair, t] of Object.entries(raw)) {
            if (!t || typeof t !== 'object') continue;
            out.push({
                pair,
                last: num(t.last ?? t.price ?? t.last_price ?? t.close),
                low:  num(t.low ?? t.low_price),
                high: num(t.high ?? t.high_price),
                vol:  num(t.vol ?? t.volume ?? t.base_volume),
                buy:  num(t.buy ?? t.bid ?? t.bid_price),
                sell: num(t.sell ?? t.ask ?? t.ask_price)
            });
        }
    }

    return out.filter(p => p.last != null || p.buy != null || p.sell != null);
}

async function saveKuna() {
    const endpoints = [
        { url: `https://api.kuna.io/v3/tickers?symbols=${KUNA_SYMBOLS.join(',')}`, tag: 'v3+symbols' },
        { url: 'https://api.kuna.io/v3/tickers', tag: 'v3-full' },
        { url: 'https://api.kuna.io/v2/tickers', tag: 'v2-legacy' }
    ];

    const attempts = [];

    for (const { url, tag } of endpoints) {
        const started = Date.now();
        try {
            const res = await fetch(url, { headers: UA });
            const ms = Date.now() - started;
            const text = await res.text();

            let parsed = null;
            try { parsed = JSON.parse(text); } catch {}

            attempts.push({
                tag,
                status: res.status,
                ms,
                contentType: res.headers.get('content-type') || '',
                bodyPreview: text.slice(0, 300),
                parsedOk: parsed != null
            });

            console.log(`kuna    : ${tag} → HTTP ${res.status} (${ms}ms)`);

            if (!res.ok) continue;

            if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
                const keys = Object.keys(parsed);
                const isError = keys.length <= 3 && (parsed.messages || parsed.message || parsed.error);
                if (isError) {
                    console.log(`kuna    : ${tag} → API error: ${parsed.messages || parsed.message || parsed.error}`);
                    continue;
                }
            }

            if (Array.isArray(parsed) && parsed.length === 0) {
                console.log(`kuna    : ${tag} → empty array`);
                continue;
            }

            const normalized = normalizeKuna(parsed);
            if (normalized.length === 0) {
                console.log(`kuna    : ${tag} → got data but normalization produced 0 pairs`);
                console.log(`kuna    : sample: ${JSON.stringify(parsed).slice(0, 220)}`);
                await writeJson('kuna', parsed, { endpoint: tag, note: 'unnormalized', attempts });
                return;
            }

            await writeJson('kuna', normalized, { endpoint: tag });
            console.log(`kuna    : saved ${normalized.length} pairs via ${tag}`);
            return;
        } catch (e) {
            const ms = Date.now() - started;
            attempts.push({ tag, error: e.message, ms });
            console.log(`kuna    : ${tag} → ${e.message} (${ms}ms)`);
        }
    }

    console.log('kuna    : all endpoints failed, writing error snapshot');
    await writeJson('kuna', [], { error: 'all endpoints failed', attempts });
}

/* ─────────────── Whitebit (backup) ─────────────── */

async function saveWhitebit() {
    const data = await fetchJson('https://whitebit.com/api/v4/public/ticker');
    if (!data || typeof data !== 'object') throw new Error('empty response');

    const pairs = Object.entries(data)
        .filter(([pair]) => /_UAH$|_USDT$|_BTC$/.test(pair))
        .map(([pair, t]) => ({
            pair,
            last: num(t.last_price),
            buy:  num(t.bid),
            sell: num(t.ask),
            vol:  num(t.base_volume)
        }))
        .filter(p => p.last != null);

    await writeJson('whitebit', pairs);
    console.log(`whitebit: ${pairs.length} pairs`);
}

/* ─────────────── LiqPay ─────────────── */

async function saveLiqPay() {
    try {
        const data = await fetchJson('https://www.liqpay.ua/api/en/checkout/currency', { retries: 2, baseDelay: 3000 });
        if (!data || typeof data !== 'object') throw new Error('empty response');
        await writeJson('liqpay', data);
        console.log('liqpay  : ok');
    } catch (e) {
        const prev = await readJson('liqpay');
        if (prev) console.log(`liqpay  : ${e.message}, keeping previous snapshot`);
        else      console.log(`liqpay  : ${e.message}, no previous snapshot`);
    }
}

/* ─────────────── Crypto ─────────────── */

const COINS = [
    'bitcoin', 'ethereum', 'tether', 'binancecoin', 'solana',
    'usd-coin', 'ripple', 'cardano', 'dogecoin', 'avalanche-2',
    'tron', 'the-open-network', 'chainlink', 'polkadot', 'litecoin',
    'shiba-inu', 'dai', 'wrapped-bitcoin', 'uniswap', 'near',
    'aptos', 'arbitrum', 'optimism', 'sui', 'stellar'
];

const CC_SYMBOL = {
    'bitcoin':          'BTC',
    'ethereum':         'ETH',
    'tether':           'USDT',
    'binancecoin':      'BNB',
    'solana':           'SOL',
    'usd-coin':         'USDC',
    'ripple':           'XRP',
    'cardano':          'ADA',
    'dogecoin':         'DOGE',
    'avalanche-2':      'AVAX',
    'tron':             'TRX',
    'the-open-network': 'TON',
    'chainlink':        'LINK',
    'polkadot':         'DOT',
    'litecoin':         'LTC',
    'shiba-inu':        'SHIB',
    'dai':              'DAI',
    'wrapped-bitcoin':  'WBTC',
    'uniswap':          'UNI',
    'near':             'NEAR',
    'aptos':            'APT',
    'arbitrum':         'ARB',
    'optimism':         'OP',
    'sui':              'SUI',
    'stellar':          'XLM'
};

async function fetchDeepHistory(ccSymbol, existingHistory = {}) {
    const knownDates = Object.keys(existingHistory).sort();
    const oldestKnown = knownDates[0] || null;

    const result = {};
    let toTs = Math.floor(Date.now() / 1000);
    const stopTs = oldestKnown
        ? Math.floor(new Date(oldestKnown).getTime() / 1000)
        : 0;

    const MAX_PAGES = 8;

    for (let page = 0; page < MAX_PAGES; page++) {
        const url = `https://min-api.cryptocompare.com/data/v2/histoday` +
                    `?fsym=${ccSymbol}&tsym=USD&limit=2000&toTs=${toTs}`;
        let json;
        try {
            json = await fetchJson(url, { retries: 3, baseDelay: 5000 });
        } catch (e) {
            console.log(`    cc ${ccSymbol}: page ${page} → ${e.message}`);
            break;
        }
        const data = json?.Data?.Data;
        if (!Array.isArray(data) || data.length === 0) break;

        let oldest = null;
        for (const row of data) {
            if (row.time <= 0) continue;
            const iso = new Date(row.time * 1000).toISOString().slice(0, 10);
            const price = row.close;
            if (price > 0) {
                result[iso] = price;
                if (!oldest || row.time < oldest.time) oldest = row;
            }
        }

        if (!oldest) break;
        if (stopTs && oldest.time <= stopTs) break;
        if (data.length < 2000) break;

        toTs = oldest.time - 1;
        await new Promise(r => setTimeout(r, 400));
    }

    return result;
}

async function saveCrypto() {
    const existing = await readJson('crypto');
    const existingMap = {};
    (existing?.data?.coins || []).forEach(c => { existingMap[c.id] = c; });

    const today = isoToday();
    const historyFresh = existing?.historyDate === today;

    const marketsUrl =
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd` +
        `&ids=${COINS.join(',')}&sparkline=true&price_change_percentage=24h`;

    const markets = await fetchJson(marketsUrl);
    if (!Array.isArray(markets) || markets.length === 0) {
        throw new Error('markets response empty');
    }

    const coins = markets.map(m => {
        const sparkline = m.sparkline_in_7d?.price || [];
        const daily = {};
        const now = Date.now();
        sparkline.forEach((price, i) => {
            const hoursAgo = sparkline.length - 1 - i;
            const iso = new Date(now - hoursAgo * 3600000).toISOString().slice(0, 10);
            if (!daily[iso]) daily[iso] = [];
            daily[iso].push(price);
        });

        const history = {};
        Object.keys(daily).forEach(iso => {
            const arr = daily[iso];
            history[iso] = arr.reduce((a, b) => a + b, 0) / arr.length;
        });

        const prev = existingMap[m.id]?.history || {};
        const merged = { ...prev, ...history };

        return {
            id: m.id,
            symbol: (m.symbol || '').toUpperCase(),
            name: m.name,
            price: m.current_price,
            change24h: m.price_change_percentage_24h || 0,
            history: merged
        };
    });

    console.log(`crypto  : ${coins.length} coins, prices updated`);

    if (historyFresh) {
        console.log('crypto  : deep history already refreshed today, skipping');
    } else {
        for (const coin of coins) {
            const cc = CC_SYMBOL[coin.id];
            if (!cc) {
                console.log(`  ${coin.symbol.padEnd(6)}: no CC mapping, keeping ${Object.keys(coin.history).length} pts`);
                continue;
            }
            const before = Object.keys(coin.history).length;
            try {
                const deep = await fetchDeepHistory(cc, coin.history);
                const deepCount = Object.keys(deep).length;
                coin.history = { ...coin.history, ...deep };
                const after = Object.keys(coin.history).length;
                const first = Object.keys(coin.history).sort()[0] || '—';
                console.log(`  ${coin.symbol.padEnd(6)}: ${before} → ${after} pts (deep ${deepCount}, first ${first})`);
            } catch (e) {
                console.log(`  ${coin.symbol.padEnd(6)}: ${e.message}`);
            }
            await new Promise(r => setTimeout(r, 600));
        }
    }

    await writeJson('crypto', { coins }, { historyDate: today });
    console.log(`crypto  : saved ${coins.length} coins`);
}

/* ─────────────── Run ─────────────── */

console.log('Updating data...');

const tasks = [
    ['nbu',      saveNBU],
    ['privat',   savePrivat],
    ['mono',     saveMono],
    ['kuna',     saveKuna],
    ['whitebit', saveWhitebit],
    ['liqpay',   saveLiqPay]
];

const results = await Promise.allSettled(tasks.map(([, fn]) => fn()));
results.forEach((r, i) => {
    if (r.status === 'rejected') {
        console.error(`FAIL ${tasks[i][0]}: ${r.reason?.message}`);
    }
});

await saveNBUHistory().catch(e => console.error('FAIL nbu-history: ' + e.message));
await saveCrypto().catch(e => console.error('FAIL crypto: ' + e.message));

console.log('Done.');
