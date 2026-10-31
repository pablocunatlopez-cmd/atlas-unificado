import json
from pathlib import Path
import pytest
torch = pytest.importorskip('torch')
from atlas_lm.model import AtlasLM, AtlasLMConfig
from atlas_lm.tokenizer import AtlasTokenizer
from atlas_lm.runtime import load_atlas_lm, clear_model_cache
from atlas_lm.training_engine import save_weights, validation_loss, encode_sample, parser, train


def tiny(context=48):
    torch.manual_seed(42)
    config = AtlasLMConfig(vocab_size=296, dim=32, n_layers=2, n_heads=4, n_kv_heads=2,
                           hidden_dim=64, max_seq_len=context, version='ATLAS-test')
    return AtlasLM(config).eval()


@pytest.mark.parametrize('prefix,suffix', [(7,1),(7,4),(1,5)])
def test_kv_cache_logits_match_full_prefix(prefix, suffix):
    model = tiny()
    tokens = torch.randint(0, 296, (2, prefix + suffix))
    with torch.inference_mode():
        full = model(tokens)['logits'][:, prefix:]
        state = model(tokens[:, :prefix], use_cache=True)['past_key_values']
        actual = model(tokens[:, prefix:], past_key_values=state, use_cache=True)
    torch.testing.assert_close(actual['logits'], full, atol=2e-6, rtol=2e-5)
    assert actual['past_key_values'][0][0].shape == (2, 2, prefix + suffix, 8)


@pytest.mark.parametrize('prompt_len,new_tokens,context', [(8,12,48),(25,15,32),(45,5,32)])
def test_cached_greedy_generation_matches_reference_even_at_window_boundary(prompt_len,new_tokens,context):
    model = tiny(context)
    tokens = torch.randint(0,296,(1,prompt_len))
    expected = model.generate(tokens.clone(),max_new_tokens=new_tokens,temperature=0,use_cache=False)
    actual = model.generate(tokens.clone(),max_new_tokens=new_tokens,temperature=0,use_cache=True)
    assert torch.equal(actual, expected)


def test_attention_does_not_see_future_tokens():
    model = tiny()
    a = torch.randint(0,296,(1,12))
    b = a.clone(); b[:,6:] = torch.randint(0,296,(1,6))
    torch.testing.assert_close(model(a)['logits'][:,:6], model(b)['logits'][:,:6])


def test_model_reuse_and_checkpoint_invalidation(tmp_path):
    model = tiny()
    save_weights(tmp_path,model,AtlasTokenizer())
    clear_model_cache()
    first = load_atlas_lm(tmp_path, device='cpu')[0]
    assert load_atlas_lm(tmp_path, device='cpu')[0] is first
    with torch.no_grad():
        model.tok.weight.add_(.1)
    save_weights(tmp_path,model,AtlasTokenizer())
    second = load_atlas_lm(tmp_path, device='cpu')[0]
    assert second is not first
    torch.testing.assert_close(second.tok.weight,model.tok.weight)


def test_bundled_checkpoint_remains_loadable():
    root = Path(__file__).resolve().parents[1]
    model, tok, dev = load_atlas_lm(root/'models/atlas-lm-0.3-decision-nano-v2',device='cpu')
    assert sum(p.numel() for p in model.parameters()) == 117568
    assert model.config.vocab_size == tok.vocab_size


def test_mismatched_tokenizer_is_rejected(tmp_path):
    save_weights(tmp_path,tiny(),AtlasTokenizer())
    (tmp_path/'tokenizer.json').write_text(json.dumps({'type':'atlas-byte-structural','vocab_size':1}))
    with pytest.raises(ValueError,match='vocabulario'):
        load_atlas_lm(tmp_path,device='cpu')


def test_validation_loss_is_independent_of_batch_partition():
    model = tiny(32)
    tok = AtlasTokenizer()
    rows = [encode_sample({'text':t,'prefix':'','group':t},tok,32) for t in ['hola','un ejemplo largo','otro']]
    first = validation_loss(model,rows,1,'cpu')
    second = validation_loss(model,rows,3,'cpu')
    assert abs(first-second) < 2e-6


def test_fully_masked_targets_fail_explicitly():
    model = tiny()
    tokens = torch.ones((1,8),dtype=torch.long)
    with pytest.raises(ValueError,match='supervised'):
        model(tokens,labels=torch.full_like(tokens,-100))


def test_resume_matches_uninterrupted_cpu_training(tmp_path):
    torch.set_num_threads(1)
    data = tmp_path/'data.jsonl'
    data.write_text('\n'.join(json.dumps({'user':f'{i}+1','assistant':str(i+1),'reviewed':True}) for i in range(12)))
    common = ['--data',str(data),'--profile','decision','--seq','64','--steps','4','--batch','2',
              '--device','cpu','--precision','fp32','--eval-every','2','--seed','19']
    full, resumed = tmp_path/'full', tmp_path/'resumed'
    train(parser().parse_args(common+['--out',str(full)]))
    train(parser().parse_args(common+['--out',str(resumed),'--stop-after','2']))
    train(parser().parse_args(common+['--out',str(resumed),'--resume',str(resumed)]))
    expected = torch.load(full/'model.pt',weights_only=True)
    actual = torch.load(resumed/'model.pt',weights_only=True)
    for key in expected:
        assert torch.equal(expected[key],actual[key]), key

