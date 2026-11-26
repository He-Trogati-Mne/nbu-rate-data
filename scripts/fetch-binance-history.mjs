// Independent official spot USDT series. Never merge with the CCCAGG USD chart.
import fs from 'node:fs/promises';
const DIR='data/crypto-history/binance', day=86400000;
const pairs=['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','AVAXUSDT','TRXUSDT','LINKUSDT','DOTUSDT','LTCUSDT','UNIUSDT','NEARUSDT','APTUSDT','ARBUSDT','OPUSDT','SUIUSDT','XLMUSDT'];
await fs.mkdir(DIR,{recursive:true});const checkedAt=new Date().toISOString(),today=Date.parse(checkedAt.slice(0,10));
let limited=false;const status={};const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function read(p){try{return JSON.parse(await fs.readFile(p,'utf8'));}catch{return {data:{}};}}
async function save(p,x){await fs.writeFile(p+'.tmp',JSON.stringify(x));await fs.rename(p+'.tmp',p);}
for(const pair of pairs){if(limited){status[pair]={error:'Provider limit; skipped'};continue;}const file=DIR+'/'+pair+'.json',prev=await read(file),series={...prev.data};let cursor=prev.nextStartTime??Date.UTC(2017,6,1),count=0,error=null;
 try{for(let i=0;i<5&&cursor<today;i++){
  const url=new URL('https://data-api.binance.vision/api/v3/klines');url.search=new URLSearchParams({symbol:pair,interval:'1d',limit:'1000',startTime:String(cursor),endTime:String(today-1)});
  const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if([401,403,418,429,451].includes(r.status)){limited=true;throw Error('HTTP '+r.status+'; access restricted');}if(!r.ok)throw Error('HTTP '+r.status);
  const rows=await r.json();if(!Array.isArray(rows))throw Error('Bad response');if(!rows.length)break;
  let last=cursor-1;for(const row of rows){const [t,o,h,l,c,v,closeTime,q]=row;const [open,high,low,close,volume,volumeQuote]=[o,h,l,c,v,q].map(Number);if(!Number.isInteger(t)||t<cursor||t>=today||closeTime>=today||![open,high,low,close].every(x=>Number.isFinite(x)&&x>0)||high<Math.max(open,close)||low>Math.min(open,close))continue;series[new Date(t).toISOString().slice(0,10)]={open,high,low,close,volumeBase:Number.isFinite(volume)&&volume>=0?volume:null,volumeQuote:Number.isFinite(volumeQuote)&&volumeQuote>=0?volumeQuote:null};last=Math.max(last,t);count++;}
  if(last<cursor)throw Error('No valid candles or cursor not advancing');cursor=last+day;await wait(350);
 }}catch(e){error=e.message;console.warn(pair,error);}
 if(count)await save(file,{symbol:pair,quote:'USDT',source:'Binance Spot public market data',interval:'1d',checkedAt,nextStartTime:cursor,data:series});status[pair]={count,days:Object.keys(series).length,error};console.log(pair,status[pair]);
}
await save(DIR+'/status.json',{checkedAt,pairs:status});if(!Object.values(status).some(v=>v.count>0)&&Object.values(status).some(v=>v.error))process.exitCode=1;
