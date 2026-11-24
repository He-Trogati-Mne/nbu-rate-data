/** Reports stale/inconsistent bank JSON without forging new timestamps or quotes. */
import fs from 'node:fs/promises';import path from 'node:path';
const DIR='data';const keys=['asvio','a-bank','alliance','idea','komin','pumb'];
const checkedAt=new Date().toISOString(),result={};
for(const k of keys){
 try{
  const x=JSON.parse(await fs.readFile(path.join(DIR,k+'.json'),'utf8'));
  const updated=Date.parse(x.updatedAt||'');const ageHours=Number.isFinite(updated)?(Date.now()-updated)/3600000:null;
  const usd=x.data?.USD, eur=x.data?.EUR,gbp=x.data?.GBP;
  const copy=(a,b)=>a&&b&&Number(a.buy)===Number(b.buy)&&Number(a.sell)===Number(b.sell);
  const suspect=copy(usd,eur)||(copy(usd,gbp)&&copy(eur,gbp));
  let status=ageHours==null?'unknown':ageHours>24?'stale':suspect?'suspicious':'ok';
  result[k]={status,source:x.source||null,updatedAt:x.updatedAt||null,ageHours:ageHours===null?null:Math.round(ageHours*10)/10,suspectSameValues:!!suspect};
  console.log(`${k}: ${status}, ${ageHours?.toFixed(1)||'unknown'}h${suspect?' (identical currencies)':''}`);
 }catch(e){result[k]={status:'missing',error:e.message};}
}
await fs.writeFile(path.join(DIR,'bank-health.json'),JSON.stringify({checkedAt,data:result}));
