from __future__ import annotations
import re, hashlib

def compact(records, question='', max_chars=900):
    """Compress host-retrieved evidence into a stable ATLAS-SL-ish envelope.
    Extractive only: never invents facts absent from records.
    """
    qterms={w for w in re.findall(r'[a-záéíóúñ0-9_.-]{4,}', question.lower())}
    rows=[]
    for i,r in enumerate(records,1):
        text=' '.join(str(r.get('text','')).split())
        sents=re.split(r'(?<=[.!?])\s+', text)
        ranked=sorted(sents,key=lambda s:sum(t in s.lower() for t in qterms),reverse=True)
        excerpt=' '.join(ranked[:3])[:max_chars]
        if not excerpt: continue
        url=str(r.get('url','')).strip()
        h=hashlib.sha256((url+'\n'+excerpt).encode()).hexdigest()[:16]
        rows.append(f'<EVIDENCE id="{i}" sha="{h}" url="{url}">{excerpt}</EVIDENCE>')
    return '<EVIDENCE_SET>\n'+'\n'.join(rows)+'\n</EVIDENCE_SET>'
