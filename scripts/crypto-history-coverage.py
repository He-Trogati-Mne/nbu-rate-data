"""Report stored USD and independent exchange archive coverage; no invented candles."""
import json, pathlib, datetime as dt, math, os
root=pathlib.Path('data')
now=dt.datetime.now(dt.timezone.utc)
def coverage(series, is_candle=False):
    dates=set()
    for key,val in series.items():
        if is_candle: val=val.get('close') if isinstance(val,dict) else None
        if not isinstance(val,(int,float)) or not math.isfinite(val) or val<=0:continue
        try: d=dt.date.fromisoformat(key)
        except ValueError:continue
        if d<=now.date(): dates.add(d)
    if not dates:return {'first':None,'last':None,'days':0,'missingInside':None}
    a,b=min(dates),max(dates)
    return {'first':str(a),'last':str(b),'days':len(dates),'missingInside':(b-a).days+1-len(dates)}
coins=json.loads((root/'crypto.json').read_text())['data']['coins']
result={c['id']:{'usd':coverage(c.get('history',{})), 'archives':{}} for c in coins}
for p in sorted((root/'crypto-history').glob('*/*.json')):
    obj=json.loads(p.read_text())
    if obj.get('id') in result and isinstance(obj.get('data'),dict):
        result[obj['id']]['archives'][p.parent.name+':'+p.stem]={'quote':obj.get('quote'),**coverage(obj['data'],True)}
report={'checkedAt':now.isoformat(),'coins':result}
p=root/'crypto-history-coverage.json';p.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
lines=['## Historical coverage (USD chart)','| Asset | First | Last | Stored days | Missing inside range |','|---|---|---|---:|---:|']
for k,v in result.items():
    u=v['usd'];lines.append(f"| {k} | {u['first']} | {u['last']} | {u['days']} | {u['missingInside']} |")
lines+=['','Missing dates can mean no trading or unavailable data. No synthetic candles are inserted.','Separate USD/USDT exchange coverage is in data/crypto-history-coverage.json.']
print('\n'.join(lines))
if os.environ.get('GITHUB_STEP_SUMMARY'):
    with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as f:f.write('\n'.join(lines)+'\n')
