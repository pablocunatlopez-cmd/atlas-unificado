from __future__ import annotations
import re
CLAIMS=('HECHO','INFERENCIA','HIPOTESIS','METAFORA','AXIOMA','INCERTIDUMBRE','REFUTADO')
VERDICTS=('SUPPORTED','TENTATIVE','UNKNOWN','REFUTED','INSUFFICIENT_EVIDENCE','ABSTAIN')
NEEDS=('NONE','SOURCE','EXECUTOR','TEST','MORE_EVIDENCE')

def encode_decision(claim,verdict,need='NONE',confidence='LOW'):
    assert claim in CLAIMS and verdict in VERDICTS and need in NEEDS
    return f'<|decision|><C>{claim}</C><V>{verdict}</V><N>{need}</N><Q>{confidence}</Q><|/decision|>'

def parse_decision(text):
    out={}
    for key,tag,allowed in [('claim','C',CLAIMS),('verdict','V',VERDICTS),('need','N',NEEDS)]:
        m=re.search(fr'<{tag}>(.*?)</{tag}>',text,re.S)
        out[key]=m.group(1).strip() if m else None
        if out[key] not in allowed: out[key]=None
    m=re.search(r'<Q>(.*?)</Q>',text,re.S); out['confidence']=m.group(1).strip() if m else None
    out['valid']=all(out[k] is not None for k in ('claim','verdict','need'))
    return out
