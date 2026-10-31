from pathlib import Path
import pytest
from atlas_lm.hybrid_eval import run
from atlas_lm.web_evidence import make_envelope,to_prompt
from atlas_lm.decision_language import parse_decision,encode_decision

def test_hybrid_semantic_suite_without_lm_is_strong():
    r=run(None); assert r['accuracy'] >= .90

def test_web_envelope_requires_real_http_url():
    e=make_envelope('q',[{'url':'madeup','text':'x'},{'url':'https://python.org','text':'official'}]); assert len(e['records'])==1; assert 'sha256' in e

def test_decision_language_roundtrip():
    x=encode_decision('HECHO','SUPPORTED','NONE','HIGH'); p=parse_decision(x); assert p['valid'] and p['claim']=='HECHO'
