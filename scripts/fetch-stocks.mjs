import fs from 'node:fs/promises';
import { tickers } from './stock-catalog.mjs';
const DIR='data', FILE=DIR+'/stocks.json', source='Yahoo Finance chart (unofficial, delayed)';
await fs.mkdir(DIR,{recursive:true});
async function read(p, fallback){try{return JSON.parse(await fs.readFile(p,'utf8'));}catch{return fallback;}}
async function save(p,x){await fs.writeFile(p+'.tmp',JSON.stringify(x));await fs.rename(p+'.tmp',p);}
const previous=await read(FILE,{data:{}}), data={...previous.data};
const errors={}, info={};let updates=0, unchanged=0, older=0, limited=false;
const now=new Date(), checkedAt=now.toISOString(), day=86400000;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const full=process.env.NBU_STOCK_BACKFILL==='1';
function valid(n){return typeof n==='number'&&Number.isFinite(n)&&n>0;}
async function getYahoo(sym,range){
 const u=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=1d&events=history`;
 for(let i=0;i<2;i++){
  try{const r=await fetch(u,{headers:{'User-Agent':'NBU-Rate-Dataset/1.0','Accept':'application/json'},signal:AbortSignal.timeout(16000)});
   if([401,403,429].includes(r.status)){limited=true;throw Error(`HTTP ${r.status}; access restricted, stopping`);}
   if(r.status>=500&&i===0){await delay(1500);continue;}
   if(!r.ok)throw Error(`HTTP ${r.status}`);
   const body=await r.json(),x=body?.chart?.result?.[0];
   if(x?.meta?.symbol?.toUpperCase()!==sym.toUpperCase()||!x.meta.currency||!Array.isArray(x.timestamp))throw Error('Invalid symbol/currency/history');
   return x;
  }catch(e){if(i===0&&!limited&&/fetch failed|timeout|aborted/i.test(e.message)){await delay(1000);continue;}throw e;}
 }
}
for(const sym of tickers){
 if(limited){errors[sym]='Not requested: provider access limit';continue;}
 const old=data[sym]||{};
 const deep=full||!old.backfillAt||now-Date.parse(old.backfillAt)>30*day;
 const range=deep?'max':'1mo';
 try{
  const x=await getYahoo(sym,'1mo'), q=x.indicators?.quote?.[0]||{}, bars=new Map();
  if(old.currency&&old.currency!==x.meta.currency)throw Error('Currency changed; previous series preserved');
  const tz=x.meta.exchangeTimezoneName||'UTC';
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'});
  for(let i=0;i<x.timestamp.length;i++){
   const ts=x.timestamp[i],p=q.close?.[i];if(!valid(ts)||!valid(p)||ts*1000>+now+300000)continue;
   const dt=formatter.format(new Date(ts*1000));bars.set(dt,{ts,price:Number(p.toFixed(6)),open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],volume:q.volume?.[i]});
  }
  const ordered=[...bars.entries()].sort((a,b)=>a[0].localeCompare(b[0]));if(!ordered.length)throw Error('No valid candles');
  const [lastDate,last]=ordered.at(-1);
  // A daily candle timestamp is the session start, not the last traded time.
  const marketTs=x.meta.regularMarketTime, marketPrice=x.meta.regularMarketPrice;
  const marketValid=valid(marketTs)&&valid(marketPrice)&&marketTs>=last.ts&&marketTs*1000<=+now+300000&&formatter.format(new Date(marketTs*1000))===lastDate;
  const quote=marketValid?{ts:marketTs,price:Number(marketPrice.toFixed(6))}:last;
  const oldTs=Date.parse(old.asOf||'');
  const isOlder=Number.isFinite(oldTs)&&oldTs>quote.ts*1000;
  const isUnchanged=Number.isFinite(oldTs)&&oldTs===quote.ts*1000&&old.price===quote.price;
  const history={...old.history};let backfillOk=false,backfillError=null,backfillGranularity=null;
  if(deep){try{const h=await getYahoo(sym,'max');if(h.meta.currency!==x.meta.currency)throw Error('Backfill currency mismatch');backfillGranularity=h.meta.dataGranularity||null;const closes=h.indicators?.quote?.[0]?.close||[];for(let i=0;i<h.timestamp.length;i++){const ts=h.timestamp[i],price=closes[i];if(!valid(ts)||!valid(price)||ts*1000>+now+300000)continue;const dt=formatter.format(new Date(ts*1000));if(!valid(history[dt]))history[dt]=Number(price.toFixed(6));}backfillOk=true;}catch(e){backfillError=e.message;}}
  for(const [dt,b] of ordered)if(!valid(history[dt])||(!isOlder&&dt===lastDate))history[dt]=b.price;
  const prior=Object.entries(history).filter(([dt,p])=>dt<lastDate&&valid(p)).sort((a,b)=>b[0].localeCompare(a[0]))[0]?.[1];
  const pct=valid(prior)?Number(((quote.price/prior-1)*100).toFixed(3)):null;
  data[sym]=isOlder?{...old,history,...(backfillOk?{backfillAt:checkedAt}:{}),checkedAt}:{...old,price:quote.price,currency:x.meta.currency,exchange:x.meta.exchangeName||old.exchange||'',name:x.meta.longName||x.meta.shortName||old.name||sym,asOf:new Date(quote.ts*1000).toISOString(),changePct:pct,history,source,...(backfillOk?{backfillAt:checkedAt}:{}),checkedAt};
  const file=DIR+'/stocks-history/'+sym+'.json';await fs.mkdir(DIR+'/stocks-history',{recursive:true});
  const saved=await read(file,{data:{}});const series={...saved.data};
  for(const [dt,b] of ordered){if(series[dt]&&(isOlder||dt!==lastDate))continue;if(x.meta.dataGranularity&&x.meta.dataGranularity!=='1d')continue;if([b.open,b.high,b.low,b.price].every(valid)&&b.high>=Math.max(b.open,b.price)&&b.low<=Math.min(b.open,b.price)&&b.high>=b.low)series[dt]={open:b.open,high:b.high,low:b.low,close:b.price,volume:Number.isFinite(b.volume)&&b.volume>=0?b.volume:null};}
  await save(file,{symbol:sym,currency:x.meta.currency,source,interval:'1d',checkedAt,data:series});
  if(isOlder)older++;else if(isUnchanged)unchanged++;else updates++;info[sym]={status:isOlder?'older_source_preserved':isUnchanged?'unchanged':'updated',range:'1mo',backfillRequested:deep,backfillError,backfillGranularity,granularity:x.meta.dataGranularity||null,days:Object.keys(history).length,first:Object.keys(history).sort()[0],asOf:data[sym].asOf};console.log(sym,info[sym]);
 }catch(e){errors[sym]=e.message;console.warn(sym,e.message);}
 await delay(350);
}
if(Object.keys(data).length)await save(FILE,{...previous,schemaVersion:1,updatedAt:updates?checkedAt:previous.updatedAt,checkedAt,source,data});
await save(DIR+'/stocks-status.json',{checkedAt,updated:updates,unchanged,older,checked:updates+unchanged+older,total:tickers.length,errors,info});
console.log(`Stocks: ${updates} updated, ${unchanged} unchanged, ${older} older preserved, ${Object.keys(errors).length} errors / ${tickers.length}`);if(!updates&&!unchanged&&!older)process.exitCode=1;
