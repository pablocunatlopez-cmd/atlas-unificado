from pathlib import Path
import sys, tempfile, os
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'core'),str(ROOT/'memory'),str(ROOT/'lor'),str(ROOT/'eval')]
from atlas_provider import ProviderResolver,ProviderConfig,ProviderKind
from atlas_epistemic_v5 import EpistemicLedger,bootstrap_negative_memory
from atlas_runtime_v5 import AtlasV5
from lor_evaluation_protocol import generate_controlled_series,SyntheticConfig,simple_baseline_features,lor_proxy_features
from atlas_eval_v5 import CASES,evaluate_suite

def test_controlled_series_labels_are_aligned_and_balanced():
    d=generate_controlled_series(SyntheticConfig(n_per_class=7,length=64,seed=1))
    assert d['series'].shape==(21,64)
    assert np.array_equal(d['labels'],np.array([0]*7+[1]*7+[2]*7))

def test_lor_features_finite():
    d=generate_controlled_series(SyntheticConfig(n_per_class=3,length=64,seed=2))
    assert np.isfinite(simple_baseline_features(d['series'])).all()
    assert np.isfinite(lor_proxy_features(d['series'])).all()

def test_provider_does_not_claim_ollama_when_dead(monkeypatch):
    monkeypatch.delenv('OLLAMA_HOST',raising=False); monkeypatch.delenv('ATLAS_MODEL_ENDPOINT',raising=False); monkeypatch.delenv('XAI_API_KEY',raising=False); monkeypatch.delenv('ATLAS_API_KEY',raising=False); monkeypatch.delenv('ATLAS_LOCAL_OWN_MODEL',raising=False); monkeypatch.delenv('ATLAS_TRANSFORMERS_MODEL',raising=False)
    cfg=ProviderConfig(preferred_order=[ProviderKind.OLLAMA],ollama_host='http://127.0.0.1:9',timeout_seconds=.05)
    r=ProviderResolver(cfg).detect(); assert not r.has_language_model and r.provider==ProviderKind.NONE

def test_remote_api_does_not_imply_web(monkeypatch):
    monkeypatch.setenv('XAI_API_KEY','x'); monkeypatch.setenv('ATLAS_ALLOW_REMOTE','1')
    cfg=ProviderConfig(preferred_order=[ProviderKind.REMOTE_XAI])
    r=ProviderResolver(cfg).detect(); assert r.has_language_model and not r.has_internet and not r.has_web_ingest

def test_negative_memory_bootstrap_idempotent(tmp_path):
    l=EpistemicLedger(tmp_path/'ledger.json'); bootstrap_negative_memory(l); n=len(l.data['negative_memory']); bootstrap_negative_memory(l); assert len(l.data['negative_memory'])==n and n>=7

def test_runtime_abstains_without_model(tmp_path,monkeypatch):
    monkeypatch.delenv('XAI_API_KEY',raising=False); monkeypatch.delenv('ATLAS_API_KEY',raising=False); monkeypatch.delenv('ATLAS_ALLOW_REMOTE',raising=False); monkeypatch.delenv('ATLAS_LOCAL_OWN_MODEL',raising=False); monkeypatch.delenv('ATLAS_TRANSFORMERS_MODEL',raising=False)
    p=ProviderResolver(ProviderConfig(preferred_order=[ProviderKind.OLLAMA],ollama_host='http://127.0.0.1:9',timeout_seconds=.05))
    a=AtlasV5(tmp_path/'ledger.json',p); x=a.ask('Algo'); assert x['abstained'] and 'Me abstengo' in x['answer']

def test_eval_suite_has_at_least_15_cases(): assert len(CASES)>=15

def test_eval_source_or_abstention_logic():
    answers={c.case_id:'No puedo afirmar esto sin acceso a una fuente verificable. HIPÓTESIS.' for c in CASES}
    # Not all pass; provenance/current-data should accept abstention rather than demand URL.
    r=evaluate_suite(answers)
    m={x['case_id']:x for x in r['results']}
    assert m['source']['source_or_abstention_ok'] and m['current_data']['source_or_abstention_ok']

def test_offline_core_deliberation_works_without_llm(tmp_path,monkeypatch):
    monkeypatch.delenv('XAI_API_KEY',raising=False); monkeypatch.delenv('ATLAS_API_KEY',raising=False)
    p=ProviderResolver(ProviderConfig(preferred_order=[ProviderKind.OLLAMA],ollama_host='http://127.0.0.1:9',timeout_seconds=.05))
    a=AtlasV5(tmp_path/'ledger.json',p)
    r=a.consult_core('¿Qué necesitas que mejore ahora?')
    assert r['mode']=='OFFLINE_CORE_DELIBERATION'
    assert r['findings']
    assert 'LLM' in r['warning']
    assert any(f['kind']=='CAPABILITY_GAP' for f in r['findings'])

def test_offline_core_lor_has_falsifier(tmp_path):
    p=ProviderResolver(ProviderConfig(preferred_order=[]))
    a=AtlasV5(tmp_path/'ledger.json',p)
    r=a.consult_core('¿Qué falta en LOR y holonomía?')
    assert any('holonomía' in f['statement'].lower() or 'lor' in f['statement'].lower() for f in r['findings'])
    assert all(f['falsifier'] for f in r['findings'])

def test_discrete_holonomy_features_finite_and_fixed_length():
    from discrete_holonomy import discrete_holonomy_features
    t=np.linspace(0,8*np.pi,180); s=np.sin(t)+.1*np.cos(2.3*t)
    f=discrete_holonomy_features(s)
    assert f.shape==(6,)
    assert np.isfinite(f).all()
    assert f[-1]>=1

def test_discrete_holonomy_inverse_consistency_small_error():
    from discrete_holonomy import delay_embed,_candidate_loops,local_frames,transport_product
    t=np.linspace(0,8*np.pi,180); p=delay_embed(np.sin(t)+.05*np.cos(3*t))
    a,b,_=_candidate_loops(p,max_loops=1)[0]
    idx=np.unique(np.linspace(a,b,min(28,b-a+1),dtype=int)); fr=local_frames(p,idx)
    h=transport_product(fr); hr=transport_product(list(reversed(fr)))
    assert np.linalg.norm(hr-np.linalg.inv(h)) < 1e-6
