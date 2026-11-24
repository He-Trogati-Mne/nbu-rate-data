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

/* ─────────────── Official Bank Websites (with proxy + Chromium bypass) ─────────────── */

const BANK_CURRENCIES = ['USD', 'EUR', 'GBP', 'PLN'];

const OFFICIAL_BANK_SOURCES = [
    { id: 'oschad',          urls: ['https://www.oschadbank.ua/currency-rate'] },
    { id: 'pumb',            urls: ['https://www.pumb.ua/purchase_currency'] },
    { id: 'raif',            urls: ['https://raiffeisen.ua/currency'] },
    { id: 'ukrsib',          urls: ['https://ukrsibbank.com/currency-cash/'] },
    { id: 'sense',           urls: ['https://sensebank.com.ua/currency-exchange'] },
    { id: 'ukrgas',          urls: ['https://www.ukrgasbank.com/'] },
    { id: 'ukrexim',         urls: ['https://www.eximb.com/ua/business/pryvatnym-klientam/pryvatnym-klientam-inshi-poslugy/obmin-valyut/kursy-valyut/', 'https://www.eximb.com/ua/'] },
    { id: 'pivdenny',        urls: ['https://bank.com.ua/currency-metals-rates', 'https://bank.com.ua/'] },
    { id: 'credit-agricole', urls: ['https://credit-agricole.ua/kurs-valyut', 'https://credit-agricole.ua/'] },
    { id: 'globus',          urls: ['https://globusbank.com.ua/ua/kurs-valyut.html', 'https://globusbank.com.ua/'] },
    { id: 'lviv',            urls: ['https://www.banklviv.com/'] },
    { id: 'a-bank',          urls: ['https://a-bank.com.ua/'] },
    { id: 'kredo',           urls: ['https://kredobank.com.ua/info/kursy-valyut/cards', 'https://kredobank.com.ua/info/kursy-valyut'] },
    { id: 'otp',             urls: ['https://www.otpbank.com.ua/privateclients/pay-cards/currency-converter-cards.php', 'https://www.otpbank.com.ua/'] },
    { id: 'pravex',          urls: ['https://www.pravex.com.ua/kursy-valyut', 'https://www.pravex.com.ua/'] },
    { id: 'tas',             urls: ['https://tascombank.ua/'] },
    { id: 'piraeus',         urls: ['https://www.piraeusbank.ua/', 'https://www.piraeusbank.ua/ua/kursy-valyut-dlya-operatsiy-iz-platizhnymy-kartkamy'] },
    { id: 'idea',            urls: ['https://ideabank.ua/uk', 'https://ideabank.ua/'] },
    { id: 'komin',           urls: ['https://cib.com.ua/uk', 'https://cib.com.ua/uk/private', 'https://cib.com.ua/uk/about/page/informaciya-pro-bank'] },
    { id: 'alliance',        urls: ['https://alb.ua/currency'] },
    { id: 'poltava',         urls: ['https://poltavabank.com/'] },
    { id: 'polikom',         urls: ['https://www.policombank.com/kurs-valjut', 'https://www.policombank.com/'] },
    { id: 'ukrcapital',      urls: ['https://www.ukrcapital.com.ua/'] },
    { id: 'krystal',         urls: ['https://crystalbank.com.ua/', 'https://crystalbank.com.ua/currency'] },
    { id: 'bank34',          urls: ['https://bank34.ua/'] },
    { id: 'grant',           urls: ['https://www.grant.ua/'] },
    { id: 'industrial',      urls: ['https://industrialbank.ua/'] },
    { id: 'asvio',           urls: ['https://www.asviobank.ua/'] },
    { id: 'vostok',          urls: ['https://bankvostok.com.ua/'] },
    { id: 'mtb',             urls: ['https://mtb.ua/'] },
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
    { id: 'bizbank',         urls: ['https://www.bisbank.com.ua/'] },
    { id: 'metabank',        urls: ['https://www.mbank.com.ua/'] },
    { id: 'oksi',            urls: ['https://www.oxibank.ua/'] },
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
    // Якщо різні валюти мають повністю однакові значення, це, найімовірніше,
    // помилка розбору; не перезаписуємо достовірний попередній файл.
    const pairs = Object.values(out);
    if (pairs.length > 1) {
        const unique = new Set(pairs.map(v => `${v.buy}/${v.sell}`));
        if (unique.size !== pairs.length) return null;
    }
    return Object.keys(out).length > 0 ? out : null;
}

// Окремий консервативний парсер для офіційних таблиць Полікомбанку й КОМІНБАНКУ.
// Визначаємо лише готівкові курси — не змішуємо з картковими чи курсом НБУ.
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
    // Важливо: лише пари, що стоять безпосередньо після коду валюти в таблиці.
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
    if (id !== 'polikom' && id !== 'komin') return null;
    const plain = stripHtmlTags(html);
    const re = id === 'polikom'
        ? /Курс\s+валют\s+для\s+готівкових\s+операцій\s+від\s+(\d{2})\.(\d{2})\.(\d{4})/i
        : /Курс\s+валют\s+(\d{2})\.(\d{2})\.(\d{4})/i;
    const m = plain.match(re);
    if (!m) return null;
    const year = Number(m[3]), month = Number(m[2]), day = Number(m[1]);
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) return null;
    return d.toISOString().slice(0, 10);
}

function bankPageRates(id, html, anchors, isPlain = false) {
    return parseDedicatedBankHtml(id, html, anchors, isPlain)
        || parseOfficialBankHtml(html, anchors, isPlain);
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
    let saved = 0;
    const filter = (process.env.NBU_BANK_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
    const selected = filter.length ? OFFICIAL_BANK_SOURCES.filter(b => filter.includes(b.id)) : OFFICIAL_BANK_SOURCES;
    const statusFile = process.env.NBU_BANK_STATUS_FILE || 'bank-fetch-status.json';
    console.log(`banks   : перевіряємо ${selected.length} банків, тільки офіційні сайти`);

    const persist = async (bank, result, url, via, html) => {
        // Для банків з датованими офіційними таблицями не робимо старий курс «новим».
        const rateDate = publishedBankDate(bank.id, html);
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
        await writeJson(bank.id, result, { source: new URL(url).hostname, via, ...(rateDate ? { rateDate } : {}) });
        statuses[bank.id] = { status: 'updated', source: url, via, currencies: Object.keys(result), rateDate };
        saved++;
        console.log(`bank    : ${bank.id} → ${Object.keys(result).join(', ')} [${via}]${rateDate ? ' курс за '+rateDate : ''}`);
        return true;
    };

    // Швидкі HTTP-запити виконуємо паралельно, але з обмеженням навантаження.
    await runParallel(selected, 4, async bank => {
        let error = 'Не знайдено перевірених курсів у HTML';
        let forbidden = false;
        for (const url of bank.urls) {
            try {
                const html = await fetchText(url, 12000);
                const parsed = bankPageRates(bank.id, html, anchors);
                if (parsed && await persist(bank, parsed, url, 'html', html)) return;
            } catch (e) {
                error = `${url}: ${e.message}`;
                if (/HTTP 403|HTTP 401/.test(e.message)) forbidden = true;
            }
        }
        statuses[bank.id] = { status: 'not_updated', reason: statuses[bank.id]?.reason || error };
        // Не намагаємося обійти явно заборонений доступ 401/403.
        if (!forbidden) pendingPlaywright.push(bank);
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
                            try {
                                const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 16000 });
                                if (!response || response.status() >= 400) {
                                    error = `${url}: HTTP ${response?.status() ?? 'unknown'}`;
                                    continue;
                                }
                                await page.waitForTimeout(1200);
                                const text = await page.locator('body').innerText({ timeout: 5000 });
                                const html = await page.content();
                                const parsed = bankPageRates(bank.id, html, anchors) || bankPageRates(bank.id, text, anchors, true);
                                if (parsed && await persist(bank, parsed, url, 'browser', html)) return;
                            } catch (e) { error = `${url}: ${e.message}`; }
                        }
                        statuses[bank.id] = { status: 'not_updated', reason: statuses[bank.id]?.reason || error };
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

const COINS = [
    'bitcoin', 'ethereum', 'tether', 'binancecoin', 'solana',
    'usd-coin', 'ripple', 'cardano', 'dogecoin', 'avalanche-2',
    'tron', 'the-open-network', 'chainlink', 'polkadot', 'litecoin',
    'dai', 'wrapped-bitcoin', 'uniswap', 'near',
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
            image: m.image || existingMap[m.id]?.image || null,
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
    await saveCrypto().catch(e => console.error('ПОМИЛКА криптовалюти: ' + e.message));
} else {
    throw new Error(`Невідомий режим: ${mode}`);
}
console.log('Завершено.');
