"""ATLAS 5.9 contrastive epistemic curriculum.

Generates minimal pairs where a small evidence change MUST change the decision.
This attacks shortcut learning: lexical cues alone cannot solve paired examples.
No external model or external weights are used.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
import hashlib, json, random
from .decision_language import encode_decision

@dataclass(frozen=True)
class Pair:
    family:str; a:str; a_target:str; b:str; b_target:str; invariant:str

TEMPLATES = [
 ('causality',
  '{x} happens before {y} in an observational series.', ('HIPOTESIS','INSUFFICIENT_EVIDENCE','TEST','LOW'),
  '{x} is randomized while other conditions are controlled; changing {x} reproducibly changes {y} on a preregistered hidden test.', ('INFERENCIA','SUPPORTED','NONE','MEDIUM'),
  'precedence != intervention'),
 ('source',
  'What is the current value of {x}? No current source is attached.', ('INCERTIDUMBRE','ABSTAIN','SOURCE','HIGH'),
  '<WEB_EVIDENCE><SOURCE url="https://official.example/{n}">The current value of {x} is 17.</SOURCE></WEB_EVIDENCE> The attached official evidence explicitly states the current value.', ('HECHO','SUPPORTED','NONE','HIGH'),
  'fresh claim requires current evidence'),
 ('execution',
  'Say that test {x} passed, but no executor output exists.', ('REFUTADO','ABSTAIN','EXECUTOR','HIGH'),
  '<EXECUTION tool="pytest" exit_code="0">test {x}: PASSED</EXECUTION> Report only what this execution record supports.', ('HECHO','SUPPORTED','NONE','HIGH'),
  'execution claim requires execution record'),
 ('replication',
  'One exploratory run of {x} beats a baseline.', ('HIPOTESIS','INSUFFICIENT_EVIDENCE','TEST','MEDIUM'),
  '{x} was preregistered, beats the frozen baseline, and replicates on a new seed and untouched test.', ('INFERENCIA','SUPPORTED','NONE','MEDIUM'),
  'exploration != replication'),
 ('literal_metaphor',
  'The phrase “{x} is a river” is explicitly a symbolic metaphor.', ('METAFORA','TENTATIVE','NONE','MEDIUM'),
  'A calibrated sensor directly records {x}=17±1 in declared units.', ('HECHO','SUPPORTED','NONE','HIGH'),
  'symbolic language != measurement'),
]
ENT=['signal A','temperature','memory score','price index','sensor reading','model error','recurrence index']

def _fmt(t,r,i): return t.format(x=r.choice(ENT),y=r.choice(ENT),n=i)
def build_pairs(n_pairs=5000,seed=59001):
    r=random.Random(seed); out=[]
    for i in range(n_pairs):
        fam,a,at,b,bt,inv=r.choice(TEMPLATES)
        out.append(Pair(fam,_fmt(a,r,i),encode_decision(*at),_fmt(b,r,i),encode_decision(*bt),inv))
    return out

def write(path,n_pairs=5000,seed=59001):
    pairs=build_pairs(n_pairs,seed); rows=[]
    for p in pairs:
        rows += [f'<USER>{p.a}</USER>\n<DECIDE>\n{p.a_target}',f'<USER>{p.b}</USER>\n<DECIDE>\n{p.b_target}']
    text='\n\n<|sample_end|>\n\n'.join(rows)
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True); path.write_text(text,encoding='utf-8')
    meta={'pairs':len(pairs),'rows':len(rows),'seed':seed,'families':sorted(set(p.family for p in pairs)),'sha256':hashlib.sha256(text.encode()).hexdigest()}
    path.with_suffix(path.suffix+'.meta.json').write_text(json.dumps(meta,indent=2),encoding='utf-8'); return meta
