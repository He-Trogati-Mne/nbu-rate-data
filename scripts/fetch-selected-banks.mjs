import fs from 'node:fs/promises';
import path from 'node:path';
const banks = [
  ['asvio', ['https://asviobank.ua/']],
  ['a-bank', ['https://a-bank.com.ua/']],
  ['alliance', ['https://alb.ua/currency']],
  ['idea', ['https://ideabank.ua/uk']],
  ['komin', ['https://cib.com.ua/']],
  ['pumb', [
    'https://www.pumb.ua/purchase_currency',
    'https://about.pumb.ua/info/currency_converter'
  ]]
];
const Dir='data';
const strip=html=>html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const currencies=['USD','EUR','GBP','PLN'];
let nbu={};try{const p=JSON.parse(await fs.readFile(path.join(Dir,'nbu.json'),'utf8'));for(const x of p.data||[])if(currencies.includes(x.cc))nbu[x.cc]=Number(x.rate);}catch{}
function parse(html){
 const rows=html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)||[];
 const lines=rows.map(strip);
 const cards=html.match(/<(?:div|li)\b[^>]*>[\s\S]{0,900}?<\/(?:div|li)>/gi)||[];
 lines.push(...cards.slice(0,1000).map(strip).filter(x=>x.length<250));
 const out={};
 for(const cc of currencies){
  const reference=nbu[cc];if(!(reference>0))continue;
  let best=null;
  for(const line of lines){
   if(!new RegExp(`\\b${cc}\\b`,'i').test(line)||line.length>270)continue;
   const hasBuySell=/купівл|продаж|buy|sell|курс|exchange|обмін/i.test(line);
   if(!hasBuySell&&line.length>100)continue;
   const after=line.slice(Math.max(0,line.search(new RegExp(`\\b${cc}\\b`,'i'))));
   const values=(after.match(/\b\d{1,4}(?:[.,]\d{1,5})?\b/g)||[])
      .map(x=>Number(x.replace(',','.')))
      .filter(x=>x>reference*.75&&x<reference*1.35);
   if(values.length<2)continue;
   const buy=Math.min(values[0],values[1]),sell=Math.max(values[0],values[1]);
   if((sell-buy)/buy>.09||sell<=0)continue;
   best={buy:Number(buy.toFixed(4)),sell:Number(sell.toFixed(4))};
   break;
  }
  if(best)out[cc]=best;
 }
 if(Object.keys(out).length<2)return null;
 if(out.USD&&out.EUR&&out.USD.buy===out.EUR.buy&&out.USD.sell===out.EUR.sell)return null;
 return out;
}
async function download(url){const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),14000);try{const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; NBU-Rate-Dataset/1.0)','Accept-Language':'uk-UA,uk;q=0.9','Accept':'text/html'},signal:ac.signal});if(!r.ok)throw Error('HTTP '+r.status);return await r.text();}finally{clearTimeout(tm);}}
let refreshed=0;const errors={};
for(const [id,urls] of banks){
 let result=null,source=null;
 for(const url of urls){try{const html=await download(url);result=parse(html);if(result){source=url;break;}}catch(e){errors[id]=e.message;}}
 if(result){
  const payload={updatedAt:new Date().toISOString(),source,method:'official-site-best-effort',data:result};
  await fs.writeFile(path.join(Dir,id+'.json'),JSON.stringify(payload));
  console.log(id,'refreshed',Object.keys(result).join(','));refreshed++;
 }else{errors[id]||='no validated pairs (dynamic page / blocked / changed markup)';console.log(id,'kept previous:',errors[id]);}
}
await fs.writeFile(path.join(Dir,'selected-bank-status.json'),JSON.stringify({checkedAt:new Date().toISOString(),refreshed,total:banks.length,errors}));
console.log('6 target banks:',refreshed,'updated. Never re-stamp stale data.');
