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
    await fs.writeFile(path.join(DATA_DIR, name + '.json'), JSON.stringify(payload, null, 2));
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

/* ─────────────── Kuna ─────────────── */

const KUNA_SYMBOLS = [
    'btcuah', 'ethuah', 'usdtuah', 'usdthuah', 'bnbuah',
    'soltuah', 'xrpuah', 'adauah', 'doge-uah', 'trxuah',
    'usdcuah', 'tonuah', 'linkuah', 'dotuah', 'ltcuah',
    'btcusdt', 'ethusdt', 'ethbtc', 'solusdt'
];

async function saveKuna() {
    const endpoints = [
        { url: `https://api.kuna.io/v3/tickers?symbols=${KUNA_SYMBOLS.join(',')}`, tag: 'v3+symbols' },
        { url: 'https://api.kuna.io/v3/tickers', tag: 'v3-full' },
        { url: 'https://api.kuna.io/v2/tickers', tag: 'v2-legacy' }
    ];

    let raw = null;
    let usedTag = null;
    const errors = [];

    for (const { url, tag } of endpoints) {
        try {
            const data = await fetchJson(url, { retries: 1, baseDelay: 2000 });
            if (data == null) { errors.push(`${tag}: null`); continue; }

            if (data && !Array.isArray(data) && typeof data === 'object') {
                const keys = Object.keys(data);
                const isError = keys.length <= 2 && (data.messages || data.message || data.error);
                if (isError) { errors.push(`${tag}: ${data.messages || data.message || data.error}`); continue; }
            }

            const empty = Array.isArray(data) && data.length === 0;
            if (empty) { errors.push(`${tag}: empty array`); continue; }

            raw = data;
            usedTag = tag;
            break;
        } catch (e) {
            errors.push(`${tag}: ${e.message}`);
        }
    }

    if (raw == null) {
        console.log(`kuna    : all endpoints failed → ${errors.join(' | ')}`);
        const prev = await readJson('kuna');
        if (prev) console.log(`kuna    : keeping previous snapshot (${(prev.data || []).length} pairs)`);
        else console.log('kuna    : no previous snapshot to keep');
        return;
    }

    const shape = Array.isArray(raw)
        ? `array[${raw.length}]`
        : `object{${Object.keys(raw).length} keys}`;
    const sample = Array.isArray(raw) ? raw[0] : raw[Object.keys(raw)[0]];
    console.log(`kuna    : ${usedTag} → ${shape}`);
    console.log(`kuna    : sample: ${JSON.stringify(sample).slice(0, 220)}`);

    let normalized = [];

    if (Array.isArray(raw)) {

        normalized = raw
            .map(row => {
                if (Array.isArray(row) && row.length >= 2) {
                    const [pair, last, low, high, vol, buy, sell] = row;
                    return {
                        pair: String(pair),
                        last: Number(last) || null,
                        low:  Number(low)  || null,
                        high: Number(high) || null,
                        vol:  Number(vol)  || null,
                        buy:  Number(buy)  || null,
                        sell: Number(sell) || null
                    };
                }
                if (row && typeof row === 'object') {
                    const pair = row.symbol || row.pair || row.name;
                    const last = row.last ?? row.price ?? row.lastPrice ?? row.close;
                    const buy  = row.buy  ?? row.bid;
                    const sell = row.sell ?? row.ask;
                    const low  = row.low;
                    const high = row.high;
                    const vol  = row.vol ?? row.volume;
                    if (!pair) return null;
                    return {
                        pair: String(pair),
                        last: Number(last) || null,
                        low:  Number(low)  || null,
                        high: Number(high) || null,
                        vol:  Number(vol)  || null,
                        buy:  Number(buy)  || null,
                        sell: Number(sell) || null
                    };
                }
                return null;
            })
            .filter(Boolean);
    } else if (typeof raw === 'object') {
        normalized = Object.entries(raw).map(([pair, t]) => {
            const last = t.last ?? t.price ?? t.last_price ?? t.close ?? null;
            const buy  = t.buy  ?? t.bid  ?? t.bid_price ?? null;
            const sell = t.sell ?? t.ask  ?? t.ask_price ?? null;
            const low  = t.low  ?? t.low_price ?? null;
            const high = t.high ?? t.high_price ?? null;
            const vol  = t.vol  ?? t.volume ?? t.base_volume ?? null;
            return {
                pair,
                last: Number(last) || null,
                low:  Number(low)  || null,
                high: Number(high) || null,
                vol:  Number(vol)  || null,
                buy:  Number(buy)  || null,
                sell: Number(sell) || null
            };
        });
    }

    normalized = normalized.filter(p => p.last != null || p.buy != null || p.sell != null);

    if (normalized.length === 0) {
        console.log('kuna    : could not normalize any pair, saving raw for debug');
        await writeJson('kuna', raw, { note: 'unnormalized', endpoint: usedTag });
        return;
    }

    await writeJson('kuna', normalized, { endpoint: usedTag });
    console.log(`kuna    : saved ${normalized.length} pairs via ${usedTag}`);
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

async function saveCrypto() {
    const existing = await readJson('crypto');
    const existingMap = {};
    (existing?.data?.coins || []).forEach(c => { existingMap[c.id] = c; });

    const today = new Date().toISOString().slice(0, 10);
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
        console.log('crypto  : history already refreshed today, skipping');
    } else {
        for (const coin of coins) {
            try {
                const url = `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=365`;
                const json = await fetchJson(url, { retries: 2, baseDelay: 5000 });
                const prices = json?.prices || [];

                if (prices.length < 2) {
                    console.log(`  ${coin.symbol.padEnd(6)}: empty, keeping ${Object.keys(coin.history).length} pts`);
                    continue;
                }

                prices.forEach(([ts, price]) => {
                    const iso = new Date(ts).toISOString().slice(0, 10);
                    coin.history[iso] = price;
                });
                console.log(`  ${coin.symbol.padEnd(6)}: ${Object.keys(coin.history).length} pts`);
            } catch (e) {
                console.log(`  ${coin.symbol.padEnd(6)}: ${e.message}, keeping ${Object.keys(coin.history).length} pts`);
            }
            await new Promise(r => setTimeout(r, 2500));
        }
    }

    await writeJson('crypto', { coins }, { historyDate: today });
    console.log(`crypto  : saved ${coins.length} coins`);
}

/* ─────────────── Run ─────────────── */

console.log('Updating data...');

const tasks = [
    ['nbu',    saveNBU],
    ['privat', savePrivat],
    ['mono',   saveMono],
    ['kuna',   saveKuna],
    ['liqpay', saveLiqPay]
];

const results = await Promise.allSettled(tasks.map(([, fn]) => fn()));
results.forEach((r, i) => {
    if (r.status === 'rejected') {
        console.error(`FAIL ${tasks[i][0]}: ${r.reason?.message}`);
    }
});

await saveCrypto();
console.log('Done.');
