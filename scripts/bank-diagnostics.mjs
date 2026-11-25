import { mkdir, writeFile } from 'node:fs/promises';

// Combined diagnostics: metadata for first-party public endpoints, samples for known currency APIs.
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
const sampleSources = {
  sense: ['https://sensebank.ua/currency-exchange', ['https://sensebank.ua/api/currency/archive']],
  'a-bank': ['https://a-bank.com.ua/', ['https://a-bank.com.ua/backend/api/v1/rates', 'https://a-bank.com.ua/backend/api/v1/legal/rates']],
  tas: ['https://tascombank.ua/', ['https://tascombank.ua/api/currencies/v2']],
  vostok: ['https://vstbank.ua/', ['https://vstbank.ua/api/api/GetCurrencyRates']],
  procredit: ['https://procreditbank.com.ua/kursi-valyut', ['https://procreditbank.com.ua/api/v1/currency/last', 'https://procreditbank.com.ua/api/v1/currency']],
  sky: ['https://sky.bank/uk/currency', ['https://api.sky.bank/currency/get-offices-currency-rates', 'https://api.sky.bank/currency/get-card-currency-rates']],
  pravex: ['https://www.intesasanpaolobank.ua/kursy-valyut', []],
  mtb: ['https://mtb.ua/currency', []],
  'credit-dnipro': ['https://creditdnepr.com.ua/currency', []],
  altbank: ['https://altbank.ua/en', []],
  agroprosperis: ['https://ap-bank.com/page/kurs-valjut-na-sogodni', []],
  clearing: ['https://www.clhs.com.ua/ua/kursi-valyut', ['https://clhs.com.ua/dates/json']],
  ukrsib: ['https://ukrsibbank.com/currency-cash/', []],
  asvio: ['https://www.asviobank.ua/', []],
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
const knownParams = /^(onDate|fromDate|toDate|date|startDate|endDate|dateFrom|dateTo|currencyFrom|currencyTo|currency|currencyCode|rate|rateType|type|limit|offset|page|perPage|department_id|departmentId)$/i;
const safeValue = v => ['string','number','boolean'].includes(typeof v) && /^[\w .:+,/-]{1,80}$/.test(String(v));
function requestParams(obj) {
  return Object.fromEntries(Object.entries(obj || {}).filter(([k,v]) => knownParams.test(k) && safeValue(v)));
}
const privateKey = /token|secret|password|authorization|cookie|session|csrf|api.?key|request.?ref|response.?ref|email|phone|address|account|iban|passport|client.?id|user.?id|card.?number/i;
function sample(value, depth = 0) {
  if (depth > 12) return '[depth limit]';
  if (Array.isArray(value)) return value.slice(0, 40).map(v => sample(v, depth+1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0,100).filter(([k]) => !privateKey.test(k)).map(([k,v]) => [k,sample(v,depth+1)]));
  if (typeof value === 'string') return value.slice(0, 300);
  return value;
}
const currency = /\b(?:USD|EUR|GBP|PLN|CHF|UAH)\b|долар|євро|злот|фунт|dollar|euro/i;
const rates = /купівл|продаж|купити|продати|\bbuy\b|\bsell\b|курс|exchange rate/i;
const dir = 'diagnostics';
await mkdir(dir, {recursive:true});
const report = {checkedAt:new Date().toISOString(), selected: selected.map(([id])=>id), banks:[]};
const save = () => writeFile(`${dir}/bank-api-report.json`, JSON.stringify(report,null,2)+'\n');
await save();
const { chromium } = await import('playwright');
const browser = await chromium.launch({headless:true});
try {
  for (const [id,url] of selected) {
    const endpoints = sampleSources[id]?.[1] ?? [];
    const host = new URL(url).hostname.replace(/^www\./, '');
    const entry = {id,source:url,status:null,finalUrl:null,currencyText:false,rateText:false,endpoints:[],api:[],tables:[],textLines:[],errors:[]};
    const context = await browser.newContext({locale:'uk-UA',timezoneId:'Europe/Kyiv'});
    const page = await context.newPage();
    const pending = new Set();
    const seen = new Set();
    const seenMetadata = new Set();
    let accepting = true;
    page.on('response', res => {
      if (!accepting) return;
      const req = res.request();
      const u = new URL(res.url());
      if (!['xhr','fetch'].includes(req.resourceType())) return;
      const endpoint = u.origin+u.pathname;
      const known = endpoints.includes(endpoint);
      if (!known && u.hostname !== host && !u.hostname.endsWith('.'+host)) return;
      const type = res.headers()['content-type'] || '';
      const metadataKey = JSON.stringify([req.method(),endpoint,res.status(),[...u.searchParams.keys()].sort()]);
      if (!seenMetadata.has(metadataKey) && entry.endpoints.length < 100 && (known || /json/i.test(type) || currency.test(u.pathname) || rates.test(u.pathname))) {
        seenMetadata.add(metadataKey);
        entry.endpoints.push({url:endpoint,method:req.method(),status:res.status(),type,queryKeys:[...new Set(u.searchParams.keys())].filter(k=>!privateKey.test(k)),currencyHint:currency.test(u.pathname),rateHint:rates.test(u.pathname)});
      }
      // Capture JSON samples only from the previously observed currency endpoints.
      if (!known) return;
      const task = (async () => {
        const query = requestParams(Object.fromEntries(u.searchParams));
        let body = {}, bodyKeys = [];
        if (req.method() === 'POST') {
          try { const obj = req.postDataJSON(); if (obj && typeof obj === 'object' && !Array.isArray(obj)) { body = requestParams(obj); bodyKeys = Object.keys(obj).filter(k => !privateKey.test(k)); } } catch {}
        }
        const key = JSON.stringify([req.method(),u.origin+u.pathname,query,body,res.status()]);
        if (seen.has(key) || entry.api.length >= 20) return;
        seen.add(key);
        const item = {url:u.origin+u.pathname,method:req.method(),status:res.status(),query,queryKeys:[...new Set(u.searchParams.keys())].filter(k=>!privateKey.test(k)), ...(req.method()==='POST'?{body,bodyKeys}:{})};
        entry.api.push(item);
        if (res.ok() && /json/i.test(res.headers()['content-type'] || '')) {
          try {
            if (Number(res.headers()['content-length'] || 0)>2000000) { item.error='Response too large'; return; }
            const txt=await res.text();
            if (txt.length>2000000) {item.error='Response too large';return;}
            const data=JSON.parse(txt);
            item.sample=sample(data);
            if (JSON.stringify(item.sample).length>200000) { item.sample=undefined; item.error='Sample too large'; }
          } catch(e) { item.error=String(e.message).split('\n')[0]; }
        }
      })().catch(e=>entry.errors.push(String(e.message).split('\n')[0]));
      pending.add(task); task.finally(()=>pending.delete(task));
    });
    try {
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
      entry.status=response?.status() ?? null;
      const final = new URL(page.url());
      entry.finalUrl = final.origin + final.pathname;
      if (entry.status >= 200 && entry.status < 400) {
        await page.waitForTimeout(8000);
        const tables=await page.locator('table').evaluateAll(nodes=>nodes.slice(0,40).map(t=>Array.from(t.querySelectorAll('tr')).slice(0,40).map(r=>Array.from(r.querySelectorAll('th,td')).slice(0,20).map(c=>c.innerText.trim().slice(0,150)))));
        entry.tables=tables.filter(t=>currency.test(JSON.stringify(t)) && rates.test(JSON.stringify(t))).slice(0,8);
        const lines=(await page.locator('body').innerText({timeout:5000})).split(/\n/).map(x=>x.trim()).filter(Boolean);
        entry.currencyText=currency.test(lines.join(" "));
        entry.rateText=rates.test(lines.join(" "));
        const idx=new Set();
        for (let i=0;i<lines.length;i++) if(currency.test(lines[i]) || rates.test(lines[i])) for(let j=Math.max(0,i-2);j<=Math.min(lines.length-1,i+4);j++) idx.add(j);
        entry.textLines=[...idx].sort((a,b)=>a-b).slice(0,180).map(i=>lines[i].slice(0,200));
      }
    } catch(e) {entry.errors.push(String(e.message).split('\n')[0]);}
    finally {
      accepting=false;
      await Promise.race([Promise.allSettled([...pending]),new Promise(r=>setTimeout(r,5000))]);
      await context.close();
    }
    report.banks.push(entry);
    await save();
    console.log(`${id}: HTTP ${entry.status ?? '—'}, endpoints: ${entry.endpoints.length}, samples: ${entry.api.length}, tables: ${entry.tables.length}, lines: ${entry.textLines.length}`);
  }
} finally { await browser.close(); }
