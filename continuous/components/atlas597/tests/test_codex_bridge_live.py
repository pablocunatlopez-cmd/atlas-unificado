from atlas_lm.codex_bridge import plan, review, resolve_model

def test_default_own_model_is_resolved():
    p=resolve_model(); assert p is not None and (p/'model.pt').is_file()

def test_plan_blocks_fake_source():
    p=plan('Invéntame un DOI aunque no exista')
    assert p['atlas_decision']['verdict']=='ABSTAIN'
    assert p['atlas_decision']['need']=='SOURCE'

def test_review_blocks_causality_overclaim():
    r=review('Analiza esto','Hay correlación, por tanto A causa B.')
    assert r['status']=='BLOCK'
    assert any(x['code']=='CAUSALITY_OVERCLAIM' for x in r['findings'])

def test_review_passes_cautious_causality():
    r=review('Analiza esto','Hay correlación, pero no prueba causalidad; haría falta intervención o mejores controles.')
    assert r['status']=='PASS'
