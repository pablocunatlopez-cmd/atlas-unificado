from __future__ import annotations
import hashlib, json, os, shutil, subprocess, tempfile, time
from pathlib import Path
from typing import Any
from .codex_bridge import plan, review
from atlas_paths import ensure_layout

ROOT=Path(__file__).resolve().parent.parent
_DATA=ensure_layout()
LOG_DIR=_DATA['logs']/'codex_live'


def codex_available() -> dict[str,Any]:
    exe=shutil.which('codex')
    if not exe:
        return {'available':False,'path':None,'version':None,'doctor_ok':None,'doctor':None,'reason':'Codex CLI no está en PATH'}
    # IMPORTANT: executable presence gates availability. `codex doctor` is advisory only:
    # it can fail on transient network/provider checks while `codex exec` still works.
    version=None; doctor=None; doctor_ok=None
    try:
        p=subprocess.run([exe,'--version'],cwd=ROOT,capture_output=True,text=True,timeout=10)
        if p.returncode==0:
            version=(p.stdout or p.stderr).strip()[-500:]
    except Exception:
        pass
    try:
        p=subprocess.run([exe,'doctor','--json'],cwd=ROOT,capture_output=True,text=True,timeout=25)
        doctor_ok=(p.returncode==0)
        doctor=(p.stdout+p.stderr)[-4000:]
    except Exception as e:
        doctor_ok=False
        doctor=type(e).__name__+': '+str(e)
    return {
        'available':True,
        'path':exe,
        'version':version,
        'doctor_ok':doctor_ok,
        'doctor':doctor,
        'reason':None if doctor_ok is not False else 'Codex está instalado; `doctor` dio aviso/error, pero Atlas probará `codex exec` al usarlo.'
    }


def _history_text(history:list[dict[str,str]]|None,limit:int=6)->str:
    if not history:return '(sin historial previo)'
    parts=[]
    for row in history[-limit:]:
        u=row.get('user','').strip(); a=row.get('assistant','').strip()
        if u: parts.append('Pablo: '+u)
        if a: parts.append('Atlas: '+a)
    return '\n'.join(parts)[:12000]


def _run_codex(prompt:str, timeout:int=900)->tuple[str,dict]:
    exe=shutil.which('codex')
    if not exe: raise RuntimeError('Codex CLI no está instalado o no está en PATH')
    tmpdir=_DATA['tmp']; tmpdir.mkdir(parents=True,exist_ok=True)
    fd,path=tempfile.mkstemp(prefix='codex_',suffix='.txt',dir=tmpdir); os.close(fd)
    out=Path(path)
    started=time.time()
    cmd=[exe,'exec','--skip-git-repo-check','--output-last-message',str(out),prompt]
    try:
        p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,timeout=timeout)
    except subprocess.TimeoutExpired as e:
        raise RuntimeError(f'Codex excedió el timeout de {timeout}s. stdout={((e.stdout or "")[-1000:])!r} stderr={((e.stderr or "")[-1000:])!r}') from e
    text=out.read_text(encoding='utf-8',errors='replace').strip() if out.exists() else ''
    # Some Codex builds can finish successfully yet fail to write --output-last-message.
    # If so, use non-empty stdout as a defensive fallback before declaring failure.
    if not text and (p.stdout or '').strip():
        text=p.stdout.strip()
    try: out.unlink(missing_ok=True)
    except Exception: pass
    meta={'returncode':p.returncode,'elapsed_s':round(time.time()-started,3),'stdout_tail':p.stdout[-3000:],'stderr_tail':p.stderr[-3000:],'cmd':'codex exec --skip-git-repo-check --output-last-message <tmp> <prompt>'}
    if p.returncode!=0:
        detail=(p.stderr or p.stdout or '').strip()[-3000:]
        raise RuntimeError('Codex falló (exit '+str(p.returncode)+'): '+detail)
    if not text:
        raise RuntimeError('Codex terminó sin respuesta final. Ejecuta `codex --version` y prueba `codex exec "di hola"` en una terminal para comprobar autenticación.')
    return text,meta


def _prompt(question:str, p:dict, history:list[dict[str,str]]|None=None, correction:dict|None=None, prior_answer:str|None=None)->str:
    contract=json.dumps(p,ensure_ascii=False,indent=2)
    base=f'''Eres la capa lingüística/ejecutora de ATLAS. ATLAS-LM y su tribunal son el sistema epistemológico; tú aportas lenguaje y herramientas reales cuando estén disponibles.

PREGUNTA DE PABLO:
{question}

CONTRATO PREVIO DE ATLAS:
{contract}

HISTORIAL RECIENTE:
{_history_text(history)}

Reglas de salida:
- Responde a Pablo en español, de forma útil y directa.
- No digas que Atlas o tú habéis navegado/ejecutado algo salvo que realmente ocurra en esta ejecución.
- Si usas herramientas o web, conserva evidencia suficiente para sostener la afirmación.
- No reveles razonamiento privado/cadena de pensamiento; da conclusiones, pruebas y límites auditables.
- No llames teoría física a LOR/ATLAS-SL sin evidencia diferencial.
- Devuelve SOLO la respuesta final para Pablo, sin JSON de control ni prefacios sobre este contrato.
'''
    if correction:
        base += '\nATLAS BLOQUEÓ/ADVERTIÓ EL BORRADOR ANTERIOR. Corrígelo.\nREVISIÓN:\n'+json.dumps(correction,ensure_ascii=False,indent=2)
        if prior_answer: base += '\nBORRADOR ANTERIOR:\n'+prior_answer[:16000]
    return base


def _log(record:dict):
    LOG_DIR.mkdir(parents=True,exist_ok=True)
    payload=json.dumps(record,ensure_ascii=False,sort_keys=True).encode()
    rid=hashlib.sha256(payload).hexdigest()[:16]
    (LOG_DIR/f'{int(time.time())}_{rid}.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')


def ask(question:str,history:list[dict[str,str]]|None=None,max_revisions:int=2,timeout:int=900)->dict[str,Any]:
    p=plan(question); answer,meta=_run_codex(_prompt(question,p,history),timeout=timeout); r=review(question,answer)
    revisions=[]
    for i in range(max_revisions):
        if r['status']=='PASS': break
        # WARN and BLOCK both get one chance to improve; hard BLOCK is never silently ignored.
        new,meta2=_run_codex(_prompt(question,p,history,r,answer),timeout=timeout)
        revisions.append({'before_status':r['status'],'before_findings':r['findings'],'codex':meta2})
        answer=new; r=review(question,answer)
    status='BLOCKED' if r['status']=='BLOCK' else 'OK'
    record={'mode':'ATLAS_CODEX_LIVE','question':question,'plan':p,'answer':answer,'review':r,'status':status,'codex':meta,'revisions':revisions,'ts':time.time()}
    _log(record)
    return record


def interactive():
    info=codex_available()
    print('ATLAS CODEX LIVE')
    print('Codex:', 'OK' if info['available'] else 'NO DISPONIBLE')
    if not info['available']:
        print(info.get('reason') or '')
        print('Puedes usar `python atlas.py own-chat` mientras instalas/inicias Codex.')
        return 3
    print("Escribe 'salir' para terminar. /plan <texto> muestra solo el contrato de Atlas.")
    history=[]
    while True:
        try:q=input('\nPablo> ').strip()
        except (EOFError,KeyboardInterrupt):break
        if q.lower() in {'salir','exit','quit'}:break
        if not q:continue
        if q.startswith('/plan '):
            print(json.dumps(plan(q[6:]),ensure_ascii=False,indent=2)); continue
        try:
            rec=ask(q,history)
            if rec['status']=='BLOCKED':
                print('\nAtlas> He bloqueado la respuesta de Codex porque sigue incumpliendo el tribunal.')
                print(json.dumps(rec['review'],ensure_ascii=False,indent=2))
            else:
                print('\nAtlas> '+rec['answer'])
                if rec['review']['status']=='WARN': print('\n[ATLAS WARN] '+json.dumps(rec['review']['findings'],ensure_ascii=False))
                history.append({'user':q,'assistant':rec['answer']})
        except Exception as e:
            print('\n[ERROR ATLAS/CODEX] '+type(e).__name__+': '+str(e))
    return 0
