from __future__ import annotations
import json, os, time, hashlib, urllib.request, urllib.error
from pathlib import Path
from typing import Any
from .codex_bridge import plan, review
from atlas_paths import ensure_layout

API_URL = os.getenv('ATLAS_OPENAI_RESPONSES_URL','https://api.openai.com/v1/responses')
DEFAULT_MODEL = os.getenv('OPENAI_MODEL','gpt-5.6-sol')
_DATA = ensure_layout()
LOG_DIR = _DATA['logs']/'openai_live'


def openai_available() -> dict[str,Any]:
    key=bool(os.getenv('OPENAI_API_KEY','').strip())
    return {
        'available': key,
        'model': os.getenv('OPENAI_MODEL',DEFAULT_MODEL),
        'api':'Responses API',
        'web_search_enabled': os.getenv('ATLAS_OPENAI_WEB','0')=='1',
        'reason': None if key else 'OPENAI_API_KEY no configurada. ChatGPT Plus y la API son credenciales/facturación separadas.',
    }


def _extract_text(data:dict)->str:
    # Responses API: prefer output_text if supplied by SDK-like gateways, else traverse output/content.
    if isinstance(data.get('output_text'),str) and data['output_text'].strip():
        return data['output_text'].strip()
    parts=[]
    for item in data.get('output') or []:
        for c in (item.get('content') or []) if isinstance(item,dict) else []:
            if isinstance(c,dict) and c.get('type') in {'output_text','text'}:
                txt=c.get('text')
                if isinstance(txt,str): parts.append(txt)
                elif isinstance(txt,dict) and isinstance(txt.get('value'),str): parts.append(txt['value'])
    return '\n'.join(x.strip() for x in parts if x and x.strip()).strip()


def _history_text(history:list[dict[str,str]]|None,limit:int=6)->str:
    if not history:return '(sin historial previo)'
    out=[]
    for row in history[-limit:]:
        if row.get('user'): out.append('Pablo: '+row['user'].strip())
        if row.get('assistant'): out.append('Atlas: '+row['assistant'].strip())
    return '\n'.join(out)[:12000]


def _prompt(question:str,p:dict,history=None,correction=None,prior_answer=None)->str:
    base=f'''Actúas como colaborador externo de ATLAS. No eres la identidad de ATLAS y no debes fingir ser la sesión de ChatGPT desde la que se creó el proyecto. Tu función es aportar capacidad lingüística, investigación y síntesis bajo el contrato epistemológico de ATLAS.

PREGUNTA DE PABLO:
{question}

CONTRATO ATLAS:
{json.dumps(p,ensure_ascii=False,indent=2)}

HISTORIAL RECIENTE:
{_history_text(history)}

REGLAS:
- Responde en español de forma útil y directa.
- No inventes fuentes, navegación, ejecuciones o resultados.
- Si usas búsqueda web de la API, cita URLs o referencias verificables cuando sean materialmente necesarias.
- Separa hechos, inferencias, hipótesis, metáforas e incertidumbre cuando importe.
- No reveles cadena de pensamiento privada. Da conclusiones, evidencia y límites auditables.
- Devuelve solo la respuesta destinada a Pablo.
'''
    if correction:
        base+='\nATLAS REVISÓ EL BORRADOR Y EXIGE CORRECCIÓN:\n'+json.dumps(correction,ensure_ascii=False,indent=2)
        if prior_answer: base+='\nBORRADOR ANTERIOR:\n'+prior_answer[:16000]
    return base


def _request(prompt:str,timeout:int=180)->tuple[str,dict]:
    key=os.getenv('OPENAI_API_KEY','').strip()
    if not key: raise RuntimeError('OPENAI_API_KEY no configurada')
    model=os.getenv('OPENAI_MODEL',DEFAULT_MODEL)
    payload={'model':model,'input':prompt}
    if os.getenv('ATLAS_OPENAI_WEB','0')=='1': payload['tools']=[{'type':'web_search'}]
    reasoning=os.getenv('ATLAS_OPENAI_REASONING','high').strip().lower()
    if reasoning in {'none','low','medium','high','xhigh','max'}:
        payload['reasoning']={'effort':reasoning}
    req=urllib.request.Request(API_URL,data=json.dumps(payload).encode('utf-8'),headers={
        'Authorization':'Bearer '+key,
        'Content-Type':'application/json',
        'User-Agent':'ATLAS/5.9.5'
    },method='POST')
    started=time.time()
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r:
            raw=r.read().decode('utf-8','replace'); status=getattr(r,'status',200)
    except urllib.error.HTTPError as e:
        body=e.read().decode('utf-8','replace')[-3000:]
        raise RuntimeError(f'OpenAI HTTP {e.code}: {body}') from e
    except Exception as e:
        raise RuntimeError('OpenAI request failed: '+type(e).__name__+': '+str(e)) from e
    data=json.loads(raw); text=_extract_text(data)
    if not text: raise RuntimeError('OpenAI Responses API terminó sin texto de salida')
    meta={'model':model,'status':status,'elapsed_s':round(time.time()-started,3),'response_id':data.get('id'),'web_search_enabled':bool(payload.get('tools'))}
    return text,meta


def _log(record:dict):
    LOG_DIR.mkdir(parents=True,exist_ok=True)
    redacted=dict(record)
    payload=json.dumps(redacted,ensure_ascii=False,sort_keys=True).encode()
    rid=hashlib.sha256(payload).hexdigest()[:16]
    (LOG_DIR/f'{int(time.time())}_{rid}.json').write_text(json.dumps(redacted,ensure_ascii=False,indent=2),encoding='utf-8')


def ask(question:str,history:list[dict[str,str]]|None=None,max_revisions:int=2,timeout:int=180)->dict[str,Any]:
    p=plan(question); answer,meta=_request(_prompt(question,p,history),timeout=timeout); r=review(question,answer)
    revisions=[]
    for _ in range(max_revisions):
        if r['status']=='PASS': break
        new,meta2=_request(_prompt(question,p,history,r,answer),timeout=timeout)
        revisions.append({'before_status':r['status'],'before_findings':r['findings'],'openai':meta2})
        answer=new; r=review(question,answer)
    status='BLOCKED' if r['status']=='BLOCK' else 'OK'
    rec={'mode':'ATLAS_OPENAI_LIVE','question':question,'plan':p,'answer':answer,'review':r,'status':status,'openai':meta,'revisions':revisions,'ts':time.time()}
    _log(rec); return rec
