/** Short, reliable 30-minute refresh; leave long bank crawler & 2003 history to slow workflow. */
import fs from 'node:fs/promises';
import path from 'node:path';
const DIR='data';
await fs.mkdir(DIR,{recursive:true});
async function read(name){try{return JSON.parse(await fs.readFile(path.join(DIR,`${name}.json`),'utf8'));}catch{return null;}}
async function save(name,data,meta={}){await fs.writeFile(path.join(DIR,`${name}.json`),JSON.stringify({updatedAt:new Date().toISOString(),...meta,data}));}
async function get(url){const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),16000);try{const r=await fetch(url,{headers:{'User-Agent':'NBU-Rate-Dataset/1.0 (+https://github.com/He-Trogati-Mne/nbu-rate-data)','Accept':'application/json'},signal:ctrl.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json();}finally{clearTimeout(timer);}}
const tasks=[
 ['nbu','https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json',x=>Array.isArray(x)&&x.length>10],
 ['privat','https://api.privatbank.ua/p24api/pubinfo?exchange&json&coursid=11',x=>Array.isArray(x)&&x.length>0],
 ['mono','https://api.monobank.ua/bank/currency',x=>Array.isArray(x)&&x.length>0]
];
const failures=[];
for(const [name,url,check] of tasks){try{const result=await get(url);if(!check(result))throw new Error('wrong response shape');await save(name,result,{source:new URL(url).hostname});console.log(`${name}: ${result.length} quotes`);}catch(e){console.warn(`${name}: ${e.message}; previous data preserved`);failures.push(`${name}: ${e.message}`);}}
// CoinGecko prices: preserve existing historical dates and avoid expensive all-time backfills every half hour.
try{
 const previous=await read('crypto');
 const ids=['bitcoin','ethereum','tether','binancecoin','solana','usd-coin','ripple','cardano','dogecoin','avalanche-2','tron','the-open-network','chainlink','polkadot','litecoin','dai','wrapped-bitcoin','uniswap','near','aptos','arbitrum','optimism','sui','stellar'];
 const result=await get(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(',')}&sparkline=false&price_change_percentage=24h`);
 if(!Array.isArray(result)||!result.length)throw new Error('empty market result');
 const old=new Map((previous?.data?.coins||[]).map(c=>[c.id,c]));
 const today=new Date().toISOString().slice(0,10);
 const coins=result.filter(c=>Number(c.current_price)>0).map(c=>{
   const prev=old.get(c.id)||{};const history={...(prev.history||{})};history[today]=c.current_price;
   return {id:c.id,symbol:(c.symbol||'').toUpperCase(),name:c.name,image:c.image||prev.image||null,price:c.current_price,change24h:c.price_change_percentage_24h||0,history};
 });
 if(!coins.length)throw new Error('no valid prices');
 await save('crypto',{coins},{historyDate:previous?.historyDate||null,source:'coingecko.com'});
 console.log(`crypto: ${coins.length} updated; deep history retained`);
}catch(e){console.warn(`crypto: ${e.message}; previous history retained`);failures.push(`crypto: ${e.message}`);}
await fs.writeFile(path.join(DIR,'core-status.json'),JSON.stringify({checkedAt:new Date().toISOString(),failures,ok:tasks.length+1-failures.length}));
console.log('Quick refresh finished',failures.length?'with warnings':'successfully');
