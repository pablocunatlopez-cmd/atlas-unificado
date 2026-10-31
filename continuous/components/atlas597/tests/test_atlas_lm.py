from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT))
from atlas_lm.tokenizer import AtlasTokenizer
from atlas_lm.system_language import *
from atlas_lm.model import AtlasLMConfig

def test_tokenizer_roundtrip_unicode_and_tags():
    t=AtlasTokenizer(); s='<|atlas|>\n<K>O=niño;A=España;PI=π;E=μ</K>\n<|/atlas|>'; assert t.decode(t.encode(s),skip_special=True)==s

def test_system_record_valid():
    r=SystemRecord(KFrame('x','a','p','e'),Claim.HYPOTHESIS,'c',['e1'],['e2'],'f','u',Verdict.TENTATIVE)
    assert validate_sl(r.to_sl())==[]

def test_bad_verdict_detected():
    s=SystemRecord(KFrame('x','a','p','e'),Claim.FACT,'c',[],[],'f','u',Verdict.SUPPORTED).to_sl().replace('SUPPORTED','MAGIC')
    assert 'bad_verdict' in validate_sl(s)

def test_config_vocab_matches_tokenizer():
    t=AtlasTokenizer(); c=AtlasLMConfig(vocab_size=t.vocab_size); assert c.vocab_size==t.vocab_size and c.n_kv_heads<=c.n_heads

def test_parse_and_structural_score():
    from atlas_lm.system_language import parse_sl,structural_score
    r=SystemRecord(KFrame('x','a','p','e'),Claim.HYPOTHESIS,'c',['e1'],['e2'],'f','u',Verdict.TENTATIVE)
    p=parse_sl(r.to_sl()); assert p['decision']=='TENTATIVE' and p['claim_type']=='HIPOTESIS'
    assert structural_score(r.to_sl())['completeness']==1.0

def test_padding_is_maskable():
    from atlas_lm.train import _batch
    import torch
    t=AtlasTokenizer(); x,y=_batch(['hola'],t,32,'cpu'); assert bool((x==t.pad_id).any()) and bool((y==-100).any())

def test_generation_health_metric_detects_repetition():
    from atlas_lm.evaluate import repetition_ratio
    assert repetition_ratio('aaaaaaaaaaaaaaaa') > repetition_ratio('abcdefghijklmnop')

def test_scaling_configs_order_parameters():
    from atlas_lm.scaling import config_for,parameter_count
    t=AtlasTokenizer(); counts=[parameter_count(config_for(s,t.vocab_size,256)) for s in ('micro','small','medium')]
    assert counts[0] < counts[1] < counts[2]
