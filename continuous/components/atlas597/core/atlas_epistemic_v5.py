#!/usr/bin/env python3
from __future__ import annotations
from dataclasses import asdict,dataclass,field
from datetime import datetime,timezone
from pathlib import Path
from typing import Any
from uuid import uuid4
import json,os,re,sys
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'memory'))
from atlas_text_utils import jaccard_similarity

def now(): return datetime.now(timezone.utc).isoformat()
@dataclass
class Claim:
    claim:str; confidence:float=.5; source_type:str='inference'; supporting:list[str]=field(default_factory=list); counter:list[str]=field(default_factory=list); refutation_conditions:list[str]=field(default_factory=list); claim_id:str=field(default_factory=lambda:uuid4().hex[:12]); created_at:str=field(default_factory=now); updated_at:str=field(default_factory=now); history:list[dict[str,Any]]=field(default_factory=list)
    def __post_init__(self):
        self.confidence=max(0.,min(1.,float(self.confidence)))
        if self.source_type not in {'empirical','inference','assumption','speculation'}: self.source_type='inference'
class EpistemicLedger:
    SCHEMA='atlas.epistemic-ledger.v5'
    def __init__(self,path:str|Path,max_entries:int=1000):
        self.path=Path(path); self.max_entries=max_entries; self.data={'schema':self.SCHEMA,'claims':[],'refutations':[],'changes_of_mind':[],'turns':[],'negative_memory':[]}; self.load()
    def load(self):
        if not self.path.is_file(): return
        loaded=json.loads(self.path.read_text(encoding='utf-8'))
        for k in self.data:
            if k!='schema' and isinstance(loaded.get(k),list): self.data[k]=loaded[k]
        self.data['schema']=self.SCHEMA
    def save(self):
        self.path.parent.mkdir(parents=True,exist_ok=True); tmp=self.path.with_suffix(self.path.suffix+'.tmp'); tmp.write_text(json.dumps(self.data,ensure_ascii=False,indent=2),encoding='utf-8'); os.replace(tmp,self.path)
    def add_negative_lesson(self,lesson,context='',severity='medium'):
        if any(x.get('lesson')==lesson for x in self.data['negative_memory']): return
        self.data['negative_memory'].append({'ts':now(),'lesson':lesson,'context':context,'severity':severity}); self.data['negative_memory']=self.data['negative_memory'][-self.max_entries:]
    def refute(self,claim,reason,new_position=''):
        self.data['refutations'].append({'ts':now(),'claim':claim,'reason':reason,'new_position':new_position}); self.data['refutations']=self.data['refutations'][-self.max_entries:]
    def similar_refutations(self,idea,threshold=.28,top_k=5):
        scored=[(jaccard_similarity(idea,x.get('claim','')),x) for x in self.data['refutations']]; return [x for s,x in sorted(scored,key=lambda z:-z[0]) if s>=threshold][:top_k]
    def similar_lessons(self,idea,threshold=.20,top_k=5):
        scored=[(jaccard_similarity(idea,x.get('lesson','')+' '+x.get('context','')),x) for x in self.data['negative_memory']]; return [x for s,x in sorted(scored,key=lambda z:-z[0]) if s>=threshold][:top_k]
    def record_turn(self,value): self.data['turns'].append({'ts':now(),**value}); self.data['turns']=self.data['turns'][-200:]; self.save()
class EpistemicEngine:
    VERSION='ATLAS_EPISTEMIC_V5'
    def __init__(self,path): self.ledger=EpistemicLedger(path)
    def memory_warning(self,q): return {'refutations':self.ledger.similar_refutations(q),'lessons':self.ledger.similar_lessons(q)}
    @staticmethod
    def parse_json(text,required=()):
        clean=text.strip(); fenced=re.search(r'```(?:json)?\s*(\{.*?\})\s*```',clean,re.S)
        if fenced: clean=fenced.group(1)
        else:
            s,e=clean.find('{'),clean.rfind('}'); clean=clean[s:e+1] if s>=0 and e>s else clean
        v=json.loads(clean)
        if not isinstance(v,dict): raise ValueError('Se esperaba objeto JSON')
        miss=[k for k in required if k not in v]
        if miss: raise ValueError(f'Faltan claves: {miss}')
        return v
    @staticmethod
    def audit_prompt(q,w): return f"ATLAS_EPISTEMIC_V5_AUDIT\nDevuelve SOLO JSON: question_type, assumptions[], missing_evidence[], rival_hypotheses[], risk_level, needs[].\nPregunta:{q!r}\nMemoria negativa:{w!r}"
    @staticmethod
    def adversary_prompt(d): return f"ATLAS_EPISTEMIC_V5_ADVERSARY\nDevuelve SOLO JSON: weakest_claim, hidden_assumption, confounder, rival_story, ignored_evidence, verdict(keep|revise|reject).\nBorrador:{d!r}"
    @staticmethod
    def revision_prompt(q,d,a,c): return f"ATLAS_EPISTEMIC_V5_REVISION\nResponde en español de forma directa. Corrige según auditoría y adversario. Etiqueta solo afirmaciones principales. No muestres cadena privada.\nPregunta:{q}\nBorrador:{d}\nAuditoría:{a}\nCrítica:{c}"
SEED_NEGATIVE_LESSONS=[('Exploración sin poda produce volumen, no conocimiento.','high'),('Más detectores no mejoraron necesariamente la abstención.','high'),('Señales sintéticas no siempre transportan a datos reales.','high'),('Modelos locales pequeños de 1.5B fallaron en contratos estructurados y no inventar.','high'),('Desviación hacia mercados/finanzas cuando el objetivo era epistemológico.','medium'),('Una metáfora geométrica elegante no es evidencia predictiva.','high'),('Fingir capacidades ausentes destruye credibilidad.','high'),('Una ganancia en una sola seed no demuestra robustez; exigir múltiples seeds y controles.','high'),('Un endpoint configurado no equivale a un backend operativo; verificar conexión y modelo real.','high')]
def bootstrap_negative_memory(ledger):
    for lesson,sev in SEED_NEGATIVE_LESSONS: ledger.add_negative_lesson(lesson,severity=sev)
    ledger.save()
