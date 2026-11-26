import fs from 'node:fs/promises';import path from 'node:path';
const DIR='data';let keys=['asvio','a-bank','alliance','idea','komin','pumb'];
try{const report=JSON.parse(await fs.readFile(path.join(DIR,'bank-fetch-status.json'),'utf8'));keys=[...new Set([...keys,...Object.keys(report.banks||{})])];}catch{}
const checkedAt=new Date().toISOString(),result={};
for(const k of keys){
 try{
  const x=JSON.parse(await fs.readFile(path.join(DIR,k+'.json'),'utf8'));
  const updated=Date.parse(x.updatedAt||'');const ageHours=Number.isFinite(updated)?(Date.now()-updated)/3600000:null;
  const rates=x.unverifiedData||x.data;const usd=rates?.USD, eur=rates?.EUR,gbp=rates?.GBP;
  const copy=(a,b)=>a&&b&&Number(a.buy)===Number(b.buy)&&Number(a.sell)===Number(b.sell);
  const suspect=copy(usd,eur)||(copy(usd,gbp)&&copy(eur,gbp));
  const unofficial=/minfin\.com\.ua|finance\.ua/i.test(x.source||'');
  if(unofficial && suspect && Object.keys(x.data||{}).length){
    const file=path.join(DIR,k+'.json');
    await fs.writeFile(file+'.tmp',JSON.stringify({...x,data:{},unverifiedData:x.data,verification:'unverified'}));
    await fs.rename(file+'.tmp',file);
  }
  let status=unofficial?'unverified':suspect?'suspicious':ageHours==null?'unknown':ageHours>24?'stale':'ok';
  result[k]={status,source:x.source||null,updatedAt:x.updatedAt||null,ageHours:ageHours===null?null:Math.round(ageHours*10)/10,suspectSameValues:!!suspect,officialSource:!unofficial};
  console.log(`${k}: ${status}, ${ageHours?.toFixed(1)||'unknown'}h${suspect?' (identical currencies)':''}`);
 }catch(e){result[k]={status:'missing',error:e.message};}
}
await fs.writeFile(path.join(DIR,'bank-health.json'),JSON.stringify({checkedAt,data:result}));
