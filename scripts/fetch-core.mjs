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
try{const {refreshCrypto}=await import('./fetch-crypto-quotes.mjs');const r=await refreshCrypto();if(r.updated<r.total)failures.push(`crypto: partial ${r.updated}/${r.total}`);}catch(e){console.warn(`crypto: ${e.message}; previous data preserved`);failures.push(`crypto: ${e.message}`);}
await fs.writeFile(path.join(DIR,'core-status.json'),JSON.stringify({checkedAt:new Date().toISOString(),failures,ok:tasks.length+1-failures.length}));
console.log('Quick refresh finished',failures.length?'with warnings':'successfully');
if(failures.length===tasks.length+1)process.exitCode=1;
