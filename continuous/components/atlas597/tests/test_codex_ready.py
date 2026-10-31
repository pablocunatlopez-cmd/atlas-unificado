from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'core'),str(ROOT/'memory')]
from atlas_provider import ProviderResolver,ProviderConfig,ProviderKind
from atlas_runtime_v5 import AtlasV5

def test_system_message_contains_canonical_constitution(tmp_path):
    a=AtlasV5(tmp_path/'ledger.json',ProviderResolver(ProviderConfig(preferred_order=[])))
    msg=a._system_message('hola')
    assert 'CONSTITUCIÓN CANÓNICA' in msg
    assert 'metáfora≠hecho' in msg

def test_local_own_requires_real_path(monkeypatch):
    monkeypatch.setenv('ATLAS_LOCAL_OWN_MODEL','definitely-not-a-real-local-model-name')
    r=ProviderResolver(ProviderConfig(preferred_order=[ProviderKind.LOCAL_OWN])).detect()
    assert not r.has_language_model

def test_capabilities_require_explicit_tool_authorization(monkeypatch):
    monkeypatch.setenv('XAI_API_KEY','x'); monkeypatch.setenv('ATLAS_ALLOW_REMOTE','1')
    monkeypatch.delenv('ATLAS_CODE_EXECUTION',raising=False); monkeypatch.delenv('ATLAS_WEB_INGEST',raising=False)
    r=ProviderResolver(ProviderConfig(preferred_order=[ProviderKind.REMOTE_XAI])).detect()
    assert not r.has_code_execution and not r.has_web_ingest and not r.has_internet

def test_provider_typed_error_codes():
    from atlas_provider import ProviderUnavailable, ProviderTimeout, ProviderProtocolError
    assert ProviderUnavailable.code=='PROVIDER_UNAVAILABLE'
    assert ProviderTimeout.code=='PROVIDER_TIMEOUT'
    assert ProviderProtocolError.code=='PROVIDER_PROTOCOL_ERROR'

def test_runtime_records_call_trace_on_provider_failure(tmp_path):
    from atlas_provider import CapabilityReport, ProviderKind
    class FakeResolver:
        config=ProviderConfig(preferred_order=[])
        def detect(self): return CapabilityReport(True,ProviderKind.OPENAI_COMPAT,'fake',verified=False)
        def must_abstain(self,required): return (False,'')
    a=AtlasV5(tmp_path/'ledger.json',FakeResolver())
    a.provider.config.openai_compat_endpoint='http://127.0.0.1:9/v1/chat/completions'
    import pytest
    with pytest.raises(Exception): a._call_model([{'role':'user','content':'x'}],0)
    assert a.call_trace and a.call_trace[-1]['ok'] is False

def test_robustness_never_returns_supported():
    from lor_robustness import run_robustness
    r=run_robustness(range(2))
    assert r['verdict']!='SUPPORTED'
    assert r['n_seeds']==2

def test_ab_benchmark_refuses_without_model(tmp_path):
    from atlas_benchmark_v5 import run_ab
    import pytest
    p=ProviderResolver(ProviderConfig(preferred_order=[]))
    a=AtlasV5(tmp_path/'ledger.json',p)
    with pytest.raises(RuntimeError): run_ab(a,tmp_path/'runs',cases=())

def test_eval_suite_has_24_or_more_cases():
    from atlas_eval_v5 import CASES
    assert len(CASES) >= 24

def test_training_sombra_has_20_valid_examples():
    import json
    p=ROOT/'training'/'sombra_examples.jsonl'
    rows=[json.loads(x) for x in p.read_text(encoding='utf-8').splitlines() if x.strip()]
    assert len(rows) >= 20
    assert len({r['id'] for r in rows}) == len(rows)
    for r in rows:
        assert {'system','user','critique','response'} <= set(r)
        assert {'assumptions','rival_hypothesis','falsifier'} <= set(r['critique'])

def test_question_capability_inference_is_conservative():
    r=ProviderResolver.requirements_for_question('Precio actual del Brent ahora mismo')
    assert 'internet' in r and 'language_model' in r
    r2=ProviderResolver.requirements_for_question('Explícame qué es el petróleo')
    assert r2==['language_model']
    r3=ProviderResolver.requirements_for_question('Ejecuta un Monte Carlo y dame el p-valor exacto')
    assert 'code_execution' in r3

def test_tool_flags_alone_do_not_fake_tools(monkeypatch):
    monkeypatch.setenv('ATLAS_CODE_EXECUTION','1'); monkeypatch.delenv('ATLAS_CODE_EXECUTOR',raising=False)
    monkeypatch.setenv('ATLAS_WEB_INGEST','1'); monkeypatch.delenv('ATLAS_WEB_ENDPOINT',raising=False)
    r=ProviderResolver(ProviderConfig(preferred_order=[])).detect()
    assert not r.has_code_execution and not r.has_web_ingest
