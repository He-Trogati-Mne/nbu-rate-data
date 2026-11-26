"""Import daily public spot candles from official Kraken/Binance ZIP files.
Run from repository root. No third-party packages. Never convert USDT into USD.
"""
import argparse, csv, datetime as dt, io, json, math, pathlib, re, sys, zipfile, time, os
from urllib.request import urlopen, Request
from urllib.error import HTTPError

ROOT = pathlib.Path('data')
DAY = 86400
TODAY = dt.datetime.now(dt.timezone.utc).date()

def load(p, default=None):
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else default

def save(p, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    tmp.replace(p)

def pair_names(base):
    aliases = {'BTC':['BTC','XBT','XXBT'], 'DOGE':['DOGE','XDG','XXDG'], 'ETH':['ETH','XETH'], 'LTC':['LTC','XLTC'], 'XRP':['XRP','XXRP'], 'XLM':['XLM','XXLM']}
    return {b+q for b in aliases.get(base,[base]) for q in ('USD','ZUSD')}

def read_rows(stream, provider):
    for row in csv.reader(io.TextIOWrapper(stream, encoding='utf-8-sig', newline='')):
        try:
            if len(row)<7: continue
            raw=int(row[0]); divisor=1 if provider=='kraken' else (1000000 if raw>=10**15 else 1000)
            t=raw//divisor
            if raw%divisor or t%DAY: continue
            date=dt.datetime.fromtimestamp(t,dt.timezone.utc).date()
            if date>=TODAY: continue
            o,h,l,c,v=map(float,row[1:6])
            if not all(math.isfinite(x) and x>0 for x in (o,h,l,c)) or not math.isfinite(v) or v<0 or h<max(o,c) or l>min(o,c) or h<l: continue
            q=float(row[7]) if provider=='binance' else None
            if q is not None and (not math.isfinite(q) or q<0): q=None
            yield date.isoformat(),dict(open=o,high=h,low=l,close=c,volumeBase=v,volumeQuote=q)
        except (ValueError,OverflowError,OSError,IndexError): continue

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--kraken',nargs='*',default=[],type=pathlib.Path,help='Official complete/reassembled ZIP or quarterly ZIP')
    ap.add_argument('--binance',nargs='*',default=[],type=pathlib.Path,help='Official daily/monthly 1d kline ZIP(s)')
    ap.add_argument('--kraken-remote', action='store_true', help='Selectively read official full Kraken archive via HTTP Range')
    ap.add_argument('--binance-all', action='store_true', help='Scan all monthly spot archives from 2017; resume using saved state')
    ap.add_argument('--binance-months',type=int,default=0,help='Download monthly ZIPs for existing Binance USDT markets (1–24)')
    ap.add_argument('--end-month',default=TODAY.replace(day=1).isoformat()[:7],help='Exclusive end YYYY-MM')
    args=ap.parse_args()
    if not (args.kraken or args.binance or args.binance_months or args.kraken_remote or args.binance_all): ap.error('Choose an archive or --binance-months')
    if not 0<=args.binance_months<=24: ap.error('months must be 0–24')
    doc=load(ROOT/'crypto.json'); coins=doc['data']['coins']; byid={c['id']:c for c in coins}
    bases={('TON' if c['id']=='the-open-network' else c['symbol'].upper()):c for c in coins}
    indexes={'kraken':{},'binance':{}}; cache={}; touched=set(); filled=0; added=0
    stamp=dt.datetime.now(dt.timezone.utc).isoformat()
    matched={"kraken":set(),"binance":set()}
    pending=None
    for provider in indexes:
        for p in sorted((ROOT/'crypto-history'/provider).glob('*.json')):
            obj=load(p,{})
            if obj.get('id') in byid and obj.get('quote')==('USD' if provider=='kraken' else 'USDT'):
                base=str(obj['base']).upper(); indexes[provider][base]=(p,obj)
    def merge(provider,base,rows):
        nonlocal filled, added
        if rows: matched[provider].add(base)
        coin=bases[base]; pair=base+('USD' if provider=='kraken' else 'USDT')
        # Reuse the exact file/key produced by REST whenever possible.
        p,obj=indexes[provider].get(base,(ROOT/'crypto-history'/provider/(pair+'.json'),dict(id=coin['id'],symbol=pair,base=base,quote='USD' if provider=='kraken' else 'USDT',source=provider,interval='1d',data={})))
        if p not in cache: cache[p]=obj
        obj=cache[p]; data=obj.setdefault('data',{}); n=0
        for date,v in rows:
            if date not in data: data[date]=v; added+=1;n+=1;touched.add(p)
            if provider=='kraken':
                if not isinstance(data[date],dict) or not isinstance(data[date].get('close'),(int,float)) or not math.isfinite(data[date]['close']) or data[date]['close']<=0: continue
                hist=coin.setdefault('history',{}); old=hist.get(date)
                if not isinstance(old,(int,float)) or not math.isfinite(old) or old<=0:
                    hist[date]=data[date]['close'];coin.setdefault('historySources',{})[date]='kraken:'+obj['symbol'];filled+=1
        if n: print(provider,base,'new archive days',n,flush=True)
    def import_zip(z,provider):
        for member in z.namelist():
            name=pathlib.PurePosixPath(member).name.upper()
            if provider=='kraken':
                m=re.fullmatch(r'([A-Z0-9]+)_1440\.CSV',name)
                if not m: continue
                base=next((b for b in bases if m[1] in pair_names(b)),None)
            else:
                m=re.fullmatch(r'([A-Z0-9]+)USDT-1D-\d{4}-\d{2}(?:-\d{2})?\.CSV',name)
                base=m[1] if m and m[1] in bases else None
            if base:
                with z.open(member) as f: rows=list(read_rows(f,provider))
                merge(provider,base,rows)
    for provider,paths in [('kraken',args.kraken),('binance',args.binance)]:
        for p in paths:
            with zipfile.ZipFile(p) as z: import_zip(z,provider)
    errors=[]; files=0; absent=0
    if args.kraken_remote:
        try:
            from kraken_range_zip import KrakenRangeZIP
            with KrakenRangeZIP() as remote, zipfile.ZipFile(remote) as z: import_zip(z,'kraken')
            if not matched['kraken']: raise ValueError('No matching daily USD files in Kraken archive')
        except (OSError, ValueError, zipfile.BadZipFile) as e:
            errors.append(f'Kraken remote: {e}')
    def flush():
        for p in touched:
            obj=cache[p];obj['archiveImportedAt']=stamp;save(p,obj)
        touched.clear()
        if filled:
            doc['historyCheckedAt']=stamp;doc['historyDate']=TODAY.isoformat();save(ROOT/'crypto.json',doc)
    # Checkpoint each successful Binance month. An absent recent file is retried next run.
    if args.binance_all:
        statepath=ROOT/'crypto-binance-monthly-state.json'
        state=load(statepath,{})
        if not isinstance(state,dict): raise ValueError('Invalid monthly state')
        complete=state.setdefault('completed',{})
        if not indexes['binance']: errors.append('Binance: run exchange history once to discover pairs')
        end=TODAY.year*12+TODAY.month-1
        start=2017*12+6
        deadline=time.monotonic()+35*60
        stop=False
        for i in range(end-1,start-1,-1):
            month=f'{i//12:04d}-{i%12+1:02d}'
            for base,(p,obj) in indexes['binance'].items():
                pair=obj['symbol']; key=pair+'/'+month
                if not re.fullmatch(r'[A-Z0-9]+USDT',pair) or key in complete: continue
                if time.monotonic()>deadline: stop=True;break
                name=f'{pair}-1d-{month}'
                url=f'https://data.binance.vision/data/spot/monthly/klines/{pair}/1d/{name}.zip'
                try:
                    with urlopen(Request(url,headers={'User-Agent':'NBU-Rate-Dataset/1.0'}),timeout=20) as r: payload=r.read(2_000_001)
                    if len(payload)>2_000_000: raise ValueError('Unexpected oversized daily ZIP')
                    with zipfile.ZipFile(io.BytesIO(payload)) as z:
                        expected=name+'.csv'
                        if expected not in z.namelist(): raise ValueError('Unexpected archive member')
                        with z.open(expected) as f:
                            rows=list(read_rows(f,'binance'))
                        if not rows or any(not d.startswith(month+'-') for d,v in rows): raise ValueError('Invalid monthly candles')
                        merge('binance',base,rows)
                    files+=1;complete[key]='imported'
                except HTTPError as e:
                    if e.code==404:
                        absent+=1
                        if i<end-2: complete[key]='not_found'
                    else:
                        errors.append(f'{pair} {month}: HTTP {e.code}');stop=True;break
                except (OSError,ValueError,zipfile.BadZipFile) as e:
                    errors.append(f'{pair} {month}: {e}');stop=True;break
                time.sleep(0.25)
            flush();save(statepath,state)
            if stop: break
        pending=sum(1 for i in range(start,end) for _,obj in indexes['binance'].values() if obj['symbol']+'/'+f'{i//12:04d}-{i%12+1:02d}' not in complete)
        print('Binance archive checkpoint',len(complete),'pair-months; pending:',pending,'time limit or error:',stop,flush=True)

    if args.binance_months:
        end=dt.date.fromisoformat(args.end_month+'-01'); end_idx=end.year*12+end.month-1
        if end>TODAY.replace(day=1): ap.error('end-month cannot be in the future')
        if not indexes['binance']: ap.error('Run existing Binance API workflow first to discover pairs')
        for i in range(end_idx-1,end_idx-args.binance_months-1,-1):
            month=f'{i//12:04d}-{i%12+1:02d}'
            for base,(p,obj) in indexes['binance'].items():
                pair=obj['symbol']; name=f'{pair}-1d-{month}'
                if not re.fullmatch(r'[A-Z0-9]+USDT',pair): continue
                url=f'https://data.binance.vision/data/spot/monthly/klines/{pair}/1d/{name}.zip'
                try:
                    with urlopen(Request(url,headers={'User-Agent':'NBU-Rate-Dataset/1.0'}),timeout=20) as r: payload=r.read(2_000_001)
                    if len(payload)>2_000_000: raise ValueError('Unexpected oversized daily ZIP')
                    with zipfile.ZipFile(io.BytesIO(payload)) as z: import_zip(z,'binance')
                    files+=1
                except HTTPError as e:
                    if e.code==404: absent+=1;continue
                    errors.append(f'{pair} {month}: HTTP {e.code}')
                    if e.code in (401,403,429,451): break
                except (OSError,ValueError,zipfile.BadZipFile) as e: errors.append(f'{pair} {month}: {e}')
            if errors: break
    flush()
    summary={'archiveDaysAdded':added,'usdDatesFilled':filled,'filesDownloaded':files,'filesNotFound':absent,'matchedAssets':{p:sorted(v) for p,v in matched.items()},'binancePendingMonths':pending,'errors':errors,'updatedAt':stamp,'runId':os.environ.get('GITHUB_RUN_ID')}
    print(json.dumps(summary,ensure_ascii=False));save(ROOT/'crypto-archive-import-status.json',summary)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as f: f.write('\n### Archive import ('+('Kraken' if args.kraken_remote or args.kraken else 'Binance')+')\n```json\n'+json.dumps(summary,ensure_ascii=False,indent=2)+'\n```\n')
    if errors or (args.binance_months and not files and absent): return 1
    return 0
if __name__=='__main__': sys.exit(main())
