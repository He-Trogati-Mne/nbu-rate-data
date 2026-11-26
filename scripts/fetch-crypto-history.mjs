import fs from 'node:fs/promises';
import {DAY,PROVIDERS,QUOTE,LIMIT,asset,client,markets,candles,dayStart,positive} from './crypto-exchanges.mjs';
const DIR='data', file=DIR+'/crypto.json', root=DIR+'/crypto-history';
const checkedAt=new Date().toISOString(), today=dayStart(Date.now()), floor=Date.UTC(2010,0,1);
const chosen=process.env.NBU_CRYPTO_PROVIDERS?process.env.NBU_CRYPTO_PROVIDERS.split(',').filter(p=>PROVIDERS.includes(p)):PROVIDERS;
if(!chosen.length)throw Error('No valid providers');
const pages=Math.min(4,Math.max(1,Number(process.env.NBU_CRYPTO_BACKFILL_PAGES)||2));
const get=client(), date=t=>new Date(t).toISOString().slice(0,10);
async function read(p,f){try{return JSON.parse(await fs.readFile(p,'utf8'));}catch(e){if(e.code==='ENOENT')return f;throw e;}}
async function save(p,x){await fs.writeFile(p+'.tmp',JSON.stringify(x));await fs.rename(p+'.tmp',p);}
const prev=await read(file,null);if(!Array.isArray(prev?.data?.coins)||!prev.data.coins.length)throw Error('Run core first (existing crypto.json required)');
const coins=prev.data.coins.map(c=>({...c,history:{...c.history},historySources:{...c.historySources}}));
const state=Object.fromEntries(coins.map(c=>[c.id,{checkedAt,providers:{},received:0,added:0}]));
const errors={}, sources={};let filled=0,updated=0,usdUpdated=0;
for(const p of chosen){const dir=root+'/'+p;await fs.mkdir(dir,{recursive:true});let catalog;
 try{catalog=await markets(get,p);sources[p]={markets:catalog.size,received:0,updated:0,quote:QUOTE[p]};}catch(e){sources[p]={error:e.message,quote:QUOTE[p],updated:0};for(const c of coins)state[c.id].providers[p]={error:e.message};continue;}
 for(const c of coins){const s=state[c.id],m=catalog.get(asset(c));if(!m){s.providers[p]={status:'not_listed'};continue;}
 const name=m.key.replace(/[^a-zA-Z0-9_-]/g,'_');const path=dir+'/'+name+'.json';
 let old;try{old=await read(path,{data:{}});}catch(e){s.providers[p]={error:'Cannot read archive: '+e.message};continue;}
 const data={...old.data};let cursor=Number.isSafeInteger(old.backfillBefore)?Math.min(today,old.backfillBefore):today;let count=0,added=0,err=null;
 const collected=new Map();
 function absorb(rows){for(const r of rows){const d=date(r.t);const {t,...v}=r;data[d]=v;collected.set(d,v);count++;}}
 try{
  if(p==='kraken'){absorb(await candles(get,p,m,today-719*DAY,today));}
  else{
   if(cursor<today)absorb(await candles(get,p,m,today-7*DAY,today));
   for(let i=0;i<pages&&cursor>floor;i++){
    const start=Math.max(floor,cursor-LIMIT[p]*DAY);const rows=await candles(get,p,m,start,cursor);absorb(rows);
    cursor=start;
   }
  }
 }catch(e){err=e.message;console.warn(p,c.id,err);}
 if(count||(!err&&p!=='kraken'))await save(path,{...old,id:c.id,symbol:m.key,base:m.base,quote:m.quote,source:p,interval:'1d',checkedAt,backfillBefore:p==='kraken'?null:cursor,data});
 if(QUOTE[p]==='USD')for(const [d,v] of Object.entries(data)){if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||d>=date(today)||!positive(v?.close))continue;if(!positive(c.history[d])){c.history[d]=v.close;c.historySources[d]=p+':'+m.key;added++;}}
 s.received+=collected.size;s.added+=added;filled+=added;
 sources[p].received+=collected.size;if(collected.size)sources[p].updated++;
 s.providers[p]={pair:m.key,quote:m.quote,received:collected.size,added,days:Object.keys(data).length,backfillBefore:p==='kraken'?null:date(cursor),status:err?(collected.size?'partial':'error'):(collected.size?'updated':'no_new_candles'),error:err};
 console.log(p,c.id,JSON.stringify(s.providers[p]));
 }
}
for(const c of coins){const s=state[c.id],entries=Object.values(s.providers);if(s.received)updated++;else errors[c.id]=entries.map((v,i)=>v.error||v.status||'unknown').join('; ')||'No source';if(entries.some(v=>v.quote==='USD'&&v.received>0))usdUpdated++;
 const dates=Object.keys(c.history).sort();s.days=dates.length;s.first=dates[0]||null;s.last=dates.at(-1)||null;s.status=s.received?'updated':'error';s.error=errors[c.id]||null;if(s.added)c.historySource='Legacy USD history; missing days filled with official USD spot closes (historySources)';
}
if(filled)await save(file,{...prev,historyDate:date(today),historyCheckedAt:checkedAt,data:{...prev.data,coins}});
await save(DIR+'/crypto-history-status.json',{runId:process.env.GITHUB_RUN_ID||null,checkedAt,provider:chosen.join('+'),updated,usdUpdated,total:coins.length,filled,errors,coins:state,sources});
console.log(`History: ${updated}/${coins.length} assets received candles; USD ${usdUpdated}; added ${filled}; errors ${Object.keys(errors).length}`);
if(!updated)process.exitCode=1;
