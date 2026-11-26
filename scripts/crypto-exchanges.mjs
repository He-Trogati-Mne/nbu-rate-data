// Public spot market data. Never treat USDT as USD. No keys, proxies or restricted hosts.
export const DAY=86400000;
export const PROVIDERS=['coinbase','kraken','binance','bybit'];
export const BASE={coinbase:'https://api.exchange.coinbase.com',kraken:'https://api.kraken.com',binance:'https://data-api.binance.vision',bybit:'https://api.bybit.com'};
export const QUOTE={coinbase:'USD',kraken:'USD',binance:'USDT',bybit:'USDT'};
export const LIMIT={coinbase:299,kraken:719,binance:999,bybit:999};
export const sleep=ms=>new Promise(r=>setTimeout(r,process.env.NBU_HISTORY_TEST==='1'?0:ms));
export const num=x=>x===null||x===''||x===undefined?NaN:Number(x);
export const positive=x=>Number.isFinite(x)&&x>0;
export const dayStart=t=>Math.floor(t/DAY)*DAY;
export function asset(c){return c.id==='the-open-network'?'TON':String(c.symbol||'').toUpperCase();}
const alias=x=>({XBT:'BTC',XDG:'DOGE'}[x]||x);
export function url(p,path,params={}){const u=new URL(path,BASE[p]);u.search=new URLSearchParams(params);return u;}
export function client(){const blocked=new Map(), network=new Map();return async(p,path,params)=>{
 if(blocked.has(p))throw Error(blocked.get(p));
 await sleep(180);
 let r;try{r=await fetch(url(p,path,params),{headers:{Accept:'application/json','User-Agent':'NBU-Rate-Dataset/1.0 (+https://github.com/He-Trogati-Mne/nbu-rate-data)'},signal:AbortSignal.timeout(12000)});}catch(e){const msg='Network: '+(e.cause?.code||e.name||e.message);const n=(network.get(p)||0)+1;network.set(p,n);if(n>=2)blocked.set(p,msg+'; paused for run');throw Error(msg);}
 network.set(p,0);
 if(!r.ok){const msg='HTTP '+r.status;if([401,403,418,429,451].includes(r.status))blocked.set(p,msg+'; paused for run');throw Error(msg);}
 const x=await r.json();if(p==='kraken'&&x.error?.length){const msg=x.error.join('; ');if(/rate limit|throttl/i.test(msg))blocked.set(p,msg);throw Error(msg);}if(p==='bybit'&&x.retCode!==0){const msg='Bybit '+x.retCode+': '+x.retMsg;if([10006,10009,10010].includes(x.retCode))blocked.set(p,msg);throw Error(msg);}return x;
};}
export async function markets(get,p){const out=new Map();const add=(base,quote,key)=>{if(/^[A-Z0-9]+$/.test(base)&&quote===QUOTE[p]&&base!==quote)out.set(base,{key,base,quote});};
 if(p==='coinbase'){const x=await get(p,'/products');if(!Array.isArray(x))throw Error('Unexpected products');for(const r of x)if(r.status==='online'&&!r.trading_disabled)add(r.base_currency,r.quote_currency,r.id);}
 if(p==='kraken'){const x=await get(p,'/0/public/AssetPairs');if(!x.result)throw Error('Unexpected AssetPairs');for(const [key,r] of Object.entries(x.result)){const [b,q]=String(r.wsname||'').split('/');if(r.status==='online'&&b&&q)add(alias(b),alias(q),key);}}
 if(p==='binance'){const x=await get(p,'/api/v3/exchangeInfo');if(!Array.isArray(x.symbols))throw Error('Unexpected exchangeInfo');for(const r of x.symbols)if(r.status==='TRADING'&&r.isSpotTradingAllowed!==false)add(r.baseAsset,r.quoteAsset,r.symbol);}
 if(p==='bybit'){const x=await get(p,'/v5/market/instruments-info',{category:'spot'});if(!Array.isArray(x.result?.list))throw Error('Unexpected instruments');for(const r of x.result.list)if(r.status==='Trading')add(r.baseCoin,r.quoteCoin,r.symbol);}
 if(!out.size)throw Error('No matching spot markets');return out;
}
export function candle(t,o,h,l,c,v,q=null){const [open,high,low,close,volumeBase,volumeQuote]=[o,h,l,c,v,q].map(num);if(!Number.isSafeInteger(t)||t<0||t%DAY!==0||![open,high,low,close].every(positive)||high<Math.max(open,close)||low>Math.min(open,close)||high<low)return null;return {t,open,high,low,close,volumeBase:Number.isFinite(volumeBase)&&volumeBase>=0?volumeBase:null,volumeQuote:Number.isFinite(volumeQuote)&&volumeQuote>=0?volumeQuote:null};}
export async function candles(get,p,m,start,end){let x,rows;
 if(p==='coinbase'){x=await get(p,`/products/${encodeURIComponent(m.key)}/candles`,{granularity:'86400',start:new Date(start).toISOString(),end:new Date(end-1).toISOString()});if(!Array.isArray(x))throw Error('Unexpected candles');rows=x.map(r=>candle(num(r[0])*1000,r[3],r[2],r[1],r[4],r[5]));}
 if(p==='kraken'){x=await get(p,'/0/public/OHLC',{pair:m.key,interval:'1440',since:String(Math.floor(start/1000))});const result=x.result||{};const k=Object.keys(result).find(k=>k!=='last');if(!Array.isArray(result[k]))throw Error('Unexpected OHLC');rows=result[k].map(r=>candle(num(r[0])*1000,r[1],r[2],r[3],r[4],r[6]));}
 if(p==='binance'){x=await get(p,'/api/v3/klines',{symbol:m.key,interval:'1d',limit:'1000',startTime:String(start),endTime:String(end-1)});if(!Array.isArray(x))throw Error('Unexpected klines');rows=x.filter(r=>num(r[6])<end).map(r=>candle(num(r[0]),r[1],r[2],r[3],r[4],r[5],r[7]));}
 if(p==='bybit'){x=await get(p,'/v5/market/kline',{category:'spot',symbol:m.key,interval:'D',start:String(start),end:String(end-1),limit:'1000'});if(!Array.isArray(x.result?.list))throw Error('Unexpected kline');rows=x.result.list.map(r=>candle(num(r[0]),r[1],r[2],r[3],r[4],r[5],r[6]));}
 return rows.filter(r=>r&&r.t>=start&&r.t<end).sort((a,b)=>a.t-b.t);
}
const change=(a,b)=>positive(a)&&positive(b)?(a/b-1)*100:null;
export async function quotes(get,p,market,assets){const result=new Map();const add=(base,price,pct)=>{const m=market.get(base);if(m&&positive(price))result.set(base,{price,change24h:Number.isFinite(pct)?pct:null,provider:p,pair:m.key,quote:m.quote});};
 if(p==='coinbase'){for(const b of assets){const m=market.get(b);if(!m)continue;try{const r=await get(p,`/products/${encodeURIComponent(m.key)}/stats`);add(b,num(r.last),change(num(r.last),num(r.open)));}catch(e){console.warn(p,b,e.message);}}}
 if(p==='kraken'){const entries=[...assets].filter(b=>market.has(b));if(entries.length){const x=await get(p,'/0/public/Ticker',{pair:entries.map(b=>market.get(b).key).join(',')});for(const b of entries){const r=x.result?.[market.get(b).key];if(r)add(b,num(r.c?.[0]),null);}}}
 if(p==='binance'){const x=await get(p,'/api/v3/ticker/24hr');if(!Array.isArray(x))throw Error('Unexpected ticker');const by=new Map(x.map(r=>[r.symbol,r]));for(const b of assets){const r=by.get(market.get(b)?.key);if(r)add(b,num(r.lastPrice),num(r.priceChangePercent));}}
 if(p==='bybit'){const x=await get(p,'/v5/market/tickers',{category:'spot'});if(!Array.isArray(x.result?.list))throw Error('Unexpected tickers');const by=new Map(x.result.list.map(r=>[r.symbol,r]));for(const b of assets){const r=by.get(market.get(b)?.key);if(r)add(b,num(r.lastPrice),num(r.price24hPcnt)*100);}}
 return result;
}
// Direct USD preferred. USDT conversion requires an actual fresh USD/USDT price.
export function selectUsd(base,results){for(const p of ['coinbase','kraken']){const r=results[p]?.get(base);if(r)return {...r,priceMethod:'direct USD'};}
 const anchor=results.coinbase?.get('USDT')||results.kraken?.get('USDT');if(!anchor||!positive(anchor.price))return null;
 for(const p of ['binance','bybit']){const r=results[p]?.get(base);if(!r)continue;const pct=Number.isFinite(r.change24h)&&Number.isFinite(anchor.change24h)?((1+r.change24h/100)*(1+anchor.change24h/100)-1)*100:null;return {...r,price:r.price*anchor.price,change24h:pct,priceMethod:'USDT × USDT/USD',conversion:{provider:anchor.provider,pair:anchor.pair,price:anchor.price},originalPrice:r.price};}return null;
}
