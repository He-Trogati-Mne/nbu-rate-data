/** Daily UTC close history, separate OHLCV, resumable backfill. Never replace live quote timestamps. */
import fs from 'node:fs/promises';
const DIR='data', file=DIR+'/crypto.json', histDir=DIR+'/crypto-history';
await fs.mkdir(histDir,{recursive:true});
async function read(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'));}catch{return f;}}
async function save(p,x){await fs.writeFile(p+'.tmp',JSON.stringify(x));await fs.rename(p+'.tmp',p);}
const previous=await read(file,null);if(!Array.isArray(previous?.data?.coins)||!previous.data.coins.length)throw Error('Run fetch-core.mjs first');
const stateFile=DIR+'/crypto-history-status.json', oldState=await read(stateFile,{coins:{}});
const checkedAt=new Date().toISOString(),today=checkedAt.slice(0,10), day=86400;
const state={...oldState.coins}, errors={};let updated=0,limited=false;
const symbols={'bitcoin':'BTC','ethereum':'ETH','tether':'USDT','binancecoin':'BNB','solana':'SOL','usd-coin':'USDC','ripple':'XRP','cardano':'ADA','dogecoin':'DOGE','avalanche-2':'AVAX','tron':'TRX','the-open-network':'TON','chainlink':'LINK','polkadot':'DOT','litecoin':'LTC','dai':'DAI','wrapped-bitcoin':'WBTC','uniswap':'UNI','near':'NEAR','aptos':'APT','arbitrum':'ARB','optimism':'OP','sui':'SUI','stellar':'XLM'};
const source='CryptoCompare / CoinDesk CCCAGG USD';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
async function page(symbol,end,limit){
 const url=new URL('https://min-api.cryptocompare.com/data/v2/histoday');
 url.search=new URLSearchParams({fsym:symbol,tsym:'USD',e:'CCCAGG',limit:String(limit),toTs:String(end)});
 const headers={'Accept':'application/json','User-Agent':'NBU-Rate-Dataset/1.0'};if(process.env.CRYPTOCOMPARE_API_KEY)headers.Authorization='Apikey '+process.env.CRYPTOCOMPARE_API_KEY;
 const r=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});
 if([401,403,429].includes(r.status)){limited=true;throw Error(`HTTP ${r.status}; stop provider requests`);}if(!r.ok)throw Error(`HTTP ${r.status}`);
 const x=await r.json();if(x.Response==='Error'||!Array.isArray(x?.Data?.Data)||!x.Data.Data.length){if(/rate limit|quota|api key|unauthoriz/i.test(x.Message||''))limited=true;throw Error(x.Message||'Empty history');}
 return x.Data.Data;
}
const coins=previous.data.coins.map(c=>({...c,history:{...c.history}}));
for(const coin of coins){
 const sym=symbols[coin.id];if(!sym)continue;
 if(limited){errors[coin.id]='Provider limit; not requested';continue;}
 const prev=state[coin.id]||{}, p=histDir+'/'+sym+'.json', archive=await read(p,{data:{}}), series={...archive.data};
 let cursor=prev.nextToTs??Math.floor(Date.now()/1000), complete=!!prev.backfillComplete, count=0, pages=0;
 const ingest=rows=>{let oldest=null,n=0;for(const row of rows){if(!Number.isInteger(row.time)||row.time<=0||row.time%day!==0||row.time*1000>=Date.parse(today))continue;const dt=new Date(row.time*1000).toISOString().slice(0,10);if(!positive(row.close))continue;coin.history[dt]=row.close;series[dt]={close:row.close,...([row.open,row.high,row.low].every(positive)&&row.high>=Math.max(row.open,row.close)&&row.low<=Math.min(row.open,row.close)?{open:row.open,high:row.high,low:row.low}:{}),volumeBase:Number.isFinite(row.volumefrom)&&row.volumefrom>=0?row.volumefrom:null,volumeQuote:Number.isFinite(row.volumeto)&&row.volumeto>=0?row.volumeto:null};oldest=oldest===null?row.time:Math.min(oldest,row.time);n++;}count+=n;return {oldest,n};};
 try{
  // Refresh recent closed days, including gaps during a short outage.
  const last=Object.keys(series).sort().at(-1), gap=last?Math.ceil((Date.parse(today)-Date.parse(last))/86400000):30;
  ingest(await page(sym,Math.floor(Date.now()/1000),Math.min(2000,Math.max(14,gap+2))));
  // Walk backwards independently of the oldest existing legacy snapshot. Limit work per run.
  if(!complete){for(let i=0;i<3;i++){
   await pause(500);const rows=await page(sym,cursor,2000);pages++;const {oldest,n}=ingest(rows);
   if(!n){throw Error('No positive historical candles; backfill not confirmed');}
   if(oldest===null||oldest>=cursor)throw Error('History cursor did not advance');
   const next=oldest-1;cursor=next;
   const earlierZeros=rows.some(r=>r.time<oldest&&r.close===0);
   if(earlierZeros&&n<rows.length-1){complete=true;break;}
  }}
 }catch(e){errors[coin.id]=e.message;console.warn(sym,e.message);}
 if(count){coin.historySource=source+'; legacy/snapshot days may remain';await save(p,{symbol:sym,id:coin.id,currency:'USD',source,interval:'1d',checkedAt,data:series});updated++;}
 state[coin.id]={checkedAt,nextToTs:cursor,backfillComplete:complete,pages,days:Object.keys(series).length,first:Object.keys(series).sort()[0]||null,last:Object.keys(series).sort().at(-1)||null,error:errors[coin.id]||null};
 console.log(sym,state[coin.id]);await pause(500);
}
if(updated)await save(file,{...previous,historyDate:today,historyCheckedAt:checkedAt,data:{...previous.data,coins}});
await save(stateFile,{checkedAt,updated,total:coins.length,errors,coins:state});if(!updated)process.exitCode=1;
