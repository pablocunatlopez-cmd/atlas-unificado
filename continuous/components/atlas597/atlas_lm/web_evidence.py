"""Tool-mediated web evidence envelope for ATLAS. The LM never claims browsing itself.
A trusted host (Codex/ChatGPT/local search adapter) supplies retrieved records.
"""
from __future__ import annotations
from urllib.parse import urlparse
import hashlib,json

def make_envelope(question,records):
    clean=[]
    for r in records:
        url=str(r.get('url','')).strip(); txt=str(r.get('text','')).strip(); title=str(r.get('title','')).strip()
        if not urlparse(url).scheme.startswith('http') or not txt: continue
        clean.append({'url':url,'title':title,'text':txt[:2400],'retrieved_at':r.get('retrieved_at')})
    payload={'question':question,'records':clean}; canon=json.dumps(payload,ensure_ascii=False,sort_keys=True)
    payload['sha256']=hashlib.sha256(canon.encode()).hexdigest(); return payload

def to_prompt(env):
    rows=['<WEB_EVIDENCE sha256='+env['sha256']+'>']
    for i,r in enumerate(env['records'],1): rows += [f'<SOURCE id="{i}" url="{r["url"]}">',r['text'],'</SOURCE>']
    rows += ['</WEB_EVIDENCE>',f'<USER>{env["question"]}</USER>','<DECIDE>']
    return '\n'.join(rows)
