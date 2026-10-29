"""Selectively extract CC0 model files from the official asset ZIP via HTTP ranges."""
import io
import hashlib
import argparse
import json
import urllib.request
import zipfile
from pathlib import Path

URL = 'https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip'
ROOT = Path(__file__).resolve().parents[1] / '.lab' / 'character-master' / 'system-assets'
ROOT.mkdir(parents=True, exist_ok=True)
parser=argparse.ArgumentParser()
parser.add_argument('--parts',nargs='+',default=['male_casualsuit05/','short01/','shoes01/'])
parser.add_argument('--manifest',default='source.json')
parser.add_argument('--textures',action='store_true')
args=parser.parse_args()

class RemoteZip(io.RawIOBase):
    def __init__(self):
        with urllib.request.urlopen(urllib.request.Request(URL, method='HEAD'), timeout=30) as r:
            self.size = int(r.headers['Content-Length'])
        self.pos = 0
        self.cache = []

    def seekable(self): return True
    def tell(self): return self.pos
    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else self.pos + offset if whence == 1 else self.size + offset
        return self.pos

    def read(self, n=-1):
        end = self.size if n < 0 else min(self.size, self.pos + n)
        for start, body in self.cache:
            if start <= self.pos and end <= start + len(body):
                result = body[self.pos-start:end-start]; self.pos = end; return result
        start = self.pos
        request = urllib.request.Request(URL, headers={'Range': f'bytes={start}-{end-1}'})
        with urllib.request.urlopen(request, timeout=40) as r:
            if r.status != 206: raise RuntimeError('Server did not honor Range')
            body = r.read()
        self.cache.append((start, body))
        self.pos = end
        return body

with zipfile.ZipFile(RemoteZip()) as archive:
    names = archive.namelist()
    (ROOT / 'contents.json').write_text(json.dumps(names, indent=2), encoding='utf8')
    selected = [n for n in names if any(k in n for k in args.parts)
                and n.endswith(('.obj', '.mhclo', '.mhmat', '.mhw', '.txt', '.license')+ (('.png',) if args.textures else ()))]
    records=[]
    for name in selected:
        destination = (ROOT / name).resolve()
        if not destination.is_relative_to(ROOT.resolve()): raise RuntimeError('Unsafe ZIP path')
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists(): destination.write_bytes(archive.read(name))
        print(name, destination.stat().st_size, flush=True)
        records.append({'file':name,'sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),'zipCrc32':archive.getinfo(name).CRC})
    (ROOT / args.manifest).write_text(json.dumps({'url': URL, 'selected': records}, indent=2), encoding='utf8')
