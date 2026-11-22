import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = 'data';
await fs.mkdir(DATA_DIR, { recursive: true });

const UA = { 'User-Agent': 'nbu-rate-bot (https://github.com/He-Trogati-Mne/nbu-rate-data)' };
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept-Language': 'uk-UA,uk;q=0.9,en;q=0.8'
};

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

async function fetchText(url, timeoutMs = 15000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: ctrl.signal, headers: BROWSER_HEADERS });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.text();
    } finally {
        clearTimeout(timer);
    }
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

/* ─────────────── Other Ukrainian Banks ─────────────── */

const BANK_CURRENCIES = ['USD', 'EUR', 'GBP', 'PLN'];

const BANK_ALIASES = {
    oschad: ['ощадбанк', 'oschadbank', 'ощад'],
    pumb: ['пумб', 'pumb', 'перший український міжнародний'],
    raif: ['райффайзен', 'raiffeisen', 'аваль'],
    ukrsib: ['укрсиббанк', 'ukrsibbank', 'укрсиб'],
    sense: ['сенс банк', 'sense bank', 'sensebank', 'сенс'],
    otp: ['отп банк', 'otp bank', 'отп'],
    ukrexim: ['укрексімбанк', 'ukreximbank', 'укрэксимбанк'],
    ukrgas: ['укргазбанк', 'ukrgasbank'],
    'a-bank': ['а-банк', 'абанк', 'a-bank', 'акцент-банк'],
    kredo: ['кредобанк', 'kredobank'],
    tas: ['таскомбанк', 'tascombank', 'тас'],
    'credit-agricole': ['креді агріколь', 'креди агриколь', 'credit agricole'],
    pinbank: ['перший інвестиційний', 'пинбанк', 'пінбанк', 'pinbank'],
    ubrr: ['убрр', 'ubrr'],
    procredit: ['прокредит', 'procredit'],
    pravex: ['правекс', 'pravex'],
    idea: ['ідея банк', 'идея банк', 'idea bank'],
    piraeus: ['піреус', 'пиреус', 'piraeus'],
    citibank: ['сітібанк', 'ситибанк', 'citibank'],
    ing: ['інг банк', 'инг банк', 'ing bank'],
    deutsche: ['дойче банк', 'deutsche bank'],
    seb: ['себ корпоративний', 'seb'],
    creditwest: ['кредитвест', 'creditwest'],
    bta: ['бта банк', 'bta bank'],
    universal: ['універсал банк', 'универсал банк', 'universal bank'],
    pivdenny: ['південний', 'пивденный', 'pivdenny'],
    'credit-dnipro': ['кредит дніпро', 'кредит днепр', 'credit dnipro'],
    mtb: ['мтб банк', 'mtb bank', 'марфін'],
    vostok: ['восток', 'vostok'],
    accord: ['акордбанк', 'аккордбанк', 'accordbank'],
    lviv: ['банк львів', 'банк львов', 'bank lviv', 'львів'],
    globus: ['глобус', 'globus'],
    alliance: ['альянс', 'alliance'],
    industrial: ['індустріалбанк', 'индустриалбанк', 'industrialbank'],
    radabank: ['радабанк', 'radabank'],
    mib: ['міжнародний інвестиційний банк', 'международный инвестиционный', 'міб', 'миб'],
    asvio: ['асвіо', 'асвио', 'asvio'],
    komin: ['комінбанк', 'коминбанк', 'комерційний індустріальний', 'kominbank', 'cib'],
    krystal: ['кристалбанк', 'krystalbank'],
    agroprosperis: ['агропросперіс', 'агропросперис', 'agroprosperis'],
    clearing: ['кліринговий дім', 'клиринговый дом', 'clearing house'],
    poltava: ['полтава-банк', 'полтава банк', 'poltava-bank'],
    polikom: ['полікомбанк', 'поликомбанк', 'polikombank'],
    unex: ['юнекс', 'unex'],
    altbank: ['альтбанк', 'altbank'],
    sky: ['скай банк', 'sky bank'],
    ukrcapital: ['український капітал', 'украинский капитал', 'ukrcapital'],
    bank34: ['банк 3/4', '3/4', 'банк3/4'],
    avangard: ['авангард', 'avangard'],
    bizbank: ['бізбанк', 'бизбанк', 'інвестицій та заощаджень', 'инвестиций и сбережений', 'біз'],
    metabank: ['метабанк', 'металлург', 'metabank'],
    oksi: ['оксі банк', 'окси банк', 'оксі', 'oxi'],
    grant: ['грант', 'grant'],
    europrom: ['європромбанк', 'европромбанк', 'europrombank'],
    family: ['фамільний', 'фамильный', 'family'],
    'trust-capital': ['траст-капітал', 'траст-капитал', 'trust-capital'],
    ute: ['юте банк', 'рвс банк', 'iute', 'rws'],
    nexent: ['нексент', 'nexent', 'кредит європа', 'кредит европа']
};

const SORTED_BANK_ALIASES = Object.entries(BANK_ALIASES)
    .flatMap(([id, names]) => names.map(name => ({ id, name: name.toLowerCase() })))
    .sort((a, b) => b.name.length - a.name.length);

function matchBankId(rawName) {
    const clean = String(rawName || '')
        .toLowerCase()
        .replace(/["'«»„“()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!clean) return null;
    if (clean.includes('приват') || clean.includes('privat') || clean.includes('моно') || clean.includes('mono')) {
        return null;
    }
    for (const { id, name } of SORTED_BANK_ALIASES) {
        if (clean.includes(name)) return id;
    }
    return null;
}

function stripHtmlTags(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

async function getNbuAnchors() {
    const anchors = { USD: 41.5, EUR: 44.5, GBP: 53.0, PLN: 10.3 };
    const nbu = await readJson('nbu');
    const list = Array.isArray(nbu?.data) ? nbu.data : [];
    for (const item of list) {
        if (BANK_CURRENCIES.includes(item.cc) && Number(item.rate) > 0) {
            anchors[item.cc] = Number(item.rate);
        }
    }
    return anchors;
}

function isValidBankPair(cc, buy, sell, anchors) {
    const ref = anchors[cc];
    if (!ref || !Number.isFinite(buy) || !Number.isFinite(sell)) return false;
    if (buy < ref * 0.75 || buy > ref * 1.4) return false;
    if (sell < ref * 0.75 || sell > ref * 1.4) return false;
    if (buy > sell * 1.02) return false;
    return true;
}

function parseBankTable(html, cc, anchors, banksMap, sourceName) {
    let added = 0;
    const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
    for (const row of rows) {
        const cells = row.match(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi);
        if (!cells || cells.length < 3) continue;

        const bankId = matchBankId(stripHtmlTags(cells[0]));
        if (!bankId) continue;

        const nums = [];
        for (let i = 1; i < cells.length; i++) {
            const matches = stripHtmlTags(cells[i]).match(/\b\d{1,3}[.,]\d{2,4}\b/g) || [];
            for (const m of matches) {
                const val = Number(m.replace(',', '.'));
                if (val >= anchors[cc] * 0.75 && val <= anchors[cc] * 1.4) {
                    nums.push(val);
                }
            }
        }

        if (nums.length >= 2) {
            const buy = nums[0];
            const sell = nums[1];
            if (isValidBankPair(cc, buy, sell, anchors)) {
                if (!banksMap[bankId]) banksMap[bankId] = { source: sourceName, data: {} };
                if (!banksMap[bankId].data[cc]) {
                    banksMap[bankId].data[cc] = {
                        buy: Math.round(buy * 10000) / 10000,
                        sell: Math.round(sell * 10000) / 10000
                    };
                    added++;
                }
            }
        }
    }
    return added;
}

function parseMinfinCardTable(html, anchors, banksMap) {
    let added = 0;
    const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
    for (const row of rows) {
        const cells = row.match(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi);
        if (!cells || cells.length < 3) continue;

        const bankId = matchBankId(stripHtmlTags(cells[0]));
        if (!bankId) continue;

        const nums = (stripHtmlTags(cells.slice(1).join(' ')).match(/\b\d{1,3}[.,]\d{2,4}\b/g) || [])
            .map(m => Number(m.replace(',', '.')));

        for (let i = 0; i < nums.length - 1; i++) {
            const a = nums[i];
            const b = nums[i + 1];
            if (isValidBankPair('USD', a, b, anchors)) {
                if (!banksMap[bankId]) banksMap[bankId] = { source: 'minfin-card', data: {} };
                if (!banksMap[bankId].data.USD) {
                    banksMap[bankId].data.USD = { buy: a, sell: b };
                    added++;
                }
            } else if (isValidBankPair('EUR', a, b, anchors)) {
                if (!banksMap[bankId]) banksMap[bankId] = { source: 'minfin-card', data: {} };
                if (!banksMap[bankId].data.EUR) {
                    banksMap[bankId].data.EUR = { buy: a, sell: b };
                    added++;
                }
            }
        }
    }
    return added;
}

async function saveOtherBanks() {
    const anchors = await getNbuAnchors();
    const banksMap = {};

    try {
        const cardHtml = await fetchText('https://minfin.com.ua/ua/currency/banks/card/');
        const c = parseMinfinCardTable(cardHtml, anchors, banksMap);
        console.log(`banks   : minfin-card +${c}`);
    } catch (e) {
        console.log(`banks   : minfin-card → ${e.message}`);
    }

    for (const cc of BANK_CURRENCIES) {
        const low = cc.toLowerCase();
        const sources = [
            { name: 'minfin.com.ua', url: `https://minfin.com.ua/ua/currency/banks/${low}/` },
            { name: 'banki.ua',      url: `https://banki.ua/kursy-valyut/${low}` },
            { name: 'kurs.com.ua',   url: `https://kurs.com.ua/ua/banki/${low}` }
        ];
        for (const src of sources) {
            try {
                const html = await fetchText(src.url);
                const c = parseBankTable(html, cc, anchors, banksMap, src.name);
                if (c > 0) console.log(`banks   : ${src.name} ${cc} +${c}`);
            } catch (e) {
                console.log(`banks   : ${src.name} ${cc} → ${e.message}`);
            }
            await new Promise(r => setTimeout(r, 300));
        }
    }

    let saved = 0;
    for (const [bankId, payload] of Object.entries(banksMap)) {
        if (!payload.data || Object.keys(payload.data).length === 0) continue;
        await writeJson(bankId, payload.data, { source: payload.source });
        saved++;
    }
    console.log(`banks   : saved ${saved} bank files`);
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

await saveOtherBanks().catch(e => console.error('FAIL banks: ' + e.message));
await saveNBUHistory().catch(e => console.error('FAIL nbu-history: ' + e.message));
await saveCrypto().catch(e => console.error('FAIL crypto: ' + e.message));

console.log('Done.');
