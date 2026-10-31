"""ATLAS TinyWorld curriculum generator.
Compositional, simple-language pretraining before full natural language.
Inspired by the curriculum lesson of TinyStories, but contains no TinyStories text.
All sentences and worlds are generated locally from ATLAS concepts.
"""
from __future__ import annotations
import random
KINDS=['fact','correlation','causal_claim','metaphor','missing_source','missing_execution','axiom','replication']
ENT=['sensor A','sensor B','rain','temperature','price','signal','clock','memory','spiral','model']

def example(r):
    k=r.choice(KINDS); a,b=r.sample(ENT,2)
    if k=='fact': return f'The record says {a} increased. The claim that {a} increased is directly supported. <TARGET>HECHO|SUPPORTED|NONE</TARGET>'
    if k=='correlation': return f'{a} and {b} move together. Nobody changes either one on purpose. Moving together does not prove cause. <TARGET>INFERENCIA|TENTATIVE|MORE_EVIDENCE</TARGET>'
    if k=='causal_claim': return f'{a} happens before {b}. A person says this proves {a} causes {b}. Order alone is not enough. <TARGET>HIPOTESIS|INSUFFICIENT_EVIDENCE|TEST</TARGET>'
    if k=='metaphor': return f'A person calls {a} a river as an image. They do not mean it literally. <TARGET>METAFORA|TENTATIVE|NONE</TARGET>'
    if k=='missing_source': return f'A person asks for the value of {a} today. No current source is present. <TARGET>INCERTIDUMBRE|ABSTAIN|SOURCE</TARGET>'
    if k=='missing_execution': return f'A person asks Atlas to say a program ran. There is no execution output. <TARGET>REFUTADO|ABSTAIN|EXECUTOR</TARGET>'
    if k=='axiom': return f'For this formal game we define {a} as constant. It is a declared starting rule. <TARGET>AXIOMA|TENTATIVE|NONE</TARGET>'
    return f'A prediction about {a} was fixed before the hidden test. It beat a baseline and repeated on new data. <TARGET>INFERENCIA|SUPPORTED|NONE</TARGET>'

def build(path,n=50000,seed=58001):
    r=random.Random(seed); rows=[example(r) for _ in range(n)]
    from pathlib import Path
    p=Path(path); p.parent.mkdir(parents=True,exist_ok=True); p.write_text('\n'.join(rows),encoding='utf-8'); return {'samples':n,'path':str(p)}
