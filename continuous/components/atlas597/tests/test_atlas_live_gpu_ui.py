from pathlib import Path
from unittest.mock import patch

from atlas_lm.gpu import probe_gpu, auto_train_settings, GPUStatus
from atlas_lm import codex_live


def test_gpu_probe_returns_stable_schema():
    g=probe_gpu()
    assert g.device in {'cpu','cuda'}
    assert g.recommended_profile
    s=auto_train_settings(g)
    assert s['device'] in {'cpu','cuda'} and s['batch']>0 and s['steps']>0


def test_3060_12gb_maps_to_medium_profile():
    g=GPUStatus(True,'NVIDIA GeForce RTX 3060',12.0,'x',True,'x',True,'12.8','cuda','medium-12gb',[])
    s=auto_train_settings(g)
    assert s['profile']=='medium-12gb'
    assert s['amp'] is True


def test_codex_available_false_without_cli():
    with patch('atlas_lm.codex_live.shutil.which',return_value=None):
        r=codex_live.codex_available()
    assert not r['available']


def test_codex_live_revises_blocked_answer(tmp_path, monkeypatch):
    calls=[]
    def fake_run(prompt,timeout=900):
        calls.append(prompt)
        if len(calls)==1:
            return 'Hay correlación, por tanto A causa B.', {'returncode':0}
        return 'Hay correlación, pero no prueba causalidad; haría falta una intervención o mejores controles.', {'returncode':0}
    monkeypatch.setattr(codex_live,'_run_codex',fake_run)
    monkeypatch.setattr(codex_live,'LOG_DIR',tmp_path)
    r=codex_live.ask('Analiza la relación entre A y B',max_revisions=2)
    assert r['review']['status']=='PASS'
    assert len(calls)==2
    assert list(tmp_path.glob('*.json'))

def test_correlation_question_gets_causality_guard():
    from atlas_lm.cognitive_kernel import arbitrate
    r=arbitrate('Hay correlación entre A y B; ¿eso demuestra causalidad?',None)
    assert r['decision']['verdict']=='INSUFFICIENT_EVIDENCE'
    assert r['decision']['need']=='TEST'
