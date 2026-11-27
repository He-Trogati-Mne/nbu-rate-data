// Orchestrates existing collectors without modifying their parsers or output paths.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = 'data', reportFile = `${root}/update-status.json`;
const diagnostic = process.argv.includes('--diagnostics');
const forceHistory = process.argv.includes('--history');
const started = new Date().toISOString(), today = started.slice(0,10);
const report = { checkedAt: started, runId: process.env.GITHUB_RUN_ID || null, mode: diagnostic?'diagnostics':'update', stages: {}, historyProtection: [], sources: {} };
const obj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const dayKey = /^\d{4}-\d{2}-\d{2}$/;
const valid = v => typeof v === 'number' && Number.isFinite(v) && v > 0;
const own = (o,k) => Object.hasOwn(o,k);
async function read(file) { return JSON.parse(await fs.readFile(file,'utf8')); }
async function maybe(file) { try {return await read(file);} catch(e) {if(e.code==='ENOENT')return null; throw e;} }
async function save(file,value) {await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.guard-tmp',JSON.stringify(value));await fs.rename(file+'.guard-tmp',file);}
async function files(dir) {
  const result=[];
  for(const ent of await fs.readdir(dir,{withFileTypes:true})) {
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) result.push(...await files(p));
    else if(ent.isFile()&&p.endsWith('.json')) result.push(p);
  }
  return result;
}
function historyMap(old,next,{lockPast=false}={}) {
  if(!obj(old)||!obj(next))throw Error('History map missing or invalid');
  let restored=0;
  for(const [d,v] of Object.entries(old)) {
    if(!own(next,d)||next[d]==null||(!valid(next[d])&&valid(v))) {next[d]=v;restored++;continue;}
    if(obj(v)) {
      if(!obj(next[d])) {next[d]=v;restored++;continue;}
      for(const [k,val] of Object.entries(v)) {
        if(!own(next[d],k)||(next[d][k]==null&&val!=null)||(valid(val)&&!valid(next[d][k]))||(lockPast&&dayKey.test(d)&&d<today&&next[d][k]!==val)) {next[d][k]=val;restored++;}
      }
    } else if(lockPast&&dayKey.test(d)&&d<today&&next[d]!==v) {next[d]=v;restored++;}
  }
  return restored;
}
function protect(file,old,next) {
  if(Array.isArray(old)){if(!Array.isArray(next)||(old.length&&!next.length))throw Error('Invalid array snapshot');return 0;}
  if(!obj(old)||!obj(next))throw Error('JSON object expected');
  if(file==='data/nbu-history.json') {
    if(old.formatVersion!==next.formatVersion)throw Error('NBU history format changed; manual migration required');
    return historyMap(old.data,next.data,{lockPast:true});
  }
  if(file==='data/crypto.json') {
    if(!Array.isArray(old.data?.coins)||!Array.isArray(next.data?.coins))throw Error('Invalid coin list');
    let n=0;const byId=new Map(next.data.coins.map(c=>[c.id,c]));
    for(const coin of old.data.coins){
      const c=byId.get(coin.id);
      if(!c){next.data.coins.push(coin);n++;continue;}
      for(const k of ['history','historySources'])if(obj(coin[k])){if(!obj(c[k])){c[k]={};}n+=historyMap(coin[k],c[k],{lockPast:true});}
    }
    return n;
  }
  if(file==='data/stocks.json') {
    if(!obj(old.data)||!obj(next.data))throw Error('Invalid stock list');
    let n=0;
    for(const [id,stock] of Object.entries(old.data)){
      if(!obj(next.data[id])){next.data[id]=stock;n++;continue;}
      if(stock.currency&&next.data[id].currency!==stock.currency)throw Error(`Currency changed: ${id}`);
      if(obj(stock.history)){if(!obj(next.data[id].history))next.data[id].history={};n+=historyMap(stock.history,next.data[id].history);}
    }
    return n;
  }
  if(/^data\/(crypto-history|stocks-history)\//.test(file)) {
    for(const k of ['symbol','base','quote','currency','interval'])if(old[k]&&next[k]!==old[k])throw Error(`Archive metadata changed: ${k}`);
    return historyMap(old.data,next.data,{lockPast:file.startsWith('data/crypto-history/')});
  }
  // Other existing files: reject empty/replaced snapshot containers.
  if(own(old,'data')) {
    if(Array.isArray(old.data)&&old.data.length&&(!Array.isArray(next.data)||!next.data.length))throw Error('Empty snapshot');
    if(obj(old.data)&&Object.keys(old.data).length&&(!obj(next.data)||!Object.keys(next.data).length))throw Error('Empty snapshot');
  }
  return 0;
}
async function stage(name,script,env={},minutes=5){
  const begin=Date.now();console.log(`\n=== ${name} ===`);
  const childEnv={...process.env};for(const k of ['NBU_FETCH_MODE','NBU_BANK_IDS','NBU_BANK_STATUS_FILE','NBU_CRYPTO_PROVIDERS','NBU_CRYPTO_BACKFILL_PAGES'])delete childEnv[k];Object.assign(childEnv,env);
  const result=await new Promise(resolve=>{
    const child=spawn(process.execPath,[`scripts/${script}`],{env:childEnv,stdio:'inherit',detached:process.platform!=='win32'});
    let timedOut=false;const timer=setTimeout(()=>{timedOut=true;try{if(process.platform!=='win32')process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');}catch{}},minutes*60000);
    child.once('error',e=>{clearTimeout(timer);resolve({status:'error',error:e.message});});
    child.once('close',(code,signal)=>{clearTimeout(timer);resolve({status:timedOut?'timeout':code===0?'finished':'error',exitCode:code,signal});});
  });
  report.stages[name]={...result,seconds:Math.round((Date.now()-begin)/1000)};
}
async function guard(before){
  for(const [file,bytes] of before){
    try{
      const old=JSON.parse(bytes),next=await read(file);
      const n=protect(file,old,next);
      if(n){await save(file,next);report.historyProtection.push({file,action:'restored_entries',count:n});}
    }catch(e){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);report.historyProtection.push({file,action:'restored_file',reason:e.message});}
  }
  for(const file of await files(root))if(!before.has(file)){
    try{const v=await read(file);if(!obj(v)&&!Array.isArray(v))throw Error('Invalid JSON root');}catch(e){await fs.unlink(file);report.historyProtection.push({file,action:'removed_invalid_new_file',reason:e.message});}
  }
}
function category(reason=''){
  if(/\b429\b|rate.limit/i.test(reason))return 'rate_limit';
  if(/\b(401|403)\b|access restricted/i.test(reason))return 'access_restricted';
  if(/\b(404|410)\b/.test(reason))return 'endpoint_missing';
  if(/timeout|timed out|aborted|ETIMEDOUT/i.test(reason))return 'timeout';
  if(/ENOTFOUND|EAI_AGAIN|DNS/i.test(reason))return 'dns';
  if(/certificate|TLS|SSL/i.test(reason))return 'tls';
  if(/не знайдено|відсутні|wrong response|invalid|no valid|no fresh/i.test(reason))return 'missing_or_invalid_data';
  return 'other_or_unknown';
}
async function collectReports(){
  for(const id of ['core-status','bank-fetch-status','crypto-quotes-status','crypto-history-status','stocks-status','bank-health','kuna-status']){
    const value=await maybe(`${root}/${id}.json`);
    if(!value){report.sources[id]={missing:true};continue;}
    const current=typeof value.checkedAt==='string'&&Date.parse(value.checkedAt)>=Date.parse(started)&&(!value.runId||value.runId===report.runId);
    report.sources[id]={current,value};
    if(id==='bank-fetch-status')report.bankIssues=Object.entries(value.banks||{}).filter(([,v])=>v.status!=='updated').map(([bank,v])=>({bank,category:category(v.reason),reason:v.reason,previousUpdatedAt:v.previousUpdatedAt,previousSource:v.previousSource,legacyAggregator:/minfin\.com\.ua|finance\.ua/i.test(v.previousSource||''),current}));
  }
}
async function main(){
  // Read the previous report before updating. Invalid input JSON aborts before collectors run.
  const previous=await maybe(reportFile);
  report.dailyAttempts={...(previous?.dailyAttempts||{})};
  const before=new Map();for(const f of await files(root)){const bytes=await fs.readFile(f);JSON.parse(bytes);before.set(f,bytes);}
  try{
    await stage('core','fetch-core.mjs',{},3);
    await stage('banks','fetch.js',{NBU_FETCH_MODE:'banks'},9);
    await stage('stocks','fetch-stocks.mjs',{NBU_STOCK_BACKFILL:process.env.NBU_STOCK_BACKFILL==='1'?'1':'0'},4);
    if(forceHistory||diagnostic||report.dailyAttempts.extras!==today){
      report.dailyAttempts.extras=today;await stage('extras_and_nbu_history','fetch.js',{NBU_FETCH_MODE:'extras'},5);
    }else report.stages.extras_and_nbu_history={status:'daily_attempt_already_made'};
    if(forceHistory||diagnostic||report.dailyAttempts.crypto!==today){
      report.dailyAttempts.crypto=today;await stage('crypto_history','fetch-crypto-history.mjs',{NBU_CRYPTO_BACKFILL_PAGES:forceHistory?'2':'1'},8);
    }else report.stages.crypto_history={status:'daily_attempt_already_made'};
    await stage('bank_health','bank-health.mjs',{},1);
  }finally{await guard(before);}
  await collectReports();
  if(diagnostic){await stage('bank_browser_diagnostics','bank-diagnostics.mjs',{BANK_IDS:process.env.BANK_IDS||'all'},35);await save('diagnostics/update-report.json',report);}
  else await save(reportFile,report);
  const lines=['## NBU Rate — звіт',`- Режим: ${report.mode}`, ...Object.entries(report.stages).map(([k,v])=>`- ${k}: ${v.status}${v.seconds===undefined?'':` (${v.seconds}s)`}`),'','### Джерела'];
  for(const [id,r] of Object.entries(report.sources)){
    if(r.missing){lines.push(`- ${id}: відсутній звіт`);continue;}
    const v=r.value;lines.push(`- ${id}: ${r.current?'поточна перевірка':'попередній звіт'}${Number.isFinite(v.updated)?` ${v.updated}/${v.total}`:''}${Array.isArray(v.failures)?` — ${v.failures.length} помилок`:''}`);
  }
  lines.push('','### Банки — помилки (див. час звіту)');for(const b of report.bankIssues||[])lines.push(`- ${b.bank}: ${b.category} — ${String(b.reason||'unknown').replace(/\n/g,' ')}`);
  lines.push('','### Захист історії',`- Відновлень: ${report.historyProtection.length}`);
  const summary=lines.join('\n')+'\n';console.log(summary);if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
}
if(process.argv.includes('--self-test')){
  const old={formatVersion:2,data:{'2003-01-01':{USD:5,EUR:6}}}, next={formatVersion:2,data:{'2003-01-01':{USD:0},[today]:{USD:45}}};
  if(protect('data/nbu-history.json',old,next)!==2||next.data['2003-01-01'].USD!==5||next.data['2003-01-01'].EUR!==6||next.data[today].USD!==45)throw Error('NBU self-test failed');
  const crypto={data:{coins:[{id:'btc',history:{'2020-01-01':10}},{id:'eth',history:{'2020-01-01':1}}]}}, fresh={data:{coins:[{id:'btc',history:{[today]:20}}]}};
  if(protect('data/crypto.json',crypto,fresh)!==2||fresh.data.coins.length!==2||fresh.data.coins[0].history['2020-01-01']!==10)throw Error('Crypto self-test failed');
  console.log('History protection self-test passed');
}else await main();
