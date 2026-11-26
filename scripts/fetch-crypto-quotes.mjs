import fs from 'node:fs/promises';
import {PROVIDERS,asset,client,markets,quotes,selectUsd} from './crypto-exchanges.mjs';
export async function refreshCrypto(){
 const file='data/crypto.json';const prev=JSON.parse(await fs.readFile(file,'utf8'));if(!Array.isArray(prev?.data?.coins)||!prev.data.coins.length)throw Error('Existing crypto.json required');
 const get=client(), assets=new Set(prev.data.coins.map(asset));assets.add('USDT');const results={},sources={},checkedAt=new Date().toISOString();
 for(const p of PROVIDERS){try{const market=await markets(get,p);results[p]=await quotes(get,p,market,assets);sources[p]={quotes:results[p].size};}catch(e){sources[p]={error:e.message};console.warn(p,e.message);}}
 let updated=0;const errors={};const coins=prev.data.coins.map(c=>{const q=selectUsd(asset(c),results);if(!q){errors[c.id]='No fresh verified USD price or USDT/USD conversion';return {...c,asOf:c.asOf||prev.updatedAt||null,quoteStale:true};}updated++;return {...c,price:q.price,change24h:q.change24h,asOf:checkedAt,quoteStale:false,priceSource:q.provider,pricePair:q.pair,priceMethod:q.priceMethod,priceConversion:q.conversion||null,history:{...c.history,[checkedAt.slice(0,10)]:q.price}};});
 if(updated){await fs.writeFile(file+'.tmp',JSON.stringify({...prev,updatedAt:checkedAt,source:'Official exchange spot quotes; see per-coin priceSource and priceMethod',data:{...prev.data,coins}}));await fs.rename(file+'.tmp',file);}
 await fs.writeFile('data/crypto-quotes-status.json',JSON.stringify({runId:process.env.GITHUB_RUN_ID||null,checkedAt,updated,total:coins.length,sources,errors}));console.log(`Crypto quotes ${updated}/${coins.length}`);return {updated,total:coins.length};
}
