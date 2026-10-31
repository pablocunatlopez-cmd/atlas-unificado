from __future__ import annotations
import json, time, hashlib
from pathlib import Path
from typing import Any
from atlas_paths import ensure_layout
from .codex_bridge import plan, review
from .codex_live import codex_available, ask as codex_ask
from .openai_collab import openai_available, ask as openai_ask

_DATA=ensure_layout(); LOG_DIR=_DATA['logs']/'council'


def council_available()->dict[str,Any]:
    return {'codex':codex_available(),'openai':openai_available()}


def _score(rec:dict)->tuple[int,int]:
    status=rec.get('review',{}).get('status','BLOCK')
    rank={'PASS':3,'WARN':2,'BLOCK':0}.get(status,0)
    findings=len(rec.get('review',{}).get('findings',[]))
    return rank,-findings


def ask(question:str,history:list[dict[str,str]]|None=None)->dict[str,Any]:
    availability=council_available(); p=plan(question); candidates=[]; errors=[]
    if availability['codex'].get('available'):
        try: candidates.append({'source':'codex','record':codex_ask(question,history)})
        except Exception as e: errors.append({'source':'codex','error':type(e).__name__+': '+str(e)})
    if availability['openai'].get('available'):
        try: candidates.append({'source':'openai','record':openai_ask(question,history)})
        except Exception as e: errors.append({'source':'openai','error':type(e).__name__+': '+str(e)})
    if not candidates:
        raise RuntimeError('Consejo sin colaboradores disponibles: configura Codex CLI y/o OPENAI_API_KEY')
    candidates.sort(key=lambda x:_score(x['record']),reverse=True)
    eligible = [c for c in candidates if c['record'].get('status') != 'BLOCKED' and c['record'].get('review', {}).get('status') in {'PASS', 'WARN'}]
    if not eligible:
        raise RuntimeError('Todos los colaboradores fueron bloqueados por Atlas')
    chosen=eligible[0]
    final=chosen['record']['answer']
    final_review=review(question,final)
    if final_review.get('status') not in {'PASS', 'WARN'}:
        raise RuntimeError('La revisión final de Atlas bloqueó la respuesta del consejo')
    disagreements=[]
    if len(candidates)>1:
        for c in candidates[1:]:
            if c['record']['answer'].strip()!=final.strip(): disagreements.append(c['source'])
    rec={'mode':'ATLAS_COUNCIL','question':question,'plan':p,'chosen_source':chosen['source'],'answer':final,'review':final_review,'candidates':[{ 'source':c['source'],'status':c['record'].get('review',{}).get('status'),'answer':c['record'].get('answer',''),'meta':c['record'].get(c['source'],{}) } for c in candidates], 'disagreements':disagreements,'errors':errors,'ts':time.time()}
    LOG_DIR.mkdir(parents=True,exist_ok=True); payload=json.dumps(rec,ensure_ascii=False,sort_keys=True).encode(); rid=hashlib.sha256(payload).hexdigest()[:16]; (LOG_DIR/f'{int(time.time())}_{rid}.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2),encoding='utf-8')
    return rec
