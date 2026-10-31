from pathlib import Path
from atlas_lm.contrastive_curriculum import build_pairs,write
from eval.frozen_benchmark import seal,verify
from eval.atlas_capability_score import score

def test_contrastive_pairs_flip_decisions():
    ps=build_pairs(100,1); assert len(ps)==100
    assert all(p.a_target != p.b_target for p in ps)
    assert len(set(p.family for p in ps)) >= 4

def test_curriculum_reproducible(tmp_path):
    a=write(tmp_path/'a.txt',50,7); b=write(tmp_path/'b.txt',50,7)
    assert a['sha256']==b['sha256'] and a['rows']==100

def test_frozen_manifest_detects_mutation(tmp_path):
    p=tmp_path/'blind.json'; p.write_text('{"x":1}')
    m=tmp_path/'manifest.json'; seal([p],m,'BLIND'); assert verify(m)['ok']
    p.write_text('{"x":2}'); assert not verify(m)['ok']

def test_score_separates_lm_and_system():
    r=score([{'lm_correct':False,'system_correct':True,'rescued_by_rule':True,'format_valid':True}])
    assert r['lm_decision_accuracy']==0 and r['system_decision_accuracy']==1 and r['rule_rescue_rate']==1
