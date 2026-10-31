from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Any
import json, os, re
from atlas_paths import ensure_layout, resolve_model_path

from .cognitive_kernel import arbitrate, render

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DECISION_MODEL = ROOT / 'models' / 'atlas-lm-0.3-decision-nano-v2'


def resolve_model(model_dir: str | None = None) -> Path | None:
    raw = (model_dir or os.getenv('ATLAS_LOCAL_OWN_MODEL','')).strip()
    if raw:
        p = resolve_model_path(raw)
        if (p/'model.pt').is_file() and (p/'config.json').is_file(): return p
    droot=ensure_layout()
    preferred=droot['models']/'atlas-lm-0.3-decision-nano-v2'
    if (preferred/'model.pt').is_file(): return preferred
    if (DEFAULT_DECISION_MODEL/'model.pt').is_file(): return DEFAULT_DECISION_MODEL
    candidates = sorted(droot['models'].glob('atlas-lm-*/model.pt')) + sorted((ROOT/'models').glob('atlas-lm-*/model.pt'))
    return candidates[-1].parent if candidates else None


def infer_requirements(question: str) -> list[str]:
    q=question.lower(); req=[]
    if re.search(r'\b(hoy|actual|ahora mismo|últim[oa]s?|reciente|precio|cotizaci[oó]n|noticia|web|internet)\b',q): req.append('web_if_fact_is_time_sensitive')
    if re.search(r'\b(ejecuta|corre|compila|prueba el código|test|pytest|benchmark)\b',q): req.append('real_execution_if_claiming_result')
    if re.search(r'\b(fuente|doi|paper|estudio|referencia|url)\b',q): req.append('verifiable_source')
    return req


def plan(question: str, model_dir: str | None = None) -> dict[str,Any]:
    model=resolve_model(model_dir)
    arb=arbitrate(question,str(model)) if model else arbitrate(question,None)
    d=arb['decision']; req=infer_requirements(question)
    must=[
        'No inventes fuentes, ejecuciones, resultados ni capacidades.',
        f'Respeta el veredicto ATLAS: {d.get("verdict")} y el tipo de claim: {d.get("claim")}.',
        'Separa hechos, inferencias, hipótesis, metáforas e incertidumbre cuando sea material.',
        'Si obtienes evidencia nueva, actualiza la conclusión; no defiendas la primera respuesta por inercia.',
        'Si una afirmación es falsable, indica qué dato o prueba la cambiaría cuando ayude.'
    ]
    if d.get('need')=='SOURCE' or 'verifiable_source' in req or 'web_if_fact_is_time_sensitive' in req:
        must.append('Usa una fuente verificable/actual antes de afirmar el dato; cita la fuente en la respuesta.')
    if d.get('need')=='EXECUTOR' or 'real_execution_if_claiming_result' in req:
        must.append('Ejecuta realmente el comando/test antes de afirmar su resultado y conserva la salida relevante.')
    if d.get('need')=='TEST': must.append('Propón o ejecuta una prueba diferencial que pueda refutar la conclusión.')
    return {
        'mode':'ATLAS_CODEX_BRIDGE_PLAN',
        'question':question,
        'atlas_model':str(model) if model else None,
        'atlas_decision':d,
        'decision_source':arb.get('source'),
        'lm_valid':bool((arb.get('lm') or {}).get('parsed',{}).get('valid')),
        'lm_disagrees_with_tribunal':arb.get('disagreement'),
        'requirements':req,
        'codex_contract':{
            'must':must,
            'forbidden':['Fabricar evidencia o citas.','Decir que ejecutaste o navegaste si no lo hiciste.','Promover LOR/ATLAS-SL a teoría física sin evidencia diferencial.','Ocultar un resultado negativo porque contradiga la hipótesis.'],
            'after_draft':'Ejecuta `python atlas.py codex-review --question "..." --answer-file <archivo>` y corrige cualquier BLOCK antes de responder al usuario.'
        }
    }


def review(question: str, answer: str) -> dict[str,Any]:
    q=question.lower(); a=answer.lower(); findings=[]
    def add(level,code,msg): findings.append({'level':level,'code':code,'message':msg})
    # Strong deception-risk patterns.
    if re.search(r'\b(ejecuté|he ejecutado|corrí|he corrido|compilé|tests? pasan|pytest.*passed)\b',a):
        if not re.search(r'\b(salida|exit code|passed|failed|stdout|stderr|comando:)\b',a):
            add('WARN','EXECUTION_EVIDENCE_THIN','Se afirma ejecución sin mostrar ninguna huella reproducible en la respuesta.')
    if re.search(r'\b(según|fuente|doi|http|www\.|paper|estudio)\b',a) and re.search(r'\b(inventad|fictici|ejemplo de doi)\b',a):
        add('BLOCK','POSSIBLE_FAKE_SOURCE','La respuesta parece mezclar una fuente con contenido inventado/ficticio.')
    if re.search(r'\b(hoy|actualmente|última versión|precio actual|ahora mismo)\b',a) and not re.search(r'https?://|\bcita\b|\bfuente\b',a):
        add('WARN','FRESH_FACT_UNSOURCED','Hay una afirmación temporalmente sensible sin indicio de fuente.')
    if ('lor' in a or 'atlas-sl' in a) and re.search(r'\b(demuestra|prueba|unifica|teoría física|curvatura física)\b',a) and not re.search(r'\b(no |todavía no|insuficiente|hipótesis|metáfora|estadística)\b',a):
        add('BLOCK','LOR_OVERCLAIM','Se detecta una promoción fuerte de LOR/ATLAS-SL sin contención epistemológica.')
    if re.search(r'\b(correlación|asociación)\b',a) and re.search(r'\b(causa|causó|provoca|demuestra que .* causa)\b',a) and not re.search(r'\b(no implica|no prueba|intervención|control|experimento)\b',a):
        add('BLOCK','CAUSALITY_OVERCLAIM','La respuesta parece pasar de asociación a causalidad sin soporte explícito.')
    # If user explicitly requested execution/current facts, enforce visible grounding markers.
    if re.search(r'\b(ejecuta|corre|compila|pytest|benchmark)\b',q) and re.search(r'\b(pas[ao]|resultado|ejecut)\b',a) and not re.search(r'\b(passed|failed|exit|salida|stdout|stderr|comando)\b',a):
        add('WARN','REQUESTED_EXECUTION_NOT_GROUNDED','La pregunta pedía ejecución y la respuesta no muestra una huella clara del ejecutor.')
    if re.search(r'\b(hoy|actual|últim[oa]|precio|noticia|web|internet)\b',q) and not re.search(r'https?://|\bfuente\b|\bcita\b',a):
        add('WARN','REQUESTED_FRESHNESS_NOT_GROUNDED','La pregunta exige frescura/web y la respuesta no muestra una fuente.')
    status='BLOCK' if any(f['level']=='BLOCK' for f in findings) else ('WARN' if findings else 'PASS')
    return {'mode':'ATLAS_CODEX_BRIDGE_REVIEW','status':status,'findings':findings,'question':question,'answer_chars':len(answer)}


def interactive(model_dir: str | None = None):
    model=resolve_model(model_dir)
    print('ATLAS OWN/HYBRID CHAT')
    print('Modelo de decisión:', model if model else '(ninguno)')
    print("Escribe 'salir' para terminar. Este modo es un tribunal/decision core, no un LLM general competente.")
    while True:
        try: q=input('\nPablo> ').strip()
        except (EOFError,KeyboardInterrupt): break
        if q.lower() in {'salir','exit','quit'}: break
        if not q: continue
        r=arbitrate(q,str(model)) if model else arbitrate(q,None)
        print('\nAtlas> '+render(r,q))
        print('['+json.dumps({'decision':r['decision'],'source':r['source'],'lm_valid':bool((r.get('lm') or {}).get('parsed',{}).get('valid')),'disagreement':r.get('disagreement')},ensure_ascii=False)+']')
