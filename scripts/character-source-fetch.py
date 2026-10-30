"""Fetch pinned CC0 MakeHuman source data for the offline character trial."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

DEST = Path(__file__).resolve().parents[1] / '.lab' / 'character-master' / 'source'
DEST.mkdir(parents=True, exist_ok=True)
COMMIT = 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482'
FILES = {
    'base.obj': 'makehuman/data/3dobjs/base.obj',
    'default.mhskel': 'makehuman/data/rigs/default.mhskel',
    'default_weights.mhw': 'makehuman/data/rigs/default_weights.mhw',
    'male-young.target': 'makehuman/data/targets/macrodetails/asian-male-young.target',
    'male-build.target': 'makehuman/data/targets/macrodetails/universal-male-young-averagemuscle-averageweight.target',
    'LICENSE.ASSETS.md': 'LICENSE.ASSETS.md',
}

def fetch(item):
    name, path = item
    url = f'https://raw.githubusercontent.com/makehumancommunity/makehuman/{COMMIT}/{path}'
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=45) as response:
                body = response.read()
            (DEST / name).write_bytes(body)
            print(f'{name}: {len(body)} bytes', flush=True)
            return {'file': name, 'url': url, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}
        except Exception:
            if attempt == 2:
                raise

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    records = list(pool.map(fetch, FILES.items()))
(DEST / 'manifest.json').write_text(json.dumps({'commit': COMMIT, 'files': records}, indent=2), encoding='utf-8')
