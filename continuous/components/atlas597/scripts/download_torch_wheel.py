"""Resumable official PyTorch wheel download, with published SHA256 verification."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urljoin, unquote, urlparse
import argparse, hashlib, html, json, re, threading, time, shutil

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--flavor', choices=['cpu','cu121'], default='cu121')
    parser.add_argument('--workers', type=int, default=8)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    filename = f'torch-2.5.1+{args.flavor}-cp312-cp312-win_amd64.whl'
    folder = root/'runtime_data'/'cache'/('torch_'+args.flavor)
    folder.mkdir(parents=True, exist_ok=True)
    index_url = f'https://download.pytorch.org/whl/{args.flavor}/torch/'
    with urlopen(index_url, timeout=45) as response:
        page = response.read().decode()
    links = re.findall(r'href="([^"]+)"', page)
    link = next(html.unescape(x) for x in links if unquote(urlparse(html.unescape(x)).path).endswith('/'+filename))
    url = urljoin(index_url, link)
    expected = urlparse(url).fragment.removeprefix('sha256=')
    if not re.fullmatch('[0-9a-f]{64}', expected):
        raise RuntimeError('Missing official SHA256')
    url = url.split('#')[0]
    if urlparse(url).hostname not in {'download.pytorch.org','download-r2.pytorch.org'}:
        raise RuntimeError('Unexpected wheel host')
    with urlopen(Request(url, method='HEAD', headers={'User-Agent':'Mozilla/5.0'}), timeout=45) as response:
        total = int(response.headers['Content-Length'])
    target = folder/filename
    partial = folder/(filename+'.part')
    manifest = folder/'progress.json'
    contract = {'url':url, 'bytes':total, 'sha256':expected, 'range_size':8*1024*1024}
    if target.exists():
        with target.open('rb') as stream:
            if hashlib.file_digest(stream,'sha256').hexdigest() == expected:
                print('VERIFIED_WHEEL='+str(target), flush=True)
                return
        raise RuntimeError('Existing wheel failed SHA verification')
    state = json.loads(manifest.read_text()) if manifest.exists() else {**contract, 'completed':[]}
    if any(state.get(k) != v for k,v in contract.items()):
        raise RuntimeError('Download contract changed')
    if not partial.exists():
        if state['completed']:
            raise RuntimeError('Partial file missing')
        if shutil.disk_usage(folder).free < total + 1024**3:
            raise RuntimeError('Insufficient download space')
        with partial.open('wb') as stream:
            stream.truncate(total)
    if partial.stat().st_size != total:
        raise RuntimeError('Partial file has unexpected length')
    lock = threading.Lock()
    size = contract['range_size']
    parts = [(i,start,min(total-1,start+size-1)) for i,start in enumerate(range(0,total,size))]
    done = set(state['completed'])
    started = time.monotonic()
    print(json.dumps({**contract,'completed_ranges':len(done),'total_ranges':len(parts)}), flush=True)
    def download(part):
        i,start,end = part
        if i in done:
            return
        for attempt in range(10):
            have = 0
            try:
                request = Request(url, headers={'Range':f'bytes={start}-{end}', 'User-Agent':'Mozilla/5.0'})
                with urlopen(request, timeout=60) as response, partial.open('r+b', buffering=0) as output:
                    if response.status != 206 or response.headers.get('Content-Range') != f'bytes {start}-{end}/{total}':
                        raise RuntimeError('Range not honored')
                    output.seek(start)
                    while have < end-start+1:
                        chunk = response.read(min(256*1024,end-start+1-have))
                        if not chunk:
                            raise RuntimeError('Incomplete range')
                        output.write(chunk)
                        have += len(chunk)
                with lock:
                    done.add(i)
                    temporary = manifest.with_suffix('.tmp')
                    temporary.write_text(json.dumps({**contract,'completed':sorted(done)}))
                    temporary.replace(manifest)
                    if len(done)%8 == 0 or len(done)==len(parts):
                        print(f'{len(done)}/{len(parts)} ranges verified by length; elapsed {time.monotonic()-started:.0f}s', flush=True)
                return
            except Exception as exc:
                print(f'Range {i} retry {attempt+1}: {type(exc).__name__}', flush=True)
                time.sleep(min(5,attempt+1))
        raise RuntimeError(f'Range {i} failed')
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for future in as_completed([pool.submit(download,p) for p in parts]):
            future.result()
    with partial.open('rb') as stream:
        actual = hashlib.file_digest(stream,'sha256').hexdigest()
    if actual != expected:
        raise RuntimeError('SHA256 mismatch; do not install')
    partial.replace(target)
    (folder/'verified.json').write_text(json.dumps({**contract,'path':str(target)},indent=2))
    print('VERIFIED_WHEEL='+str(target), flush=True)

if __name__=='__main__':
    main()
