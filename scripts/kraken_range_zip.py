"""Read the published Kraken multipart ZIP by standard HTTP byte ranges.
Only works when the origin explicitly supports ranges; never bypass restrictions.
ZIP member CRCs are verified by zipfile, not the full archive SHA256.
"""
import io, re, bisect, collections, urllib.request
BASE='https://assets.kraken.com/marketing/institutions/Kraken_OHLCVT_Full.zip.part'
class KrakenRangeZIP(io.RawIOBase):
    def __init__(self, urls=None, opener=None, block=1024*1024):
        super().__init__(); self.urls=urls or [BASE+f'{i:02}' for i in range(5)]; self.opener=opener or urllib.request.urlopen
        self.block=block; self.cache=collections.OrderedDict(); self.pos=0; self.ends=[]; self.tags=[]
        for u in self.urls:
            with self.request(u,0,0) as r:
                m=re.fullmatch(r'bytes 0-0/(\d+)',r.headers.get('Content-Range',''))
                if r.status!=206 or not m or len(r.read(2))!=1: raise OSError('Kraken origin does not support byte ranges; use local full archive')
                size=int(m[1]); self.ends.append((self.ends[-1] if self.ends else 0)+size); self.tags.append(r.headers.get('ETag'))
    def request(self,url,start,end,tag=None):
        headers={'Range':f'bytes={start}-{end}','Accept-Encoding':'identity','User-Agent':'NBU-Rate-Dataset/1.0'}
        if tag and not tag.startswith('W/'): headers['If-Match']=tag
        return self.opener(urllib.request.Request(url,headers=headers),timeout=45)
    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos
    def seek(self,off,whence=0):
        p=off if whence==0 else self.pos+off if whence==1 else self.ends[-1]+off if whence==2 else -1
        if p<0: raise OSError('Negative seek')
        self.pos=p;return p
    def read(self,n=-1):
        n=min(self.ends[-1]-self.pos,n if n>=0 else self.ends[-1]-self.pos)
        if n<=0:return b''
        out=bytearray()
        while n:
            part=bisect.bisect_right(self.ends,self.pos); base=self.ends[part-1] if part else 0; rel=self.pos-base; size=self.ends[part]-base
            start=rel//self.block*self.block; end=min(start+self.block,size)-1; key=(part,start)
            if key not in self.cache:
                with self.request(self.urls[part],start,end,self.tags[part]) as r:
                    if r.status!=206 or r.headers.get('Content-Range')!=f'bytes {start}-{end}/{size}': raise OSError('Invalid Kraken byte range')
                    tag=r.headers.get('ETag')
                    if self.tags[part] and tag!=self.tags[part]: raise OSError('Kraken archive changed during read')
                    data=r.read(end-start+2)
                    if len(data)!=end-start+1: raise OSError('Short Kraken range')
                self.cache[key]=data
                if len(self.cache)>16:self.cache.popitem(last=False)
            self.cache.move_to_end(key); b=self.cache[key]; take=min(n,len(b)-(rel-start)); out.extend(b[rel-start:rel-start+take]);self.pos+=take;n-=take
        return bytes(out)
