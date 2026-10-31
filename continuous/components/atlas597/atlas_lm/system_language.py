#!/usr/bin/env python3
"""ATLAS-SL 0.1 — lenguaje formal de sistemas de ATLAS.

No es lenguaje natural ni una teoría física. Es una representación intermedia
para describir marcos, afirmaciones, evidencia, transformaciones, falsadores y
decisiones de manera estable y auditable.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict
from enum import Enum
import json, re

class Claim(str, Enum):
    FACT="HECHO"; INFERENCE="INFERENCIA"; HYPOTHESIS="HIPOTESIS"; METAPHOR="METAFORA"
    AXIOM="AXIOMA"; UNCERTAINTY="INCERTIDUMBRE"; REFUTED="REFUTADO"

class Verdict(str, Enum):
    SUPPORTED="SUPPORTED"; TENTATIVE="TENTATIVE"; UNKNOWN="UNKNOWN"; REFUTED="REFUTED"
    HIDDEN_OR_SHARED_DRIVER="HIDDEN_OR_SHARED_DRIVER"; INSUFFICIENT_EVIDENCE="INSUFFICIENT_EVIDENCE"; ABSTAIN="ABSTAIN"

TOKENS = (
    "<|atlas|>", "<|/atlas|>", "<K>", "</K>", "<S>", "</S>", "<CLAIM>", "</CLAIM>",
    "<EVIDENCE>", "</EVIDENCE>", "<COUNTER>", "</COUNTER>", "<FALSIFIER>", "</FALSIFIER>",
    "<UNCERTAINTY>", "</UNCERTAINTY>", "<DECISION>", "</DECISION>", "<MEMORY_NEG>", "</MEMORY_NEG>",
    "<CAPABILITY>", "</CAPABILITY>", "<TRANSLATE>", "</TRANSLATE>", "<LOSS>", "</LOSS>",
    "<|decision|>", "<|/decision|>", "<C>", "</C>", "<V>", "</V>", "<N>", "</N>", "<Q>", "</Q>"
)

@dataclass
class KFrame:
    object: str; environment: str; perspective: str; scale: str

@dataclass
class AtlasState:
    O:str=""; A:str=""; X:str=""; R:str=""; T:str=""; I:str=""; C:str=""; E:str=""; M:str=""; P:str=""; F:str=""; Sigma:str=""

@dataclass
class SystemRecord:
    frame: KFrame
    claim_type: Claim
    claim: str
    evidence_for: list[str]
    evidence_against: list[str]
    falsifier: str
    uncertainty: str
    decision: Verdict
    state: AtlasState|None=None
    negative_memory: list[str]|None=None

    def to_dict(self):
        d=asdict(self); d['claim_type']=self.claim_type.value; d['decision']=self.decision.value; return d

    def to_sl(self) -> str:
        k=self.frame
        parts=["<|atlas|>",f"<K>O={esc(k.object)};A={esc(k.environment)};PI={esc(k.perspective)};E={esc(k.scale)}</K>"]
        if self.state:
            s=self.state
            parts.append("<S>"+";".join(f"{x}={esc(getattr(s,x))}" for x in ("O","A","X","R","T","I","C","E","M","P","F","Sigma"))+"</S>")
        parts += [f"<CLAIM>TYPE={self.claim_type.value}|TEXT={esc(self.claim)}</CLAIM>",
                  "<EVIDENCE>FOR="+listenc(self.evidence_for)+"|AGAINST="+listenc(self.evidence_against)+"</EVIDENCE>",
                  f"<FALSIFIER>{esc(self.falsifier)}</FALSIFIER>",f"<UNCERTAINTY>{esc(self.uncertainty)}</UNCERTAINTY>"]
        if self.negative_memory: parts.append("<MEMORY_NEG>"+listenc(self.negative_memory)+"</MEMORY_NEG>")
        parts += [f"<DECISION>{self.decision.value}</DECISION>","<|/atlas|>"]
        return "\n".join(parts)

def esc(s:str)->str:
    return str(s).replace("\\","\\\\").replace("\n","\\n").replace("|","\\|").replace(";","\\;")
def unesc(s:str)->str:
    return s.replace("\\n","\n").replace("\\|","|").replace("\\;",";").replace("\\\\","\\")
def listenc(xs:list[str])->str: return "["+"||".join(esc(x) for x in xs)+"]"

def validate_sl(text:str)->list[str]:
    errors=[]
    if not text.strip().startswith("<|atlas|>"): errors.append("missing_open")
    if not text.strip().endswith("<|/atlas|>"): errors.append("missing_close")
    for a,b in (("<K>","</K>"),("<CLAIM>","</CLAIM>"),("<FALSIFIER>","</FALSIFIER>"),("<UNCERTAINTY>","</UNCERTAINTY>"),("<DECISION>","</DECISION>")):
        if text.count(a)!=1 or text.count(b)!=1: errors.append(f"bad_pair:{a}")
    m=re.search(r"<DECISION>(.*?)</DECISION>",text,re.S)
    if m and m.group(1).strip() not in {v.value for v in Verdict}: errors.append("bad_verdict")
    m=re.search(r"<CLAIM>TYPE=([^|<]+)",text)
    if m and m.group(1).strip() not in {v.value for v in Claim}: errors.append("bad_claim_type")
    return errors

def schema_json()->str:
    return json.dumps({"version":"ATLAS-SL-0.1","atomic_tokens":TOKENS,"claims":[x.value for x in Claim],"verdicts":[x.value for x in Verdict]},ensure_ascii=False,indent=2)

# --- ATLAS-SL 0.2 strict structural parser ---
def parse_sl(text:str) -> dict:
    """Parse the auditable top-level ATLAS-SL record. Raises ValueError on invalid structure.
    It intentionally returns explicit fields rather than hidden reasoning traces.
    """
    errs=validate_sl(text)
    if errs: raise ValueError('invalid ATLAS-SL: '+','.join(errs))
    def one(tag):
        m=re.search(fr'<{tag}>(.*?)</{tag}>',text,re.S); return m.group(1).strip() if m else None
    claim=one('CLAIM') or ''; cm=re.match(r'TYPE=([^|]+)\|TEXT=(.*)',claim,re.S)
    ev=one('EVIDENCE') or ''; em=re.match(r'FOR=(.*?)\|AGAINST=(.*)',ev,re.S)
    return {'frame':one('K'),'state':one('S'),'claim_type':cm.group(1) if cm else None,'claim':cm.group(2) if cm else None,'evidence_for':em.group(1) if em else None,'evidence_against':em.group(2) if em else None,'falsifier':one('FALSIFIER'),'uncertainty':one('UNCERTAINTY'),'negative_memory':one('MEMORY_NEG'),'decision':one('DECISION')}

def structural_score(text:str)->dict:
    errors=validate_sl(text); parsed=None
    if not errors:
        try: parsed=parse_sl(text)
        except Exception as e: errors.append('parse:'+type(e).__name__)
    required=('frame','claim_type','claim','falsifier','uncertainty','decision')
    completeness=(sum(bool(parsed and parsed.get(k)) for k in required)/len(required)) if parsed else 0.0
    return {'valid':not errors,'errors':errors,'completeness':completeness}
