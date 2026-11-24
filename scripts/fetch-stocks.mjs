/** Best-effort market snapshots + daily history, no fake quotes on API failure.
 * Yahoo chart endpoint is UNOFFICIAL and can respond 429; replace with a licensed provider for production.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
const DIR='data', FILE=path.join(DIR,'stocks.json');
await fs.mkdir(DIR,{recursive:true});
let previous={data:{}};try{previous=JSON.parse(await fs.readFile(FILE,'utf8'));}catch{}
const tickers=['KYIV','MHPC.L','FXPO.L','AST.WA','AAPL','MSFT','NVDA','GOOGL','TSLA','AMZN'];
const data={...(previous.data||{})};
const errors={};let updates=0;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function getYahoo(sym){
 for(const host of ['query1.finance.yahoo.com','query2.finance.yahoo.com']){
  const u=`https://${host}/v8/finance/chart/${encodeURIComponent(sym)}?range=5y&interval=1d&events=history`;
  const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),12000);
  try{const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0 (compatible; NbuRateData/1.0)','Accept':'application/json'},signal:ac.signal});if(r.status===429||r.status>=500){await delay(400);continue;}if(!r.ok)throw Error(`HTTP ${r.status}`);
    const body=await r.json();const x=body?.chart?.result?.[0];if(!x?.meta?.symbol||!Array.isArray(x.timestamp))throw Error('chart unavailable');return x;
  }catch(e){errors[sym]=e.message;}finally{clearTimeout(tm);}
 }
 return null;
}
for(const sym of tickers){
 const x=await getYahoo(sym);
 if(!x){errors[sym]||='no response';console.warn(sym,'unavailable:',errors[sym]);continue;}
 const priceHistory={...(data[sym]?.history||{})};const close=x.indicators?.quote?.[0]?.close||[];
 let lastPrice=null,lastTs=null;
 for(let i=0;i<x.timestamp.length;i++){
  const price=Number(close[i]);const ts=Number(x.timestamp[i]);
  if(!Number.isFinite(price)||price<=0||!Number.isFinite(ts))continue;
  const iso=new Date(ts*1000).toISOString().slice(0,10);
  priceHistory[iso]=Number(price.toFixed(6));if(!lastTs||ts>lastTs){lastTs=ts;lastPrice=price;}
 }
 if(!lastTs){errors[sym]='no valid historical candles';continue;}
 const prevClose=Number(x.meta.previousClose||x.meta.chartPreviousClose);
 const changePct=Number.isFinite(prevClose)&&prevClose>0?((lastPrice/prevClose)-1)*100:null;
 data[sym]={price:Number(lastPrice.toFixed(6)),currency:x.meta.currency||'USD',exchange:x.meta.exchangeName||'',asOf:new Date(lastTs*1000).toISOString(),changePct:changePct==null?null:Number(changePct.toFixed(3)),history:priceHistory,source:'Yahoo Finance chart (unofficial, delayed)'};
 updates++;console.log(sym,'saved',Object.keys(priceHistory).length,'days',data[sym].asOf);
 await delay(250);
}
const checkedAt=new Date().toISOString();
if(updates||Object.keys(data).length){await fs.writeFile(FILE,JSON.stringify({schemaVersion:1,updatedAt:updates?checkedAt:(previous.updatedAt||null),checkedAt,source:'Yahoo Finance chart (unofficial, delayed)',data}));}
await fs.writeFile(path.join(DIR,'stocks-status.json'),JSON.stringify({checkedAt,updated:updates,total:tickers.length,errors}));
console.log('Stocks complete',updates,'/',tickers.length);
