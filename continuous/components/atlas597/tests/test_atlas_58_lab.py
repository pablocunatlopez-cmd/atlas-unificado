from atlas_lm.evidence_compactor import compact
from atlas_lm.semantic_holdout import run

def test_compactor_is_extractive_and_small():
    rec=[{'url':'https://example.org','text':'Python 3.14.7 is stable. Other unrelated sentence. Release data are official.'}]
    x=compact(rec,'stable Python release',120)
    assert 'Python 3.14.7' in x and '<EVIDENCE_SET>' in x and len(x)<500

def test_semantic_holdout_hybrid():
    r=run(None)
    assert r['accuracy'] >= .9, r
