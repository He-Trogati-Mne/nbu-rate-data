import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = 'data';
await fs.mkdir(DATA_DIR, { recursive: true });

const UA = { 'User-Agent': 'nbu-rate-bot (https://github.com/He-Trogati-Mne/nbu-rate-data)' };
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
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

/* ─────────────── Official Bank APIs and Websites ─────────────── */

const BANK_CURRENCIES = ['USD', 'EUR', 'GBP', 'PLN'];

const OFFICIAL_BANK_SOURCES = [
    { id: 'oschad',          urls: ['https://www.oschadbank.ua/msb/currency-rate', 'https://www.oschadbank.ua/currency-rate'] },
    { id: 'pumb',            urls: ['https://about.pumb.ua/', 'https://about.pumb.ua/info/currency_converter', 'https://www.pumb.ua/purchase_currency'] },
    { id: 'raif',            urls: ['https://raiffeisen.ua/currency', 'https://raiffeisen.ua/en/currency?show=1'] },
    { id: 'ukrsib',          urls: ['https://ukrsibbank.com/currency-cash/', 'https://ukrsibbank.com/'] },
    { id: 'sense',           urls: ['https://sensebank.ua/currency-exchange', 'https://sensebank.ua/'] },
    { id: 'ukrgas',          urls: ['https://www.ukrgasbank.com/'] },
    { id: 'ukrexim',         urls: ['https://www.eximb.com/ua/business/pryvatnym-klientam/pryvatnym-klientam-inshi-poslugy/obmin-valyut/kursy-valyut/', 'https://www.eximb.com/ua/'] },
    { id: 'pivdenny',        urls: ['https://bank.com.ua/currency-metals-rates', 'https://front.bank.com.ua/currency-metals-rates', 'https://front.bank.com.ua/', 'https://bank.com.ua/'] },
    { id: 'credit-agricole', urls: ['https://credit-agricole.ua/kurs-valyut', 'https://credit-agricole.ua/'] },
    { id: 'globus',          urls: ['https://globusbank.com.ua/ua/kurs-valyut.html', 'https://globusbank.com.ua/'] },
    { id: 'lviv',            urls: ['https://www.banklviv.com/'] },
    { id: 'a-bank',          urls: ['https://a-bank.com.ua/', 'https://a-bank.com.ua/?action=noAction'] },
    { id: 'kredo',           urls: ['https://kredobank.com.ua/info/kursy-valyut/commercial', 'https://kredobank.com.ua/info/kursy-valyut/cards', 'https://kredobank.com.ua/info/kursy-valyut'] },
    { id: 'otp',             urls: ['https://www.otpbank.com.ua/privateclients/pay-cards/currency-converter-cards.php', 'https://www.otpbank.com.ua/'] },
    { id: 'pravex',          urls: ['https://www.pravex.com.ua/kursy-valyut', 'https://www.pravex.com.ua/'] },
    { id: 'tas',             urls: ['https://tascombank.ua/'] },
    { id: 'piraeus',         urls: ['https://www.piraeusbank.ua/', 'https://www.piraeusbank.ua/ua/kursy-valyut-dlya-operatsiy-iz-platizhnymy-kartkamy'] },
    { id: 'idea',            urls: ['https://ideabank.ua/uk', 'https://ideabank.ua/'] },
    { id: 'komin',           urls: ['https://cib.com.ua/uk', 'https://cib.com.ua/uk/private', 'https://cib.com.ua/uk/about/page/informaciya-pro-bank'] },
    { id: 'alliance',        urls: ['https://www.alb.ua/', 'https://alb.ua/uk', 'https://alb.ua/currency'] },
    { id: 'poltava',         urls: ['https://poltavabank.com/'] },
    { id: 'polikom',         urls: ['https://www.policombank.com/kurs-valjut', 'https://www.policombank.com/'] },
    { id: 'ukrcapital',      urls: ['https://www.ukrcapital.com.ua/'] },
    { id: 'krystal',         urls: ['https://crystalbank.com.ua/', 'https://crystalbank.com.ua/currency'] },
    { id: 'bank34',          urls: ['https://bank34.ua/'] },
    { id: 'grant',           urls: ['https://www.grant.ua/'] },
    { id: 'industrial',      urls: ['https://industrialbank.ua/ua/', 'https://industrialbank.ua/'] },
    { id: 'asvio',           urls: ['https://www.asviobank.ua/'] },
    { id: 'vostok',          urls: ['https://bankvostok.com.ua/'] },
    { id: 'mtb',             urls: ['https://mtb.ua/currency', 'https://mtb.ua/'] },
    { id: 'accord',          urls: ['https://accordbank.com.ua/'] },
    { id: 'radabank',        urls: ['https://www.radabank.com.ua/'] },
    { id: 'credit-dnipro',   urls: ['https://creditdnepr.com.ua/'] },
    { id: 'procredit',       urls: ['https://www.procreditbank.com.ua/'] },
    { id: 'unex',            urls: ['https://unexbank.ua/'] },
    { id: 'altbank',         urls: ['https://altbank.ua/'] },
    { id: 'universal',       urls: ['https://www.universalbank.com.ua/'] },
    { id: 'mib',             urls: ['https://ii-bank.com.ua/uk/private-clients/rates', 'https://www.ii-bank.com.ua/'] },
    { id: 'agroprosperis',   urls: ['https://ap-bank.com/'] },
    { id: 'avangard',        urls: ['https://avgd.ua/'] },
    { id: 'bizbank',         urls: ['https://www.bisbank.com.ua/kurs-valyut/kyyiv/', 'https://www.bisbank.com.ua/'] },
    { id: 'metabank',        urls: ['https://www.mbank.com.ua/'] },
    { id: 'oksi',            urls: ['https://oxibank.ua/', 'https://www.oxibank.ua/'] },
    { id: 'family',          urls: ['https://www.fbank.com.ua/'] },
    { id: 'trust-capital',   urls: ['https://www.tc-bank.com/'] },
    { id: 'clearing',        urls: ['https://www.clhs.com.ua/'] },
    { id: 'pinbank',         urls: ['https://www.pinbank.ua/'] },
    { id: 'sky',             urls: ['https://sky.bank/'] }
];

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

function normalizeRateValue(val, ref) {
    if (!Number.isFinite(val) || !ref) return null;
    if (val >= ref * 75 && val <= ref * 140) val = val / 100;
    if (val >= ref * 0.80 && val <= ref * 1.32) {
        return Math.round(val * 10000) / 10000;
    }
    return null;
}

function extractCurrencyFromFragment(fragment, ref) {
    // Убираем числа с пробелами-разделителями тысяч вроде "50 000" и даты вида 22.11.2026
    const clean = fragment
        .replace(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g, ' ')
        .replace(/\b\d{1,3}(?:\s+\d{3})+\b/g, ' ');
    const rawNums = clean.match(/\b\d{1,5}(?:[.,]\d{1,4})?\b/g) || [];
    const valid = [];
    for (const r of rawNums) {
        const n = normalizeRateValue(Number(r.replace(',', '.')), ref);
        if (n != null) valid.push(n);
    }
    if (valid.length < 2) return null;
    const buy = Math.min(valid[0], valid[1]);
    const sell = Math.max(valid[0], valid[1]);
    if ((sell - buy) / buy > 0.12) return null;
    return { buy, sell };
}

function parseSplitBuySell(plainText, anchors) {
    // Формат вида "Купівля: USD 44.80; EUR 49.60 ... Продаж: USD 45.50; EUR 50.40" (Индустриалбанк и др.)
    const out = {};
    const buyBlock = plainText.match(/купівл[яі]\s*[:\-]?\s*([\s\S]{10,220})/i);
    const sellBlock = plainText.match(/продаж[у]?\s*[:\-]?\s*([\s\S]{10,220})/i);
    if (!buyBlock || !sellBlock) return out;

    for (const cc of BANK_CURRENCIES) {
        const ref = anchors[cc];
        const re = new RegExp(`\\b${cc}\\b[^\\d]{0,20}(\\d{1,5}(?:[.,]\\d{1,4})?)`, 'i');
        const bm = buyBlock[1].match(re);
        const sm = sellBlock[1].match(re);
        if (bm && sm) {
            const b = normalizeRateValue(Number(bm[1].replace(',', '.')), ref);
            const s = normalizeRateValue(Number(sm[1].replace(',', '.')), ref);
            if (b != null && s != null) {
                const buy = Math.min(b, s);
                const sell = Math.max(b, s);
                if ((sell - buy) / buy <= 0.12) out[cc] = { buy, sell };
            }
        }
    }
    return out;
}

// Заголовки офіційних таблиць можуть мати колонки не в порядку USD, купівля, продаж.
// Наприклад, Ощадбанк: «Валюта | Код | Кількість одиниць | Купівля | Продаж | Курс НБУ».
// Читаємо тільки таблиці, де явно присутні заголовки купівлі і продажу.
function parseBankTablesWithHeaders(html, anchors) {
    const out = {};
    const tables = String(html).match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) || [];
    const codeFor = s => {
        const normalized = String(s).replace(/\s+/g, ' ').trim().toUpperCase();
        const m = normalized.match(/(?:^|\W)(USD|EUR|GBP|PLN)(?:\W|$)/);
        if (m) return m[1];
        if (/ДОЛАР\s+США|US DOLLAR/.test(normalized)) return 'USD';
        if (/ЄВРО|\bEURO\b/.test(normalized)) return 'EUR';
        if (/ФУНТ|POUND/.test(normalized)) return 'GBP';
        if (/ЗЛОТ|ZLOT/.test(normalized)) return 'PLN';
        return null;
    };
    const amount = (value, ref) => {
        const clean = String(value || '').replace(/\s/g, '').replace(/₴|грн/gi, '');
        if (!/^\d{1,3}(?:[.,]\d{1,5})?$/.test(clean)) return null;
        return normalizeRateValue(Number(clean.replace(',', '.')), ref);
    };
    for (const table of tables) {
        const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m =>
            [...m[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(c => stripHtmlTags(c[1]).trim())
        ).filter(row => row.length > 0);
        const headerIndex = rows.findIndex(row => row.some(c => /купівл|купити|buy/i.test(c)) && row.some(c => /продаж|продати|sell/i.test(c)));
        if (headerIndex < 0) continue;
        const header = rows[headerIndex];
        const buyIndex = header.findIndex(c => /купівл|купити|buy/i.test(c));
        const sellIndex = header.findIndex(c => /продаж|продати|sell/i.test(c));
        const codeIndex = header.findIndex(c => /код|code/i.test(c));
        const currencyIndex = header.findIndex(c => /валют|currency|пара/i.test(c));
        if (buyIndex < 0 || sellIndex < 0) continue;
        for (const cells of rows.slice(headerIndex + 1)) {
            if (cells.length <= Math.max(buyIndex, sellIndex)) continue;
            let cc = null;
            if (codeIndex >= 0 && codeIndex < cells.length) cc = codeFor(cells[codeIndex]);
            if (!cc && currencyIndex >= 0 && currencyIndex < cells.length) cc = codeFor(cells[currencyIndex]);
            if (!cc) cc = cells.slice(0, Math.min(2, cells.length)).map(codeFor).find(Boolean) || null;
            if (!cc || out[cc] || !BANK_CURRENCIES.includes(cc)) continue;
            const buy = amount(cells[buyIndex], anchors[cc]);
            const sell = amount(cells[sellIndex], anchors[cc]);
            if (buy == null || sell == null || buy > sell || (sell - buy) / buy > 0.12) continue;
            out[cc] = { buy, sell };
        }
    }
    const pairs = Object.values(out);
    if (new Set(pairs.map(p => `${p.buy}/${p.sell}`)).size !== pairs.length) return null;
    return pairs.length ? out : null;
}

// Банківські дані отримуємо винятково з оприлюднених джерел самих банків.
// Витягаємо пари курсів лише із компактних рядків із кодом валюти;
// не виводимо курс банку з курсу НБУ або випадкових чисел на сторінці.
function parseOfficialBankHtml(html, anchors, isPlain = false) {
    const currencies = BANK_CURRENCIES;
    const clean = isPlain ? html.replace(/\s+/g, ' ').trim() : stripHtmlTags(html);
    const rows = [];
    if (!isPlain) {
        for (const match of html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)) {
            const cells = Array.from(match[0].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi), m => stripHtmlTags(m[1]));
            if (cells.length >= 3) rows.push(cells);
        }
    }
    const out = {};
    const numberPattern = /^\s*(\d{1,3}(?:[.,]\d{1,5})?)\s*$/;
    const money = (raw, ref) => {
        const m = String(raw || '').replace(/\s/g, '').match(numberPattern);
        return m ? normalizeRateValue(Number(m[1].replace(',', '.')), ref) : null;
    };
    for (const cc of currencies) {
        const ref = anchors[cc];
        if (!(ref > 0)) continue;
        for (const cells of rows) {
            if (!new RegExp(`^${cc}(?:\\s|$)`, 'i').test(cells[0])) continue;
            const b = money(cells[1], ref), s = money(cells[2], ref);
            if (b == null || s == null) continue;
            const buy = Math.min(b, s), sell = Math.max(b, s);
            if ((sell - buy) / buy <= 0.12) { out[cc] = { buy, sell }; break; }
        }
        if (out[cc]) continue;
        // Підтримка текстових блоків на кшталт «USD куп. 45.20 прод. 45.80».
        const pattern = new RegExp(`\\b${cc}\\b\\s*(?:куп(?:івля)?\\.?\\s*)?(\\d{1,3}(?:[.,]\\d{1,5}))\\s*(?:\\/\\s*|прод(?:аж)?\\.?\\s*|)(\\d{1,3}(?:[.,]\\d{1,5}))`, 'gi');
        let match;
        while ((match = pattern.exec(clean))) {
            const b = normalizeRateValue(Number(match[1].replace(',', '.')), ref);
            const s = normalizeRateValue(Number(match[2].replace(',', '.')), ref);
            if (b == null || s == null) continue;
            const buy = Math.min(b, s), sell = Math.max(b, s);
            if ((sell - buy) / buy <= 0.12) { out[cc] = { buy, sell }; break; }
        }
    }
    const pairs = Object.values(out);
    if (pairs.length > 1) {
        const unique = new Set(pairs.map(v => `${v.buy}/${v.sell}`));
        if (unique.size !== pairs.length) return null;
    }
    return Object.keys(out).length > 0 ? out : null;
}
function parseDedicatedBankHtml(id, html, anchors, isPlain = false) {
    if (id !== 'polikom' && id !== 'komin') return null;
    const plain = isPlain ? html.replace(/\s+/g, ' ').trim() : stripHtmlTags(html);
    let section = '';
    if (id === 'polikom') {
        const pos = plain.search(/Курс\s+валют\s+для\s+готівкових\s+операцій/i);
        if (pos < 0) return null;
        section = plain.slice(pos, pos + 1200).split(/Курс\s+валют\s+для\s+карткових\s+операцій/i)[0];
    } else {
        const pos = plain.search(/Курси\s+купівлі[-–]?продажу\s+готівкової\s+іноземної\s+валюти/i);
        if (pos < 0) return null;
        section = plain.slice(pos, pos + 1250).split(/Валютообмін\s+On[- ]?line/i)[0];
    }
    const out = {};
    const re = /(?:^|\s)(USD|EUR|EURO|GBP|PLN)\s+(\d{1,3}(?:[.,]\d{1,5})?)\s*(?:\/\s*|\s+)(\d{1,3}(?:[.,]\d{1,5})?)(?=\s|$)/gi;
    let match;
    while ((match = re.exec(section))) {
        const cc = match[1].toUpperCase() === 'EURO' ? 'EUR' : match[1].toUpperCase();
        const buy = normalizeRateValue(Number(match[2].replace(',', '.')), anchors[cc]);
        const sell = normalizeRateValue(Number(match[3].replace(',', '.')), anchors[cc]);
        if (buy != null && sell != null && buy <= sell && (sell - buy) / buy <= 0.12) {
            out[cc] = { buy, sell };
        }
    }
    return Object.keys(out).length ? out : null;
}

function publishedBankDate(id, html) {
    if (!['polikom', 'komin', 'oschad', 'pivdenny'].includes(id)) return null;
    const plain = stripHtmlTags(html);
    const re = id === 'polikom'
        ? /Курс\s+валют\s+для\s+готівкових\s+операцій\s+від\s+(\d{2})\.(\d{2})\.(\d{4})/i
        : id === 'pivdenny'
            ? /Курси\s+валют\s+у\s+відділеннях[\s\S]{0,90}?Курс\s+на\s+дату\s*:?\s*(\d{2})\.(\d{2})\.(\d{4})/i
            : /Курс\s+валют[\s\S]{0,100}?(\d{2})\.(\d{2})\.(\d{4})/i;
    const m = plain.match(re);
    if (!m) return null;
    const year = Number(m[3]), month = Number(m[2]), day = Number(m[1]);
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) return null;
    return d.toISOString().slice(0, 10);
}

function parseOfficialTextVariants(id, html, anchors, isPlain = false) {
    const text = isPlain ? String(html).replace(/\s+/g, ' ').trim() : stripHtmlTags(String(html));
    const out = {};
    const normalized = (cc, buyText, sellText) => {
        const buy = normalizeRateValue(Number(String(buyText).replace(',', '.')), anchors[cc]);
        const sell = normalizeRateValue(Number(String(sellText).replace(',', '.')), anchors[cc]);
        if (buy != null && sell != null && buy > 0 && buy <= sell && (sell - buy) / buy <= 0.12) {
            out[cc] = { buy, sell };
        }
    };
    const amount = '(\\d{1,3}(?:[.,]\\d{1,5})?)';

    if (id === 'alliance') {
        const start = text.search(/Валютообмін/i);
        if (start < 0) return null;
        const section = text.slice(start, start + 2500);
        const head = section.match(/Основний\s+Купівля\s*\/\s*Продаж/i);
        if (!head) return null;
        const block = section.slice(head.index + head[0].length).split(/Крос-курс|Основний\s+Купівля/i)[0].slice(0, 650);
        for (const cc of ['USD', 'EUR']) {
            const m = block.match(new RegExp(`\\b${cc}\\b\\s+${amount}\\s*\/\\s*${amount}`, 'i'));
            if (m) normalized(cc, m[1], m[2]);
        }
    } else if (id === 'sense') {
        const section = text.split(/Обмін валют у додатку|Поширені запитання|Як купити валюту/i)[0];
        for (const cc of ['USD', 'EUR']) {
            const m = section.match(new RegExp(`\\b${cc}\\s*\\/\\s*UAH\\s+Купівля\\s+${amount}\\s+Продаж\\s+${amount}`, 'i'));
            if (m) normalized(cc, m[1], m[2]);
        }
    } else if (id === 'kredo') {
        const start = text.indexOf('Всі курси валют');
        if (start < 0) return null;
        const section = text.slice(start, start + 2100);
        if (!/Код\s+валюти[\s\S]{0,120}Продаж\s+Купівля/i.test(section)) return null;
        const names = {
            USD: /840\s+USD\s+Долар\s+США/i,
            EUR: /978\s+EUR\s+Євро/i,
            PLN: /985\s+PLN\s+Польський\s+злотий/i,
            GBP: /826\s+GBP\s+Фунт\s+стерлінгів/i
        };
        for (const [cc, head] of Object.entries(names)) {
            const m = section.match(new RegExp(`${head.source}\\s+${amount}\\s+${amount}`, 'i'));
            if (m) normalized(cc, m[2], m[1]);
        }
    } else if (id === 'pivdenny') {
        const start = text.search(/Курси\s+валют\s+у\s+відділеннях/i);
        if (start < 0) return null;
        const section = text.slice(start, start + 1900).split(/Курси\s+валют\s+у\s+Pivdenny|Крос-курси/i)[0];
        if (!/Купівля\s+Продаж\s+НБУ/i.test(section)) return null;
        const names = { USD: 'Долар\\s+США', EUR: 'Євро', GBP: 'Англійський\\s+фунт\\s+стерлінгів', PLN: 'Польський\\s+злотий' };
        for (const [cc, title] of Object.entries(names)) {
            const m = section.match(new RegExp(`${title}\\s+${cc}\\s+${amount}\\s+${amount}\\s+${amount}`, 'i'));
            if (m) normalized(cc, m[1], m[2]);
        }
    }
    const pairs = Object.values(out);
    if (pairs.length > 1 && new Set(pairs.map(p => `${p.buy}/${p.sell}`)).size !== pairs.length) return null;
    return pairs.length ? out : null;
}

function bankPageRates(id, html, anchors, isPlain = false) {
    const dedicated = parseDedicatedBankHtml(id, html, anchors, isPlain);
    if (dedicated) return dedicated;
    const officialText = parseOfficialTextVariants(id, html, anchors, isPlain);
    if (officialText) return officialText;
    const table = isPlain ? null : parseBankTablesWithHeaders(html, anchors);
    if (['oschad','pumb','ukrsib','mtb','asvio'].includes(id)) return table;
    return table || parseOfficialBankHtml(html, anchors, isPlain);
}

const BANK_API_URLS = {
    'a-bank': 'https://a-bank.com.ua/backend/api/v1/rates',
    tas: 'https://tascombank.ua/api/currencies/v2',
    procredit: 'https://procreditbank.com.ua/api/v1/currency/last?rate=mobile',
    sky: 'https://api.sky.bank/currency/get-offices-currency-rates'
};
const BANK_PAGE_ADAPTERS = {
    sense: 'https://sensebank.ua/currency-exchange',
    pravex: 'https://www.intesasanpaolobank.ua/kursy-valyut',
    altbank: 'https://altbank.ua/en',
    ukrsib: 'https://ukrsibbank.com/currency-cash/',
    mtb: 'https://mtb.ua/currency',
    agroprosperis: 'https://ap-bank.com/page/kurs-valjut-na-sogodni',
    clearing: 'https://clhs.com.ua/ua/kursi-valyut',
    'credit-dnipro': 'https://creditdnepr.com.ua/currency'
};
const SKY_CARD_URL = 'https://api.sky.bank/currency/get-card-currency-rates';

function kyivDate(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function validDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ''));
    if (!m) return null;
    const d = new Date(s + 'T00:00:00Z');
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === s ? s : null;
}
function sourceDate(value, utc = false) {
    if (typeof value !== 'string') return null;
    if (utc) {
        const d = new Date(value);
        return Number.isFinite(+d) ? validDate(kyivDate(d)) : null;
    }
    return validDate(value.slice(0, 10));
}
function pageDate(text) {
    const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(text);
    return m ? validDate(`${m[3]}-${m[2]}-${m[1]}`) : null;
}
function isFreshDate(date, now = new Date()) {
    if (!validDate(date)) return false;
    const age = (Date.parse(kyivDate(now)) - Date.parse(date)) / 86400000;
    return age >= 0 && age <= 4;
}
function strictNumber(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v !== 'string' || !/^\d+(?:[.,]\d+)?$/.test(v.trim())) return null;
    const n = Number(v.trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}
function exactPair(cc, buyValue, sellValue, anchors) {
    if (!BANK_CURRENCIES.includes(cc)) return null;
    const buy = strictNumber(buyValue), sell = strictNumber(sellValue), ref = anchors[cc];
    if (buy == null || sell == null || !(ref > 0) || buy <= 0 || sell <= buy || buy < ref * .80 || sell > ref * 1.32 || (sell - buy) / buy > .12) return null;
    return { buy: Math.round(buy * 10000) / 10000, sell: Math.round(sell * 10000) / 10000 };
}
function putPair(out, cc, b, s, anchors) {
    const pair = exactPair(cc, b, s, anchors);
    if (pair && !out[cc]) out[cc] = pair;
}
function usableRates(data) {
    return !!(data?.USD && data?.EUR) && new Set(Object.values(data).map(x => `${x.buy}/${x.sell}`)).size === Object.keys(data).length;
}
function aBankRates(rows, anchors) {
    const pairs = {}, out = {};
    if (!Array.isArray(rows)) return out;
    for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        const a = strictNumber(row.rateA), b = strictNumber(row.rateB);
        if (!(a > 0 && b > 0)) continue;
        if (row.ccyB === 'UAH' && BANK_CURRENCIES.includes(row.ccyA)) (pairs[row.ccyA] ??= {}).buy = b / a;
        if (row.ccyA === 'UAH' && BANK_CURRENCIES.includes(row.ccyB)) (pairs[row.ccyB] ??= {}).sell = a / b;
    }
    for (const [cc, p] of Object.entries(pairs)) putPair(out, cc, p.buy, p.sell, anchors);
    return out;
}
function skyRates(rows, anchors) {
    const out = {};
    if (!Array.isArray(rows)) return out;
    for (const row of rows) {
        if (row?.baseCurrency?.code !== 'UAH') continue;
        const b = strictNumber(row.buyRate?.rate), s = strictNumber(row.sellRate?.rate);
        const bd = strictNumber(row.buyRate?.base), sd = strictNumber(row.sellRate?.base);
        if (b > 0 && s > 0 && bd > 0 && sd > 0) putPair(out, row.targetCurrency?.code, b / bd, s / sd, anchors);
    }
    return out;
}
function parseBankApi(id, raw, anchors, now = new Date()) {
    let data = {}, rateType, rateDate = null, extra = {};
    if (id === 'a-bank') {
        if (raw?.status !== 'ok' || raw?.result !== 'ok') return null;
        rateDate = sourceDate(raw.date);
        data = aBankRates(raw.data, anchors);
        rateType = 'cash';
        const card = aBankRates(raw.processing, anchors);
        if (usableRates(card)) extra.ratesByType = { card };
    } else if (id === 'tas') {
        if (!Array.isArray(raw)) return null;
        const rows = raw.flat(1).filter(x => x?.kurs_type === 'card' && x.forc_kurs === 'UAH' && strictNumber(x.forc) === 1 && isFreshDate(sourceDate(x.date), now));
        rateDate = rows.map(x => sourceDate(x.date)).sort().at(-1) ?? null;
        for (const x of rows.filter(x => sourceDate(x.date) === rateDate)) putPair(data, x.short_name, x.kurs_buy, x.kurs_sale, anchors);
        rateType = 'card';
    } else if (id === 'procredit') {
        const rows = [...(Array.isArray(raw?.UAHToUSD) ? raw.UAHToUSD : []), ...(Array.isArray(raw?.UAHToEUR) ? raw.UAHToEUR : [])]
            .filter(x => x?.currencyFrom === 'UAH' && x.rate === 'mobile' && isFreshDate(sourceDate(x.date, true), now))
            .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
        rateDate = rows.length ? sourceDate(rows[0].date, true) : null;
        for (const x of rows.filter(x => sourceDate(x.date, true) === rateDate)) putPair(data, x.currencyTo, x.buyValue, x.sellValue, anchors);
        rateType = 'online';
    } else if (id === 'sky') {
        if (raw?.code !== 0 || !Array.isArray(raw.response)) return null;
        const office = raw.response.find(x => x?.name === 'Київське відділення №1');
        if (!office) return null;
        data = skyRates(office.rates, anchors);
        rateType = 'cash';
        extra.branch = office.name;
    } else return null;
    if (id !== 'sky' && !isFreshDate(rateDate, now)) return null;
    if (!usableRates(data)) return null;
    return { data, rateType, rateDate, ...extra };
}
async function fetchPublicBankJson(url) {
    const response = await fetch(url, { headers: { ...UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    if (!/json/i.test(response.headers.get('content-type') || '')) throw new Error('Очікувався JSON: ' + url);
    return response.json();
}
async function getBankApiRates(id, anchors) {
    const url = BANK_API_URLS[id];
    const result = parseBankApi(id, await fetchPublicBankJson(url), anchors);
    if (!result) throw new Error('API: відсутні перевірені актуальні курси USD/EUR');
    if (id === 'sky') {
        try {
            const cardRaw = await fetchPublicBankJson(SKY_CARD_URL);
            const card = cardRaw?.code === 0 ? skyRates(cardRaw.response, anchors) : {};
            if (usableRates(card)) result.ratesByType = { card };
        } catch (e) { console.log(`bank    : sky card → ${e.message}`); }
    }
    return result;
}

function parseBankPageAdapter(id, raw, anchors, now = new Date()) {
    const text = String(raw).replace(/\s+/g, ' ').trim();
    const data = {};
    let rateType = 'cash', rateDate = null, branch, section = '', m;
    const amount = '(\\d{1,3}(?:[.,]\\d{1,5})?)';
    const names = { USD: 'Долар\\s+США', EUR: 'Євро', GBP: '(?:Англійський\\s+)?Фунт\\s+стерл[іiи]нг[іiи]в' };
    const namedRows = (block, nbuColumn = false) => {
        for (const [cc, name] of Object.entries(names)) {
            const match = block.match(new RegExp(`${name}\\s+${amount}\\s+${amount}${nbuColumn ? '\\s+' + amount : ''}(?=\\s|$)`, 'i'));
            if (match) putPair(data, cc, match[1], match[2], anchors);
        }
    };
    if (id === 'sense') {
        m = text.match(/Курс валют\s+(\d{1,2})\s+([а-яіїє]+)\s+(\d{4})\s+Відділення\s+Онлайн\s+Для карток\s+([\s\S]*?)Архів курсів/i);
        if (!m) return null;
        const months = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
        const month = months.indexOf(m[2].toLowerCase()) + 1;
        rateDate = month ? validDate(`${m[3]}-${String(month).padStart(2,'0')}-${m[1].padStart(2,'0')}`) : null;
        section = m[4];
        for (const cc of BANK_CURRENCIES) {
            const p = section.match(new RegExp(`\\b${cc}\\s*\\/\\s*UAH\\s+Купівля\\s+${amount}\\s+Продаж\\s+${amount}(?=\\s|$)`, 'i'));
            if (p) putPair(data, cc, p[1], p[2], anchors);
        }
    } else if (id === 'mtb') {
        // Public rate page: central Odesa branch; two consecutive currency blocks, then NBU.
        const sectionMatch = text.match(/Курси купівлі-продажу[\s\S]{0,500}?Центрального відділення[\s\S]{0,300}?Купівля\s+Продаж\s+([\s\S]{1,800}?)(?=Офіційний курс гривні)/i);
        if (!sectionMatch) return null;
        const rows = [...sectionMatch[1].matchAll(/\b(USD|EUR|GBP|PLN)\s+(\d{1,3}(?:[.,]\d{1,5})?)\s+UAH\b/gi)];
        const half = rows.length / 2;
        if (!Number.isInteger(half) || half < 2 || rows.slice(0, half).some((r,i)=>r[1]!==rows[i+half][1])) return null;
        for (let i=0;i<half;i++) putPair(data, rows[i][1], rows[i][2], rows[i+half][2], anchors);
        branch = 'Центральне відділення, Одеса';
    } else if (id === 'ukrsib') {
        // Explicit order of the public five-column table: online buy, cash buy, online sell, cash sell, NBU.
        const first = text.match(/USD\s+Долар\s+США\s+Купівля online\s+(\d{1,3}[.,]\d{1,5})\s+Купівля готівкою\s+(\d{1,3}[.,]\d{1,5})\s+Продаж online\s+(\d{1,3}[.,]\d{1,5})\s+Продаж готівкою\s+(\d{1,3}[.,]\d{1,5})\s+НБУ\s+(\d{1,3}[.,]\d{1,5})/i);
        if (!first) return null;
        putPair(data,'USD',first[2],first[4],anchors);
        const rest = text.slice(first.index+first[0].length,first.index+first[0].length+500);
        for (const [cc,name] of Object.entries({EUR:'Євро',GBP:'Фунт стерлінгів',PLN:'Польський злотий'})) {
            const re=new RegExp('\\b'+cc+'\\s+'+name+'\\s+'+Array(5).fill('(\\d{1,3}[.,]\\d{1,5})').join('\\s+')+'(?=\\s|$)','i');
            const row=rest.match(re);if(row)putPair(data,cc,row[2],row[4],anchors);
        }
    } else if (id === 'pravex') {
        m = text.match(/Дата:\s*(\d{2}\.\d{2}\.\d{4})\s+Готівка\s+НБУ\s+Картки[\s\S]{0,180}?Валюта\s+Купівля\s+Продаж\s+([\s\S]{1,650}?)(?=Вигідно|$)/i);
        if (!m) return null;
        rateDate = pageDate(m[1]); namedRows(m[2]);
    } else if (id === 'altbank') {
        m = text.match(/Відділення\s+Операції онлайн\s+Купівля для депозиту\s+Для карток\s+([\s\S]{1,400})/i);
        if (!m) return null;
        for (const cc of BANK_CURRENCIES) {
            const p = m[1].match(new RegExp(`\\b${cc}\\s*\\/\\s*UAH\\s+Purchase\\s+${amount}\\s+Sale\\s+${amount}(?=\\s|$)`, 'i'));
            if (p) putPair(data, cc, p[1], p[2], anchors);
        }
    } else if (id === 'agroprosperis') {
        m = text.match(/на сьогодні,?\s*(\d{2}\.\d{2}\.\d{4})[\s\S]{0,400}?Курс валют для готівкових операцій[\s\S]{0,250}?Валюта\s+Код\s+купівля\s+продаж\s+([\s\S]{1,300}?)(?=Відділення банку|$)/i);
        if (!m) return null;
        rateDate = pageDate(m[1]);
        for (const [cc, name] of Object.entries(names)) {
            const p = m[2].match(new RegExp(`${name}\\s+${cc}\\s+${amount}\\s+${amount}(?=\\s|$)`, 'i'));
            if (p) putPair(data, cc, p[1], p[2], anchors);
        }
    } else if (id === 'clearing') {
        m = text.match(/Курс валют в касі банку станом на\s+(\d{2}\.\d{2}\.\d{4})\s*-\s*([^]*?)\s+Валюти\s+Купівля\s+Продаж\s+НБУ\s+([\s\S]*?)Курс конвертації по карткам/i);
        if (!m || !/Головний офіс,\s*м\.\s*Київ/i.test(m[2])) return null;
        rateDate = pageDate(m[1]); branch = m[2].trim(); namedRows(m[3], true);
    } else if (id === 'credit-dnipro') {
        m = text.match(/КУРСИ ВАЛЮТ ПРИ ПРОВЕДЕННІ ТРАНЗАКЦІЙ ЗА ПЛАТІЖНИМИ КАРТКАМИ НА\s+(\d{2}\.\d{2}\.\d{4})\s+Купівля\s+Продаж\s+([\s\S]*?)КУРС ГРИВНІ ПО ВІДНОШЕННЮ/i);
        if (!m) return null;
        rateDate = pageDate(m[1]); rateType = 'card';
        for (const cc of BANK_CURRENCIES) {
            const p = m[2].match(new RegExp(`\\b${cc}\\s*\\/\\s*UAH\\s+${amount}\\s+${amount}(?=\\s|$)`, 'i'));
            if (p) putPair(data, cc, p[1], p[2], anchors);
        }
    } else return null;
    if (!['altbank','mtb','ukrsib'].includes(id) && !isFreshDate(rateDate, now)) return null;
    if (!usableRates(data)) return null;
    return { data, rateType, rateDate, ...(branch ? { branch } : {}) };
}

async function runParallel(items, parallelism, fn) {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(parallelism, items.length) }, async () => {
        while (cursor < items.length) {
            const item = items[cursor++];
            await fn(item);
        }
    });
    await Promise.all(workers);
}

async function saveOfficialBanks() {
    const anchors = await getNbuAnchors();
    const pendingPlaywright = [];
    const statuses = {};
    const restrictedUrls = new Map();
    let saved = 0;
    const filter = (process.env.NBU_BANK_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
    const selected = filter.length ? OFFICIAL_BANK_SOURCES.filter(b => filter.includes(b.id)) : OFFICIAL_BANK_SOURCES;
    const statusFile = process.env.NBU_BANK_STATUS_FILE || 'bank-fetch-status.json';
    console.log(`banks   : перевіряємо ${selected.length} банків, тільки офіційні сайти`);

    const persist = async (bank, result, url, via, html, meta = {}) => {
        // Для банків з датованими офіційними таблицями не робимо старий курс «новим».
        const rateDate = meta.rateDate ?? publishedBankDate(bank.id, html);
        if (rateDate) {
            const ageDays = Math.floor((Date.now() - new Date(rateDate + 'T00:00:00Z').getTime()) / 86400000);
            if (ageDays > 4 || ageDays < -1) {
                const reason = `Офіційна таблиця за ${rateDate} (вік ${ageDays} днів), поточних курсів немає`;
                statuses[bank.id] = { status: 'not_updated', reason, source: url, rateDate };
                console.log(`bank    : ${bank.id} → ${reason}; старий JSON збережено`);
                return false;
            }
        }
        // Наявні назви файлів та схема {updatedAt, source, data} збережені.
        const { rateDate: _date, ...extra } = meta;
        await writeJson(bank.id, result, { source: new URL(url).hostname, via, ...(rateDate ? { rateDate } : {}), ...extra });
        statuses[bank.id] = { status: 'updated', source: url, via, currencies: Object.keys(result), rateDate, ...(meta.rateType ? { rateType: meta.rateType } : {}), ...(meta.branch ? { branch: meta.branch } : {}) };
        saved++;
        console.log(`bank    : ${bank.id} → ${Object.keys(result).join(', ')} [${via}]${rateDate ? ' курс за '+rateDate : ''}`);
        return true;
    };

    // Швидкі HTTP-запити виконуємо паралельно, але з обмеженням навантаження.
    await runParallel(selected, 4, async bank => {
        // Known API sources take priority. Never replace a failed typed API with an ambiguous HTML rate.
        if (Object.hasOwn(BANK_API_URLS, bank.id)) {
            const url = BANK_API_URLS[bank.id];
            try {
                const { data, ...meta } = await getBankApiRates(bank.id, anchors);
                await persist(bank, data, url, 'api', '', meta);
            } catch (e) { statuses[bank.id] = { status: 'not_updated', reason: e.message, source: url }; }
            return;
        }
        // These public pages were verified through ordinary Chromium navigation on GitHub.
        if (Object.hasOwn(BANK_PAGE_ADAPTERS, bank.id)) {
            pendingPlaywright.push({ ...bank, urls: [BANK_PAGE_ADAPTERS[bank.id]], dedicatedPage: true });
            statuses[bank.id] = { status: 'not_updated', reason: 'Очікується Chromium' };
            return;
        }
        if (bank.id === 'vostok') {
            statuses[bank.id] = { status: 'not_updated', reason: 'Знайдено лише курс НБУ, не банківський курс купівлі/продажу' };
            return;
        }
        let error = 'Не знайдено перевірених курсів у HTML';
        let hadAccessiblePage = false;
        let hadForbiddenPage = false;
        const pageErrors = [];
        for (const url of bank.urls) {
            try {
                const html = await fetchText(url, 12000);
                hadAccessiblePage = true;
                const parsed = bankPageRates(bank.id, html, anchors);
                if (parsed && await persist(bank, parsed, url, 'html', html)) return;
            } catch (e) {
                pageErrors.push(`${url}: ${e.message}`);
                if (/HTTP 403|HTTP 401/.test(e.message)) {
                    hadForbiddenPage = true;
                    if (!restrictedUrls.has(bank.id)) restrictedUrls.set(bank.id, new Set());
                    restrictedUrls.get(bank.id).add(url);
                }
            }
        }
        error = hadAccessiblePage ? 'Сторінку завантажено, але курси не розпізнані' : (pageErrors.join('; ') || error);
        statuses[bank.id] = { status: 'not_updated', reason: statuses[bank.id]?.reason || error };
        if (hadAccessiblePage || !hadForbiddenPage) pendingPlaywright.push(bank);
        else console.log(`bank    : ${bank.id} → ${error}, старий JSON збережено`);
    });

    if (pendingPlaywright.length) {
        let browser;
        try {
            const { chromium } = await import('playwright');
            browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        } catch (e) {
            console.log(`banks   : Chromium недоступний (${e.message}); зберігаємо попередні JSON`);
        }
        if (browser) {
            try {
                await runParallel(pendingPlaywright, 3, async bank => {
                    const page = await browser.newPage({ locale: 'uk-UA' });
                    let error = 'Не знайдено перевірених курсів після JavaScript';
                    try {
                        for (const url of bank.urls) {
                            if (restrictedUrls.get(bank.id)?.has(url)) continue;
                            try {
                                const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: ['altbank','komin'].includes(bank.id) ? 35000 : 22000 });
                                if (!response || response.status() >= 400) {
                                    error = `${url}: HTTP ${response?.status() ?? 'unknown'}`;
                                    continue;
                                }
                                await page.waitForTimeout(bank.dedicatedPage || ['ukrsib','asvio','mtb','komin'].includes(bank.id) ? 5500 : 1500);
                                const text = await page.locator('body').innerText({ timeout: 5000 });
                                const html = await page.content();
                                if (bank.dedicatedPage) {
                                    const expectedHost = new URL(url).hostname.replace(/^www\./, '');
                                    const finalHost = new URL(page.url()).hostname.replace(/^www\./, '');
                                    if (finalHost !== expectedHost) { error = 'Неочікуване перенаправлення'; continue; }
                                    const parsed = parseBankPageAdapter(bank.id, text, anchors);
                                    if (parsed) {
                                        const { data, ...meta } = parsed;
                                        if (await persist(bank, data, url, 'browser', html, meta)) return;
                                    }
                                    error = 'Не знайдено перевірених актуальних курсів USD/EUR у потрібному блоці';
                                    continue;
                                }
                                const parsed = bankPageRates(bank.id, html, anchors) || bankPageRates(bank.id, text, anchors, true);
                                if (parsed && await persist(bank, parsed, url, 'browser', html)) return;
                            } catch (e) { error = `${url}: ${e.message}`; }
                        }
                        statuses[bank.id] = { status: 'not_updated', reason: error };
                    } finally { await page.close(); }
                });
            } finally { await browser.close(); }
        }
    }

    for (const bank of selected) {
        if (statuses[bank.id]?.status !== 'updated') {
            const prev = await readJson(bank.id);
            const status = statuses[bank.id] || { status: 'not_updated', reason: 'Немає доступних джерел' };
            statuses[bank.id] = { ...status, previousUpdatedAt: prev?.updatedAt ?? null, previousSource: prev?.source ?? null };
            console.log(`bank    : ${bank.id} → не оновлено; ${status.reason || 'немає курсу'}; старі дані збережено`);
        }
    }
    const report = {
        checkedAt: new Date().toISOString(),
        runId: process.env.GITHUB_RUN_ID || null,
        updated: saved,
        refreshed: saved,
        total: selected.length,
        notUpdated: selected.length - saved,
        banks: statuses,
        errors: Object.fromEntries(Object.entries(statuses).filter(([,v]) => v.status !== 'updated').map(([id,v])=>[id,v.reason||'Немає перевірених курсів'])) ,
        note: 'Жодні попередні JSON не видаляються та не отримуються зі сторонніх агрегаторів.'
    };
    await fs.writeFile(path.join(DATA_DIR, statusFile), JSON.stringify(report, null, 2) + '\n');
    console.log(`banks   : офіційні джерела — ${saved}/${selected.length} оновлено; звіт data/${statusFile}`);
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

    console.log('kuna    : усі адреси не відповіли, попередні дані залишено без змін');
    await fs.writeFile(path.join(DATA_DIR, 'kuna-status.json'), JSON.stringify({checkedAt:new Date().toISOString(),status:'not_updated',attempts},null,2)+'\n');
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

/* ─────────────── Run ─────────────── */

const mode = process.env.NBU_FETCH_MODE || 'all';
console.log(`Оновлення NBU Rate (режим: ${mode})`);

if (mode === 'banks') {
    await saveOfficialBanks();
} else if (mode === 'extras') {
    const tasks = [
        ['kuna', saveKuna],
        ['whitebit', saveWhitebit],
        ['liqpay', saveLiqPay],
        ['nbu-history', saveNBUHistory]
    ];
    for (const [name, fn] of tasks) {
        try { await fn(); } catch (e) { console.error(`ПОМИЛКА ${name}: ${e.message}`); }
    }
} else if (mode === 'all') {
    const tasks = [
        ['nbu', saveNBU],
        ['privat', savePrivat],
        ['mono', saveMono],
        ['kuna', saveKuna],
        ['whitebit', saveWhitebit],
        ['liqpay', saveLiqPay]
    ];
    const results = await Promise.allSettled(tasks.map(([, fn]) => fn()));
    results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`ПОМИЛКА ${tasks[i][0]}: ${r.reason?.message}`);
    });
    await saveOfficialBanks().catch(e => console.error('ПОМИЛКА банки: ' + e.message));
    await saveNBUHistory().catch(e => console.error('ПОМИЛКА історія НБУ: ' + e.message));
    await import('./fetch-core.mjs').catch(e => console.error('ПОМИЛКА поточні курси: ' + e.message));
    await import('./fetch-crypto-history.mjs').catch(e => console.error('ПОМИЛКА історія криптовалют: ' + e.message));
} else {
    throw new Error(`Невідомий режим: ${mode}`);
}
console.log('Завершено.');
