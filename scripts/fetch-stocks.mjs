import fs from 'node:fs/promises';
import { tickers } from './stock-catalog.mjs';
const DIR='data', FILE=DIR+'/stocks.json', source='Yahoo Finance chart (unofficial, delayed)';
await fs.mkdir(DIR,{recursive:true});
async function read(p, fallback){try{return JSON.parse(await fs.readFile(p,'utf8'));}catch{return fallback;}}
async function save(p,x){await fs.writeFile(p+'.tmp',JSON.stringify(x));await fs.rename(p+'.tmp',p);}
const previous=await read(FILE,{data:{}}), data={...previous.data};
const errors={}, info={};let updates=0, limited=false;
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
  const x=await getYahoo(sym,range), q=x.indicators?.quote?.[0]||{}, bars=new Map();
  if(old.currency&&old.currency!==x.meta.currency)throw Error('Currency changed; previous series preserved');
  const tz=x.meta.exchangeTimezoneName||'UTC';
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'});
  for(let i=0;i<x.timestamp.length;i++){
   const ts=x.timestamp[i],p=q.close?.[i];if(!valid(ts)||!valid(p)||ts*1000>+now+300000)continue;
   const dt=formatter.format(new Date(ts*1000));bars.set(dt,{ts,price:Number(p.toFixed(6)),open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],volume:q.volume?.[i]});
  }
  const ordered=[...bars.entries()].sort((a,b)=>a[0].localeCompare(b[0]));if(!ordered.length)throw Error('No valid candles');
  const [lastDate,last]=ordered.at(-1);if(old.asOf&&Date.parse(old.asOf)>last.ts*1000)throw Error('Source older than saved quote');
  const history={...old.history};for(const [dt,b] of ordered)history[dt]=b.price;
  const prior=Object.entries(history).filter(([dt,p])=>dt<lastDate&&valid(p)).sort((a,b)=>b[0].localeCompare(a[0]))[0]?.[1];
  const pct=valid(prior)?Number(((last.price/prior-1)*100).toFixed(3)):null;
  data[sym]={...old,price:last.price,currency:x.meta.currency,exchange:x.meta.exchangeName||old.exchange||'',name:x.meta.longName||x.meta.shortName||old.name||sym,asOf:new Date(last.ts*1000).toISOString(),changePct:pct,history,source,...(deep?{backfillAt:checkedAt}:{}),checkedAt};
  const file=DIR+'/stocks-history/'+sym+'.json';await fs.mkdir(DIR+'/stocks-history',{recursive:true});
  const saved=await read(file,{data:{}});const series={...saved.data};
  for(const [dt,b] of ordered){if([b.open,b.high,b.low,b.price].every(valid)&&b.high>=Math.max(b.open,b.price)&&b.low<=Math.min(b.open,b.price)&&b.high>=b.low)series[dt]={open:b.open,high:b.high,low:b.low,close:b.price,volume:Number.isFinite(b.volume)&&b.volume>=0?b.volume:null};}
  await save(file,{symbol:sym,currency:x.meta.currency,source,interval:'1d',checkedAt,data:series});
  updates++;info[sym]={range,days:Object.keys(history).length,first:Object.keys(history).sort()[0],asOf:data[sym].asOf};console.log(sym,info[sym]);
 }catch(e){errors[sym]=e.message;console.warn(sym,e.message);}
 await delay(350);
}
if(Object.keys(data).length)await save(FILE,{...previous,schemaVersion:1,updatedAt:updates?checkedAt:previous.updatedAt,checkedAt,source,data});
await save(DIR+'/stocks-status.json',{checkedAt,updated:updates,total:tickers.length,errors,info});
console.log('Stocks',updates,'/',tickers.length);if(!updates)process.exitCode=1;
