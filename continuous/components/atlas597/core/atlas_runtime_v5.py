#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
from typing import Any, Optional
import json, os, sys, urllib.request, time
ROOT=Path(__file__).resolve().parent.parent
sys.path[:0]=[str(ROOT),str(ROOT/'core'),str(ROOT/'memory'),str(ROOT/'legacy_4_3')]
from atlas_provider import ProviderResolver,ProviderKind,capability_prompt_block,ProviderError,ProviderUnavailable,ProviderTimeout,ProviderProtocolError
from atlas_epistemic_v5 import EpistemicEngine,bootstrap_negative_memory
from atlas_offline_deliberation import OfflineDeliberator
try:
    from atlas_lor import context_for as lor_context_for
except Exception:
    lor_context_for=lambda q,force=False:''
DEFAULT_LEDGER=ROOT/'memory'/'atlas_epistemic_state_v5.json'
CONSTITUTION_PATH=ROOT/'docs'/'ATLAS_5.0_CONSTITUTION.md'
SYSTEM_PROMPT_PATH=ROOT/'docs'/'ATLAS_5.0_SYSTEM_PROMPT.txt'

def load_text(p): return p.read_text(encoding='utf-8') if p.is_file() else ''

class AtlasV5:
    def __init__(self,ledger_path:Path|str=DEFAULT_LEDGER,provider_resolver:Optional[ProviderResolver]=None):
        self.epistemic=EpistemicEngine(ledger_path); bootstrap_negative_memory(self.epistemic.ledger)
        self.provider=provider_resolver or ProviderResolver(); self.capability=self.provider.detect()
        self.constitution=load_text(CONSTITUTION_PATH); self.base_system=load_text(SYSTEM_PROMPT_PATH) or 'Eres Atlas 5.0. No finjas capacidades.'
        self.history=[]; self._hf=None; self._tok=None; self.call_trace=[]
        self.offline=OfflineDeliberator(ROOT,self.capability,self.epistemic.ledger)
    def _system_message(self,q=''):
        return self.base_system+'\n\n=== CONSTITUCIÓN CANÓNICA ===\n'+self.constitution+'\n\n'+capability_prompt_block(self.capability)+'\n\n=== LENGUAJE INTERNO ===\nUsa ATLAS-SL como representación auditable cuando ayude: K, S*, tipo de claim, evidencia a favor/en contra, falsador, incertidumbre, memoria negativa y decisión. No expongas razonamiento privado paso a paso.\n\n'+lor_context_for(q)
    def _openai_compat(self,endpoint,model,messages,temperature,key=''):
        body=json.dumps({'model':model,'messages':messages,'temperature':temperature,'max_tokens':1400}).encode()
        headers={'Content-Type':'application/json'}
        if key: headers['Authorization']='Bearer '+key
        req=urllib.request.Request(endpoint,data=body,headers=headers,method='POST')
        try:
            with urllib.request.urlopen(req,timeout=180) as r: p=json.loads(r.read().decode())
        except TimeoutError as e:
            raise ProviderTimeout('Timeout del proveedor OpenAI-compatible',provider=self.capability.provider.value,model=model,cause=type(e).__name__) from e
        except Exception as e:
            raise ProviderUnavailable('Fallo del proveedor OpenAI-compatible',provider=self.capability.provider.value,model=model,cause=type(e).__name__) from e
        try:
            return p['choices'][0]['message']['content'].strip()
        except Exception as e:
            raise ProviderProtocolError('Respuesta incompatible con el contrato chat/completions',provider=self.capability.provider.value,model=model,cause=type(e).__name__) from e
    def _call_model(self,messages,temperature=.3):
        c=self.capability; cfg=self.provider.config; started=time.perf_counter(); ok=False; err=''
        try:
            if not c.has_language_model: raise ProviderUnavailable('No hay modelo lingüístico real disponible.',provider=c.provider.value,model=c.model_name)
            if c.provider==ProviderKind.OLLAMA:
                host=os.getenv('OLLAMA_HOST',cfg.ollama_host).rstrip('/')
                body=json.dumps({'model':c.model_name,'messages':messages,'stream':False,'options':{'temperature':temperature}}).encode()
                req=urllib.request.Request(host+'/api/chat',data=body,headers={'Content-Type':'application/json'},method='POST')
                try:
                    with urllib.request.urlopen(req,timeout=180) as r: p=json.loads(r.read().decode())
                except TimeoutError as e: raise ProviderTimeout('Timeout de Ollama',provider='ollama',model=c.model_name,cause=type(e).__name__) from e
                except Exception as e: raise ProviderUnavailable('Ollama dejó de estar disponible',provider='ollama',model=c.model_name,cause=type(e).__name__) from e
                try: out=p['message']['content'].strip()
                except Exception as e: raise ProviderProtocolError('Respuesta de Ollama inválida',provider='ollama',model=c.model_name,cause=type(e).__name__) from e
            elif c.provider==ProviderKind.OPENAI_COMPAT:
                out=self._openai_compat(os.getenv('ATLAS_OPENAI_COMPAT_ENDPOINT',cfg.openai_compat_endpoint),c.model_name,messages,temperature,os.getenv('ATLAS_OPENAI_COMPAT_KEY',''))
            elif c.provider==ProviderKind.REMOTE_XAI:
                out=self._openai_compat(cfg.remote_endpoint,c.model_name,messages,temperature,os.getenv(cfg.remote_api_key_env) or os.getenv('ATLAS_API_KEY',''))
            elif c.provider==ProviderKind.LOCAL_OWN:
                from atlas_lm.runtime import generate as atlas_lm_generate
                prompt='\n'.join(f"<{m.get('role','user').upper()}>\n{m.get('content','')}" for m in messages)+'\n<ASSISTANT>\n'
                rendered=atlas_lm_generate(c.model_name,prompt,max_new_tokens=700,temperature=temperature,completion_only=True)
                out=rendered.split('<ASSISTANT>')[-1].strip()
            elif c.provider==ProviderKind.TRANSFORMERS:
                if self._hf is None:
                    from transformers import AutoModelForCausalLM,AutoTokenizer
                    local_only=os.getenv('ATLAS_TRANSFORMERS_LOCAL_ONLY','1')!='0'
                    self._tok=AutoTokenizer.from_pretrained(c.model_name,local_files_only=local_only)
                    self._hf=AutoModelForCausalLM.from_pretrained(c.model_name,device_map='auto',local_files_only=local_only)
                prompt=self._tok.apply_chat_template(messages,tokenize=False,add_generation_prompt=True)
                inputs=self._tok(prompt,return_tensors='pt').to(self._hf.device)
                kwargs={'max_new_tokens':1000,'do_sample':temperature>0}
                if temperature>0: kwargs['temperature']=max(.01,temperature)
                gen=self._hf.generate(**inputs,**kwargs)
                out=self._tok.decode(gen[0][inputs['input_ids'].shape[1]:],skip_special_tokens=True).strip()
            else: raise ProviderUnavailable('Proveedor no implementado',provider=c.provider.value,model=c.model_name)
            ok=True; return out
        except ProviderError as e:
            err=e.code; raise
        finally:
            self.call_trace.append({'provider':c.provider.value,'model':c.model_name,'temperature':float(temperature),'latency_s':round(time.perf_counter()-started,6),'ok':ok,'error_code':err,'message_count':len(messages)})
            self.call_trace=self.call_trace[-200:]

    def _json_contract(self, messages, required, temperature=.15):
        """Obtiene JSON estructurado con un único intento de reparación si el modelo rompe el contrato."""
        raw=self._call_model(messages,temperature)
        try:
            return self.epistemic.parse_json(raw,required), raw
        except Exception as first_error:
            repair=[
                {'role':'system','content':'Repara formato. Devuelve SOLO un objeto JSON válido, sin markdown ni explicación.'},
                {'role':'user','content':f'Claves obligatorias: {list(required)}\nTexto defectuoso: {raw[:2000]}'}
            ]
            repaired=self._call_model(repair,0.0)
            try:
                return self.epistemic.parse_json(repaired,required), repaired
            except Exception as second_error:
                return {'error':str(second_error),'first_error':str(first_error),'raw':repaired[:500]}, repaired

    def consult_core(self, question:str)->dict[str,Any]:
        """Consulta el núcleo estructurado incluso sin LLM. No finge conversación generativa."""
        result=self.offline.consult(question)
        self.epistemic.ledger.record_turn({'question':question,'mode':'offline_core_deliberation','decision':result.get('decision','')})
        return result

    def ask(self,question:str,use_full_pipeline=True)->dict[str,Any]:
        required=self.provider.requirements_for_question(question) if os.getenv('ATLAS_STRICT_CAPABILITY_GATING','1').lower() not in {'0','false','no'} else ['language_model']
        abstain,reason=self.provider.must_abstain(required)
        if abstain:
            result={'answer':'Me abstengo. '+reason,'abstained':True,'required_capabilities':required,'provider':self.capability.to_dict()}; self.epistemic.ledger.record_turn({'question':question,**result}); return result
        warnings=self.epistemic.memory_warning(question)
        if not use_full_pipeline:
            answer=self._call_model([{'role':'system','content':self._system_message(question)},*self.history[-8:],{'role':'user','content':question}])
            self.history += [{'role':'user','content':question},{'role':'assistant','content':answer}]
            return {'answer':answer,'abstained':False,'provider':self.capability.to_dict(),'pipeline':'simple'}
        audit,audit_raw=self._json_contract([{'role':'system','content':self._system_message(question)},{'role':'user','content':self.epistemic.audit_prompt(question,warnings)}],('question_type','assumptions','missing_evidence','rival_hypotheses','risk_level','needs'),.15)
        draft=self._call_model([{'role':'system','content':self._system_message(question)},*self.history[-6:],{'role':'user','content':f'Pregunta: {question}\nAuditoría:{audit}\nEscribe borrador.'}],.35)
        challenge,adv_raw=self._json_contract([{'role':'system','content':self._system_message(question)},{'role':'user','content':self.epistemic.adversary_prompt(draft)}],('weakest_claim','verdict'),.2)
        if 'verdict' not in challenge: challenge['verdict']='revise'
        final=self._call_model([{'role':'system','content':self._system_message(question)},{'role':'user','content':self.epistemic.revision_prompt(question,draft,audit,challenge)}],.25)
        self.history += [{'role':'user','content':question},{'role':'assistant','content':final}]; self.history=self.history[-16:]
        result={'answer':final,'abstained':False,'provider':self.capability.to_dict(),'audit':audit,'challenge':challenge,'pipeline':'full_v5','call_trace':self.call_trace[-6:]}
        self.epistemic.ledger.record_turn({'question':question,'answer_preview':final[:400],'provider':self.capability.provider.value,'model':self.capability.model_name,'adversary_verdict':challenge.get('verdict')})
        return result

def self_test():
    a=AtlasV5(); print(a.capability.summary_for_prompt()); print('negative_memory=',len(a.epistemic.ledger.data['negative_memory'])); print('SELF_TEST_V5_OK')
if __name__=='__main__': self_test()
