#!/usr/bin/env python3
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Optional
import json, os, urllib.request, urllib.error, socket


def now() -> str:
    return datetime.now(timezone.utc).isoformat()

class ProviderKind(str, Enum):
    LOCAL_OWN='local_own'; OLLAMA='ollama'; TRANSFORMERS='transformers'; OPENAI_COMPAT='openai_compat'; REMOTE_XAI='remote_xai'; REMOTE_OTHER='remote_other'; NONE='none'

class ProviderError(RuntimeError):
    code='PROVIDER_ERROR'
    def __init__(self,message:str,*,provider:str='',model:str='',cause:str=''):
        super().__init__(message); self.provider=provider; self.model=model; self.cause=cause
    def to_dict(self): return {'code':self.code,'message':str(self),'provider':self.provider,'model':self.model,'cause':self.cause}
class ProviderUnavailable(ProviderError): code='PROVIDER_UNAVAILABLE'
class ProviderTimeout(ProviderError): code='PROVIDER_TIMEOUT'
class ProviderProtocolError(ProviderError): code='PROVIDER_PROTOCOL_ERROR'

@dataclass
class CapabilityReport:
    has_language_model: bool
    provider: ProviderKind
    model_name: str
    model_version: str=''
    has_internet: bool=False
    has_code_execution: bool=False
    has_persistent_memory: bool=True
    has_web_ingest: bool=False
    max_context_tokens: int=0
    verified: bool=False
    notes: list[str]=field(default_factory=list)
    timestamp: str=field(default_factory=now)
    has_decision_model: bool=False
    def to_dict(self)->dict[str,Any]:
        d=asdict(self); d['provider']=self.provider.value; return d
    def summary_for_prompt(self)->str:
        yn=lambda x:'sí' if x else 'no'
        lines=[f'Proveedor activo: {self.provider.value}', f'Modelo: {self.model_name or "(ninguno)"}', f'Modelo lingüístico disponible: {yn(self.has_language_model)}', f'Modelo de decisión disponible: {yn(self.has_decision_model)}', f'Proveedor verificado por conexión: {yn(self.verified)}', f'Internet/web: {yn(self.has_internet or self.has_web_ingest)}', f'Ejecución de código: {yn(self.has_code_execution)}']
        if self.notes: lines.append('Notas: '+'; '.join(self.notes))
        return '\n'.join(lines)

@dataclass
class ProviderConfig:
    preferred_order:list[ProviderKind]=field(default_factory=lambda:[ProviderKind.LOCAL_OWN,ProviderKind.TRANSFORMERS,ProviderKind.OLLAMA,ProviderKind.OPENAI_COMPAT,ProviderKind.REMOTE_XAI])
    ollama_host:str='http://127.0.0.1:11434'
    ollama_model:str='atlas-lm:latest'
    transformers_model:str=''
    openai_compat_endpoint:str=''
    openai_compat_model:str=''
    remote_endpoint:str='https://api.x.ai/v1/chat/completions'
    remote_model:str='grok-4-latest'
    remote_api_key_env:str='XAI_API_KEY'
    allow_remote:bool=True
    require_explicit_remote:bool=True
    timeout_seconds:float=1.5

class ProviderResolver:
    def __init__(self, config:Optional[ProviderConfig]=None, state_path:Optional[Path]=None):
        self.config=config or ProviderConfig(); self.state_path=state_path; self._last_report=None

    def _http_json(self,url:str,headers:dict[str,str]|None=None,method='GET',data:bytes|None=None)->Any:
        req=urllib.request.Request(url,data=data,headers=headers or {},method=method)
        try:
            with urllib.request.urlopen(req,timeout=self.config.timeout_seconds) as r:
                return json.loads(r.read().decode('utf-8'))
        except (TimeoutError, socket.timeout) as e:
            raise ProviderTimeout(f'Timeout conectando con {url}',cause=type(e).__name__) from e
        except urllib.error.URLError as e:
            raise ProviderUnavailable(f'No se pudo conectar con {url}',cause=type(e.reason).__name__) from e
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            raise ProviderProtocolError(f'Respuesta no JSON de {url}',cause=type(e).__name__) from e

    def _verify_ollama(self,host:str,model:str)->tuple[bool,str]:
        host=host.rstrip('/')
        try:
            payload=self._http_json(host+'/api/tags')
            names={m.get('name','') for m in payload.get('models',[])}
            if model in names or any(n.split(':')[0]==model.split(':')[0] for n in names):
                return True,'Ollama responde y el modelo aparece instalado'
            return False,'Ollama responde, pero el modelo configurado no aparece instalado'
        except ProviderError as e:
            return False,f'Ollama no verificable: {e.code}'

    @staticmethod
    def _configured_openai_endpoint(endpoint:str)->bool:
        return endpoint.startswith('http://') or endpoint.startswith('https://')

    def detect(self)->CapabilityReport:
        c=self.config
        local_only = os.getenv('ATLAS_LOCAL_ONLY', '0').lower() in {'1', 'true', 'yes'}
        for kind in ([ProviderKind.LOCAL_OWN] if local_only else c.preferred_order):
            if kind==ProviderKind.LOCAL_OWN:
                model=os.getenv('ATLAS_LOCAL_OWN_MODEL','').strip()
                if local_only and not model:
                    model = str(Path(__file__).resolve().parents[1] / 'models' / 'atlas-lm-0.3-decision-nano-v2')
                if model:
                    from atlas_lm.runtime import inspect_checkpoint
                    from atlas_paths import resolve_model_path
                    try:
                        p, model_config, _, task = inspect_checkpoint(resolve_model_path(model))
                        import importlib.util
                        torch_present = importlib.util.find_spec('torch') is not None
                    except (ValueError, OSError, TypeError):
                        continue
                    return self._set(CapabilityReport(
                        torch_present and task == 'causal_lm', kind, str(p),
                        max_context_tokens=model_config.max_seq_len, verified=False,
                        has_decision_model=torch_present and task == 'decision',
                        notes=['Checkpoint propio de ' + task + '; competencia no certificada',
                               'Archivos validados; la carga real se verifica al inferir']))
            elif kind==ProviderKind.OLLAMA:
                host=os.getenv('OLLAMA_HOST',c.ollama_host)
                model=os.getenv('ATLAS_MODEL',c.ollama_model)
                if host.startswith(('http://127.0.0.1','http://localhost')) or os.getenv('OLLAMA_HOST') or os.getenv('ATLAS_MODEL_ENDPOINT'):
                    ok,note=self._verify_ollama(host,model)
                    if ok: return self._set(CapabilityReport(True,kind,model,verified=True,notes=[note]))
            elif kind==ProviderKind.TRANSFORMERS:
                model=os.getenv('ATLAS_TRANSFORMERS_MODEL',c.transformers_model).strip()
                if model:
                    local_only=os.getenv('ATLAS_TRANSFORMERS_LOCAL_ONLY','1')!='0'
                    verified=Path(model).expanduser().exists() if local_only else True
                    if verified: return self._set(CapabilityReport(True,kind,model,verified=verified,notes=['Backend Transformers configurado']))
            elif kind==ProviderKind.OPENAI_COMPAT:
                endpoint=os.getenv('ATLAS_OPENAI_COMPAT_ENDPOINT',c.openai_compat_endpoint).strip()
                model=os.getenv('ATLAS_OPENAI_COMPAT_MODEL',c.openai_compat_model).strip()
                if endpoint and model and self._configured_openai_endpoint(endpoint):
                    return self._set(CapabilityReport(True,kind,model,verified=False,notes=['Endpoint OpenAI-compatible configurado; se verificará al llamar']))
            elif kind==ProviderKind.REMOTE_XAI:
                key=os.getenv(c.remote_api_key_env) or os.getenv('ATLAS_API_KEY')
                explicit=os.getenv('ATLAS_ALLOW_REMOTE','').lower() in {'1','true','yes'}
                allowed=c.allow_remote and bool(key) and (explicit or not c.require_explicit_remote)
                if allowed: return self._set(CapabilityReport(True,kind,os.getenv('ATLAS_MODEL',c.remote_model),verified=False,has_internet=False,notes=['Proveedor remoto autorizado; API remota no implica navegación web']))
        return self._set(CapabilityReport(False,ProviderKind.NONE,'',verified=False,notes=['No se detectó backend lingüístico operativo']))

    def _set(self,r):
        # Autorización y disponibilidad son condiciones distintas: no declarar una herramienta solo por un flag.
        code_authorized=os.getenv('ATLAS_CODE_EXECUTION','0').lower() in {'1','true','yes'}
        executor=os.getenv('ATLAS_CODE_EXECUTOR','').strip()
        r.has_code_execution = bool(code_authorized and executor and Path(executor).expanduser().is_file())
        web_authorized=os.getenv('ATLAS_WEB_INGEST','0').lower() in {'1','true','yes'}
        web_endpoint=os.getenv('ATLAS_WEB_ENDPOINT','').strip()
        r.has_web_ingest = bool(web_authorized and web_endpoint.startswith(('http://','https://')))
        r.has_internet = r.has_web_ingest
        if code_authorized and not r.has_code_execution: r.notes.append('Ejecución autorizada pero sin ejecutor verificado: capacidad NO declarada')
        if web_authorized and not r.has_web_ingest: r.notes.append('Web autorizada pero sin endpoint verificado/configurado: capacidad NO declarada')
        self._last_report=r
        if self.state_path:
            try:
                self.state_path.parent.mkdir(parents=True,exist_ok=True)
                self.state_path.write_text(json.dumps(r.to_dict(),ensure_ascii=False,indent=2),encoding='utf-8')
            except OSError: pass
        return r
    def get_last_report(self): return self._last_report or self.detect()
    @staticmethod
    def requirements_for_question(question:str)->list[str]:
        import re
        q=question.lower(); req=['language_model']
        web_patterns=(r'\bprecio actual\b',r'\bcotizaci[oó]n actual\b',r'\bahora mismo\b',r'\b[úu]ltima(?:s)? noticia',r'\bbusca (?:en )?internet\b',r'\ben la web\b',r'\bdatos en tiempo real\b')
        code_patterns=(r'\bejecuta\b',r'\bcorre (?:este )?c[oó]digo\b',r'\bmonte carlo\b.*\b(?:p-?valor|resultado exacto)\b',r'\bcompila\b.*\bc[oó]digo\b')
        if any(re.search(p,q) for p in web_patterns): req.append('internet')
        if any(re.search(p,q) for p in code_patterns): req.append('code_execution')
        return req
    def must_abstain(self,required:list[str])->tuple[bool,str]:
        r=self.get_last_report(); missing=[]
        if 'language_model' in required and not r.has_language_model: missing.append('modelo lingüístico')
        if 'internet' in required and not (r.has_internet or r.has_web_ingest): missing.append('acceso web')
        if 'code_execution' in required and not r.has_code_execution: missing.append('ejecución de código')
        return (bool(missing), ('Faltan capacidades requeridas: '+', '.join(missing)+'. '+r.summary_for_prompt()) if missing else '')

def capability_prompt_block(r:CapabilityReport)->str:
    return '=== TRIBUNAL DE CAPACIDADES ATLAS 5.0 ===\n'+r.summary_for_prompt()+'\nRegla: no afirmes capacidades ausentes.\n========================================='
