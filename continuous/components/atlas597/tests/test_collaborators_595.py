from __future__ import annotations
import json
from unittest.mock import patch


def test_openai_unavailable_without_key(monkeypatch):
    monkeypatch.delenv('OPENAI_API_KEY',raising=False)
    from atlas_lm.openai_collab import openai_available
    x=openai_available(); assert x['available'] is False; assert 'API_KEY' in x['reason']


def test_openai_extract_text():
    from atlas_lm.openai_collab import _extract_text
    data={'output':[{'content':[{'type':'output_text','text':'hola Atlas'}]}]}
    assert _extract_text(data)=='hola Atlas'


def test_openai_request_never_logs_key(monkeypatch,tmp_path):
    monkeypatch.setenv('OPENAI_API_KEY','super-secret-test-key')
    import atlas_lm.openai_collab as oc
    monkeypatch.setattr(oc,'LOG_DIR',tmp_path)
    rec={'mode':'ATLAS_OPENAI_LIVE','answer':'ok','openai':{'model':'gpt-test'}}
    oc._log(rec)
    text=next(tmp_path.glob('*.json')).read_text(encoding='utf-8')
    assert 'super-secret-test-key' not in text


def test_council_prefers_pass_over_warn(monkeypatch,tmp_path):
    import atlas_lm.council as c
    monkeypatch.setattr(c,'LOG_DIR',tmp_path)
    monkeypatch.setattr(c,'council_available',lambda:{'codex':{'available':True},'openai':{'available':True}})
    monkeypatch.setattr(c,'plan',lambda q:{'question':q})
    monkeypatch.setattr(c,'codex_ask',lambda q,h:{'answer':'codex warning','review':{'status':'WARN','findings':[{'level':'WARN'}]},'codex':{}})
    monkeypatch.setattr(c,'openai_ask',lambda q,h:{'answer':'openai pass','review':{'status':'PASS','findings':[]},'openai':{}})
    monkeypatch.setattr(c,'review',lambda q,a:{'status':'PASS','findings':[]})
    r=c.ask('x',[]); assert r['chosen_source']=='openai'; assert r['answer']=='openai pass'


def test_council_errors_when_none(monkeypatch):
    import atlas_lm.council as c
    monkeypatch.setattr(c,'council_available',lambda:{'codex':{'available':False},'openai':{'available':False}})
    monkeypatch.setattr(c,'plan',lambda q:{})
    try: c.ask('x',[])
    except RuntimeError as e: assert 'sin colaboradores' in str(e)
    else: raise AssertionError('expected RuntimeError')


def test_ui_has_four_modes():
    import atlas_ui
    for v in ('own','codex','openai','council'):
        assert f'value="{v}"' in atlas_ui.HTML


def test_council_cannot_launder_blocked_answers(monkeypatch, tmp_path):
    import pytest
    import atlas_lm.council as c
    monkeypatch.setattr(c, 'LOG_DIR', tmp_path)
    monkeypatch.setattr(c, 'council_available', lambda: {'codex': {'available': True}, 'openai': {'available': False}})
    monkeypatch.setattr(c, 'plan', lambda q: {})
    monkeypatch.setattr(c, 'codex_ask', lambda q,h: {'answer': 'blocked content', 'review': {'status':'BLOCK'}})
    monkeypatch.setattr(c, 'review', lambda q,a: {'status':'PASS'})
    with pytest.raises(RuntimeError, match='bloqueados'):
        c.ask('question')
    monkeypatch.setattr(c, 'codex_ask', lambda q,h: {'answer': 'candidate', 'review': {'status':'PASS'}})
    monkeypatch.setattr(c, 'review', lambda q,a: {'status':'BLOCK'})
    with pytest.raises(RuntimeError, match='final de Atlas'):
        c.ask('question')
