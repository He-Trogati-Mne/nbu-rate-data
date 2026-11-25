import { mkdir, writeFile } from 'node:fs/promises';

// Only bank-owned public pages; no proxy, authentication or challenge bypass.
const banks = {
  raif: 'https://raiffeisen.ua/currency',
  ukrsib: 'https://ukrsibbank.com/currency-cash/',
  sense: 'https://sensebank.ua/currency-exchange',
  pivdenny: 'https://bank.com.ua/currency-metals-rates',
  lviv: 'https://www.banklviv.com/',
  'a-bank': 'https://a-bank.com.ua/',
  pravex: 'https://www.intesasanpaolobank.ua/kursy-valyut',
  tas: 'https://tascombank.ua/',
  idea: 'https://ideabank.ua/uk',
  komin: 'https://cib.com.ua/uk',
  industrial: 'https://industrialbank.ua/',
  asvio: 'https://www.asviobank.ua/',
  vostok: 'https://vstbank.ua/',
  mtb: 'https://mtb.ua/currency',
  'credit-dnipro': 'https://creditdnepr.com.ua/currency',
  procredit: 'https://procreditbank.com.ua/kursi-valyut',
  altbank: 'https://altbank.ua/en',
  universal: 'https://www.universalbank.com.ua/',
  agroprosperis: 'https://ap-bank.com/page/kurs-valjut-na-sogodni',
  avangard: 'https://avgd.ua/',
  bizbank: 'https://www.bisbank.com.ua/kurs-valyut/kyyiv/',
  oksi: 'https://oxibank.ua/',
  family: 'https://www.fbank.com.ua/',
  'trust-capital': 'https://www.tc-bank.com/',
  clearing: 'https://www.clhs.com.ua/ua/kursi-valyut',
  sky: 'https://sky.bank/uk/currency',
};
// Empty input, all, or * selects all 26 diagnostic banks.
const raw = (process.env.BANK_IDS ?? '').trim();
const tokens = [...new Set(raw.toLowerCase().split(/[,;\s]+/u)
  .map(id => id.replace(/[\u2010-\u2015\u2212]/g, '-'))
  .filter(Boolean))];
const all = !tokens.length || (tokens.length === 1 && ['all', '*', 'all 26'].includes(tokens[0])) || /^all\s+26$/i.test(raw);
const unknown = all ? [] : tokens.filter(id => !Object.hasOwn(banks, id));
const wanted = all ? Object.keys(banks) : tokens.filter(id => Object.hasOwn(banks, id));
if (unknown.length) {
  console.warn(`::warning::Unknown BANK_IDS ignored: ${JSON.stringify(unknown)}`);
  console.log(`Available IDs: ${Object.keys(banks).join(', ')}`);
}
if (!wanted.length) {
  console.error('No valid bank IDs. Leave the banks field empty or enter all to check all 26 banks.');
  process.exit(1);
}
const selected = Object.entries(banks).filter(([id]) => wanted.includes(id));
console.log(`Selected ${selected.length}/${Object.keys(banks).length} banks: ${selected.map(([id]) => id).join(', ')}`);
if (process.argv.includes('--dry-run')) process.exit(0);
const report = [];
const currency = /\b(?:USD|EUR|GBP|PLN|CHF|UAH)\b|долар|євро|валют/i;
const rate = /rate|currency|exchange|forex|курс|купівл|продаж|\bbuy\b|\bsell\b/i;
function safeURL(raw) {
  const u = new URL(raw);
  // Do not store query values, fragments, cookies or headers.
  return { url: u.origin + u.pathname, queryKeys: [...new Set(u.searchParams.keys())] };
}
const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true });
try {
  for (const [id, url] of selected) {
    const context = await browser.newContext({ locale: 'uk-UA', timezoneId: 'Europe/Kyiv' });
    const page = await context.newPage();
    const host = new URL(url).hostname.replace(/^www\./, '');
    const result = { id, source: url, status: null, currencyText: false, rateText: false, endpoints: [], errors: [] };
    const jobs = new Set();
    const seen = new Set();
    let accepting = true;
    page.on('response', response => {
      if (!accepting) return;
      const request = response.request();
      const kind = request.resourceType();
      const u = new URL(response.url());
      if (!(u.hostname === host || u.hostname.endsWith('.' + host))) return;
      if (!['xhr', 'fetch'].includes(kind)) return;
      const task = (async () => {
        const type = response.headers()['content-type'] || '';
        const info = safeURL(response.url());
        const method = request.method();
        const key = method + ' ' + info.url + ' ' + response.status();
        if (seen.has(key)) return;
        seen.add(key);
        const item = { ...info, method, status: response.status(), type, currencyHint: currency.test(u.pathname), rateHint: rate.test(u.pathname) };
        if (response.ok() && /json/i.test(type)) {
          try {
            const contentLength = Number(response.headers()['content-length'] || 0);
            if (!contentLength || contentLength <= 1000000) {
              const body = await response.text();
              if (body.length <= 1000000) {
                item.currencyHint ||= currency.test(body);
                item.rateHint ||= rate.test(body);
                const data = JSON.parse(body);
                const obj = Array.isArray(data) ? data[0] : data;
                if (obj && typeof obj === 'object') item.keys = Object.keys(obj).slice(0, 30);
              }
            }
          } catch { /* response may not be readable */ }
        }
        if (item.currencyHint || item.rateHint || /json/i.test(type)) result.endpoints.push(item);
      })().catch(() => {});
      jobs.add(task);
      task.finally(() => jobs.delete(task));
    });
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      result.status = response?.status() ?? null;
      result.finalUrl = safeURL(page.url()).url;
      // Do not retry or interact with access-denied/challenge pages.
      if (result.status && result.status < 400) {
        await page.waitForTimeout(5000);
        const body = await page.locator('body').innerText({ timeout: 5000 });
        result.currencyText = currency.test(body);
        result.rateText = rate.test(body);
      }
    } catch (error) {
      result.errors.push(String(error.message).split('\n')[0]);
    } finally {
      accepting = false;
      await Promise.race([Promise.allSettled([...jobs]), new Promise(resolve => setTimeout(resolve, 5000))]);
      await context.close();
    }
    result.endpoints.sort((a,b) => Number(b.currencyHint && b.rateHint) - Number(a.currencyHint && a.rateHint));
    report.push(result);
    console.log(`${id}: HTTP ${result.status ?? '—'}, API candidates: ${result.endpoints.length}`);
    for (const item of result.endpoints.filter(x => x.currencyHint || x.rateHint)) {
      console.log(`  ${item.method} ${item.url} HTTP ${item.status}`);
    }
  }
} finally { await browser.close(); }
await mkdir('diagnostics', { recursive: true });
await writeFile('diagnostics/bank-api-report.json', JSON.stringify({ checkedAt: new Date().toISOString(), banks: report }, null, 2) + '\n');
