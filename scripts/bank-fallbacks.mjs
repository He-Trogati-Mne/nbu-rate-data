// Fallbacks only for failed primary adapters; no proxy, credentials or access-control bypass.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
export const candidates = {
  raif:['https://raiffeisen.ua/en/currency?show=1','https://raiffeisen.ua/currency?show=1'],
  pivdenny:['https://bank.com.ua/en/currency-metals-rates'],
  lviv:['https://banklviv.ua/exchages?info_0=0'],
  idea:['https://ideabank.ua/ru'],
  industrial:['https://industrialbank.ua/ua/'],
  universal:['https://www.universalbank.com.ua/'],
  bizbank:['https://www.bisbank.com.ua/'],
  'trust-capital':['https://tc-bank.com/','https://tc-bank.com/ua/kursy-valyut.html'],
  komin:['https://cib.com.ua/uk'],
  ukrsib:['https://ukrsibbank.com/currency-cash/'],
  mtb:['https://mtb.ua/currency'],
  agroprosperis:['https://ap-bank.com/page/kurs-valjut-na-sogodni'],
  asvio:['https://www.asviobank.ua/'],
};
const CODES=['USD','EUR','GBP','PLN','CHF'];
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const save=async(p,x)=>{await fs.writeFile(p+'.tmp',JSON.stringify(x,null,2)+'\n');await fs.rename(p+'.tmp',p);};
const normalize=s=>String(s??'').trim().replace(/\s+/g,' ');
const buyHead=/^(?:купівл[яі]|покупка|покупки|купити|buy(?:ing)?)(?:\s*\(.*\))?$/iu;
const sellHead=/^(?:продаж[ауі]?|продати|sell(?:ing)?|sale)(?:\s*\(.*\))?$/iu;
const dateValue=s=>{const m=normalize(s).match(/^(\d{2})[./](\d{2})[./](\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:/^\d{4}-\d{2}-\d{2}$/.test(normalize(s))?normalize(s):null;};
const number=s=>/^\d{1,3}(?:[.,]\d{1,8})?$/.test(normalize(s))?Number(normalize(s).replace(',','.')):NaN;
function currency(s){const t=normalize(s).toUpperCase();return CODES.find(c=>t===c||t===`${c}/UAH`||new RegExp(`^${c}\\s*[-–(]`).test(t));}
function pair(b,s,a){const buy=number(b),sell=number(s);return a>0&&buy>=a*.8&&sell<=a*1.32&&sell>=buy&&(sell-buy)/buy<=.12?{buy,sell}:null;}
function complete(d){return d.USD&&d.EUR&&!(d.USD.buy===d.EUR.buy&&d.USD.sell===d.EUR.sell);}
function fresh(d,today){if(!d)return true;const x=Date.parse(d+'T00:00:00Z');return Number.isFinite(x)&&new Date(x).toISOString().slice(0,10)===d&&(Date.parse(today)-x)/86400000>=-1&&(Date.parse(today)-x)/86400000<=4;}
export function parseTables(tables,anchors,today){
 const results=[];
 for(const table of tables){
  const rows=table.rows;let bi=-1,si=-1,di=-1;const byDate=new Map();let invalid=false;
  for(const row of rows){
   const b=row.findIndex(x=>buyHead.test(normalize(x))),s=row.findIndex(x=>sellHead.test(normalize(x)));
   if(b>=0&&s>=0&&b!==s){bi=b;si=s;di=row.findIndex(x=>/^(дата|date)$/i.test(normalize(x)));continue;}
   if(bi<0||si<0)continue;
   const cc=row.map(currency).find(Boolean);if(!cc)continue;
   const d=di<0?null:dateValue(row[di]);if(di>=0&&!d)continue;
   const p=pair(row[bi],row[si],anchors[cc]);if(!p)continue;
   const group=byDate.get(d)||{};
   if(group[cc]&&JSON.stringify(group[cc])!==JSON.stringify(p)){invalid=true;break;}
   group[cc]=p;byDate.set(d,group);
  }
  if(invalid)continue;
  const dates=[...byDate.keys()].sort((a,b)=>String(b).localeCompare(String(a)));const d=dates[0];const data=byDate.get(d);
  if(data&&complete(data)&&fresh(d||table.rateDate,today))results.push({data,rateDate:d||table.rateDate||null,rateType:'bank_buy_sell'});
 }
 // Do not choose arbitrarily between different cash/card/online tables.
 if(!results.length)return null;
 if(results.some(x=>CODES.some(c=>JSON.stringify(x.data[c])!==JSON.stringify(results[0].data[c]))))return null;
 return results[0];
}
export function parseRaif(rows,anchors){
 const data={};
 for(const r of rows){const cc=currency(r.left);if(!cc)continue;const m=normalize(r.right).match(/^(\d{1,3}[.,]\d{1,8})\s*\/\s*(\d{1,3}[.,]\d{1,8})$/);if(!m)continue;const p=pair(m[1],m[2],anchors[cc]);if(!p)continue;if(data[cc]&&JSON.stringify(data[cc])!==JSON.stringify(p))return null;data[cc]=p;}
 return complete(data)?{data,rateDate:null,rateType:'cash'}:null;
}
async function main(){
 const original=await read('data/bank-fetch-status.json');const start=process.env.NBU_UPDATE_STARTED;
 if(start&&Date.parse(original.checkedAt)<Date.parse(start))throw Error('Primary bank report is not current');
 const nbu=await read('data/nbu.json');const anchors=Object.fromEntries(nbu.data.filter(x=>CODES.includes(x.cc)).map(x=>[x.cc,Number(x.rate)]));
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const report={checkedAt:new Date().toISOString(),runId:process.env.GITHUB_RUN_ID||null,banks:{},updated:0};
 const pending=Object.entries(original.banks).filter(([,v])=>v.status!=='updated');
 let browser;
 try{
  for(const [id,primary] of pending){
   const entry={status:'not_updated',primaryReason:primary.reason,attempts:[]};report.banks[id]=entry;
   if(!candidates[id]){entry.reason=['family','avangard','vostok'].includes(id)?'No independently verified bank buy/sell source configured':'No fallback configured';continue;}
   for(const url of candidates[id]){
    // Respect an explicit refusal or rate limit from the same URL in this run.
    if((primary.reason||'').includes(`${url}: HTTP 403`)||(primary.reason||'').includes(`${url}: HTTP 401`)||/\b429\b/.test(primary.reason||'')){entry.attempts.push({url,status:'skipped_restricted'});continue;}
    const attempt={url};entry.attempts.push(attempt);let context;
    try{
     if(!browser){const {chromium}=await import('playwright');browser=await chromium.launch({headless:true});}
     context=await browser.newContext({locale:'uk-UA',timezoneId:'Europe/Kyiv'});const page=await context.newPage();
     const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:18000});attempt.http=response?.status()??null;
     if(!response||!response.ok()){attempt.status='http_error';continue;}
     if(new URL(page.url()).hostname.replace(/^www\./,'')!==new URL(url).hostname.replace(/^www\./,'')){attempt.status='unexpected_redirect';continue;}
     await page.waitForTimeout(2000);
     const tables=await page.locator('table:visible').evaluateAll(ts=>ts.slice(0,30).map(t=>({rateDate:(()=>{const text=t.parentElement?.innerText||'';const m=text.match(/(?:станом на|на сьогодні|as of|on date)\s*[:,]?\s*(\d{2})\.(\d{2})\.(\d{4})/i);return m?`${m[3]}-${m[2]}-${m[1]}`:null;})(),rows:[...t.rows].filter(r=>r.getClientRects().length).slice(0,250).map(r=>[...r.cells].map(c=>c.innerText.trim()))})));
     let parsed=parseTables(tables,anchors,today);
     if(!parsed&&id==='raif'){
      // Only a labelled cash block with exactly one buy/sell pair per row.
      const blocks=await page.locator('.bank-rate-body__body-block:visible').evaluateAll(bs=>bs.map(b=>({title:b.querySelector('.bank-rate-body__title-block')?.innerText||'',rows:[...b.querySelectorAll('.bank-rate-body__row')].map(r=>({left:r.querySelector('.bank-rate-body__col-left')?.innerText||'',right:r.querySelector('.bank-rate-body__col-right')?.innerText||''}))})));
      const cash=blocks.filter(b=>/^(у касі банку|cash(?: exchange)?(?: at (?:the )?bank)?)$/i.test(b.title.trim()));if(cash.length===1)parsed=parseRaif(cash[0].rows,anchors);
     }
     attempt.tables=tables.length;
     if(!parsed){attempt.status='no_unambiguous_rates';continue;}
     let old;try{old=await read(`data/${id}.json`);}catch(e){if(e.code!=='ENOENT')throw e;}
     if(parsed.rateDate&&old?.rateDate&&parsed.rateDate<old.rateDate){attempt.status='older_than_saved';continue;}
     // A fallback must not silently remove currencies already present in a verified snapshot.
     if(old?.data&&Object.keys(old.data).some(k=>!Object.hasOwn(parsed.data,k))){attempt.status='partial_currency_coverage';continue;}
     const payload={updatedAt:new Date().toISOString(),source:new URL(url).hostname,via:'fallback-browser',sourceUrl:url,rateDate:parsed.rateDate,rateType:parsed.rateType,data:parsed.data};
     await save(`data/${id}.json`,payload);
     Object.assign(entry,{status:'updated',source:url,via:'fallback-browser',currencies:Object.keys(parsed.data),rateDate:parsed.rateDate});attempt.status='updated';
     original.banks[id]={...entry};report.updated++;break;
    }catch(e){attempt.status='error';attempt.reason=String(e.message).split('\n')[0];}finally{await context?.close().catch(()=>{});}
   }
   if(entry.status!=='updated'){entry.reason=entry.attempts.at(-1)?.status||'No verified rate';original.banks[id].fallback=entry;}
   console.log(`fallback: ${id}: ${entry.status} (${entry.attempts.map(a=>`${a.http??''} ${a.status}`).join('; ')||entry.reason})`);
  }
 }finally{await browser?.close();}
 original.primaryUpdated=original.updated;original.updated=Object.values(original.banks).filter(x=>x.status==='updated').length;original.refreshed=original.updated;original.notUpdated=original.total-original.updated;original.errors=Object.fromEntries(Object.entries(original.banks).filter(([,x])=>x.status!=='updated').map(([id,x])=>[id,x.reason]));original.fallbackUpdated=report.updated;
 await save('data/bank-fetch-status.json',original);await save('data/bank-fallback-status.json',report);
}
if(process.argv.includes('--self-test')){
 const a={USD:45,EUR:50,GBP:59};const t='2026-11-27';const table={rows:[['Валюта','Купівля','Продаж','НБУ'],['USD','44,90','45,50','45,20'],['EUR','49,50','50,10','49,80']]};
 assert.equal(parseTables([table],a,t).data.USD.buy,44.9);assert.equal(parseTables([{rows:[['Валюта','НБУ'],['USD','45'],['EUR','50']]}],a,t),null);assert.equal(parseTables([table,{rows:[['Валюта','Купівля','Продаж'],['USD','44','45'],['EUR','49','50']]}],a,t),null);assert.equal(parseTables([{rows:[['Дата','Валюта','Купівля','Продаж'],['20.11.2026','USD','44','45'],['20.11.2026','EUR','49','50']]}],a,t),null);assert.equal(parseRaif([{left:'USD/UAH',right:'44.9 / 45.5'},{left:'EUR/UAH',right:'49.5 / 50.1'}],a).data.EUR.sell,50.1);console.log('Bank fallback tests passed');
}else if(process.argv[1]?.endsWith('bank-fallbacks.mjs'))await main();
