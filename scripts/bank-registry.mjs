// Official NBU directory, separate from quote sources. No inference of licence status.
import fs from 'node:fs/promises';
const url='https://bank.gov.ua/NBU_BankInfo/get_data_branch?json';
const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{Accept:'application/json','User-Agent':'NBU-Rate-Dataset/1.0'}});
if(!r.ok)throw Error(`NBU directory HTTP ${r.status}`);
const rows=await r.json();if(!Array.isArray(rows))throw Error('Unexpected NBU directory format');
const byId=new Map();
for(const b of rows){if(String(b.TYP)!=='0'||!b.ID_NBU||!b.SHORTNAME)continue;const id=String(b.ID_NBU);byId.set(id,{id,name:b.SHORTNAME,mfo:String(b.GLMFO??b.MFO??''),edrpou:String(b.KOD_EDRPOU??''),statusCode:b.STAN_GOL??b.KSTAN??null,statusName:b.NSTAN_GOL??b.N_STAN??null});}
if(byId.size<20)throw Error(`NBU directory returned only ${byId.size} head offices; preserving previous registry`);
const result={checkedAt:new Date().toISOString(),source:url,total:byId.size,note:'TYP=0 head offices in current NBU directory; not necessarily all licensed or historically liquidated banks. Separate from bank quote coverage.',banks:[...byId.values()].sort((a,b)=>a.name.localeCompare(b.name,'uk'))};
await fs.writeFile('data/banks-registry.json.tmp',JSON.stringify(result,null,2)+'\n');await fs.rename('data/banks-registry.json.tmp','data/banks-registry.json');console.log(`NBU directory: ${result.total} head offices`);
