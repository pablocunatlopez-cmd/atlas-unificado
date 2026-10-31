"""CPU and CUDA regressions for the 5.11 engine."""
import importlib.util, sys
from pathlib import Path
import pytest
torch = pytest.importorskip('torch')
from atlas_lm.model import AtlasLM, AtlasLMConfig
from atlas_lm.training_engine import batch_encoded, encode_sample, parser, train
from atlas_lm.tokenizer import AtlasTokenizer


def baseline_module():
    path = Path(__file__).resolve().parents[1]/'eval/reference_model_510.py'
    spec = importlib.util.spec_from_file_location('baseline_510_model',path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize('device',['cpu','cuda'])
def test_rotary_table_matches_previous_engine(device):
    if device=='cuda' and not torch.cuda.is_available():
        pytest.skip('CUDA unavailable')
    old = baseline_module()
    c = dict(vocab_size=296,dim=64,n_layers=2,n_heads=4,n_kv_heads=2,hidden_dim=192,max_seq_len=96)
    torch.manual_seed(55)
    previous = old.AtlasLM(old.AtlasLMConfig(**c)).to(device).eval()
    current = AtlasLM(AtlasLMConfig(**c)).to(device).eval()
    current.load_state_dict(previous.state_dict(),strict=True)
    x = torch.randint(0,296,(2,21),device=device)
    with torch.inference_mode():
        torch.testing.assert_close(current(x)['logits'],previous(x)['logits'],atol=3e-6,rtol=3e-5)
        assert torch.equal(current.generate(x,max_new_tokens=16,temperature=0),previous.generate(x,max_new_tokens=16,temperature=0))
    assert not any('rotary_' in key for key in current.state_dict())


def test_trimmed_batch_preserves_loss_and_gradients():
    tok = AtlasTokenizer()
    rows = [encode_sample({'text':text,'prefix':'','group':text},tok,64) for text in ['Hola','Una respuesta algo mas larga']]
    x, labels = batch_encoded(rows,'cpu')
    full_x = torch.tensor([r[0] for r in rows])
    full_y = torch.tensor([r[1] for r in rows])
    assert x.shape[1] < 64
    model = AtlasLM(AtlasLMConfig(vocab_size=296,dim=32,n_layers=2,n_heads=4,n_kv_heads=2,hidden_dim=64,max_seq_len=64))
    expected = model(full_x,labels=full_y)['loss']; expected.backward()
    gradients = {n:p.grad.clone() for n,p in model.named_parameters()}
    model.zero_grad(set_to_none=True)
    actual = model(x,labels=labels)['loss']; actual.backward()
    torch.testing.assert_close(actual,expected)
    for n,p in model.named_parameters():
        torch.testing.assert_close(p.grad,gradients[n],atol=2e-6,rtol=2e-5)


@pytest.mark.skipif(not torch.cuda.is_available(),reason='CUDA unavailable')
@pytest.mark.parametrize('precision',['fp16','bf16'])
def test_cuda_amp_gradients_and_cached_decoding(precision):
    from atlas_lm.training_engine import amp_context
    if precision=='bf16' and not torch.cuda.is_bf16_supported():
        pytest.skip('BF16 unavailable')
    torch.manual_seed(511)
    model = AtlasLM(AtlasLMConfig(vocab_size=296,dim=64,n_layers=2,n_heads=4,n_kv_heads=2,hidden_dim=192,max_seq_len=64)).cuda()
    x = torch.randint(0,296,(4,32),device='cuda')
    with amp_context('cuda',precision):
        loss = model(x,labels=x)['loss']
    loss.backward()
    assert torch.isfinite(loss)
    assert all(torch.isfinite(p.grad).all() for p in model.parameters() if p.grad is not None)
    model.eval()
    with amp_context('cuda',precision):
        a = model.generate(x,max_new_tokens=12,temperature=0,use_cache=False)
        b = model.generate(x,max_new_tokens=12,temperature=0,use_cache=True)
    # Low precision may change very close argmax ties; compare logits separately
    # and require exact tokens for this fixed seeded regression workload.
    assert torch.equal(a,b)


@pytest.mark.skipif(not torch.cuda.is_available(),reason='CUDA unavailable')
def test_cuda_training_resume_has_finite_state(tmp_path):
    import json
    data = tmp_path/'data.jsonl'
    data.write_text('\n'.join(json.dumps({'user':f'{i}+1','assistant':str(i+1),'reviewed':True}) for i in range(12)))
    out = tmp_path/'trained'
    args = ['--data',str(data),'--out',str(out),'--profile','decision','--seq','64','--steps','4',
            '--batch','4','--device','cuda','--precision','fp16','--eval-every','2']
    train(parser().parse_args(args+['--stop-after','2']))
    report = train(parser().parse_args(args+['--resume',str(out)]))
    assert report['completed_steps']==4 and report['peak_cuda_allocated_bytes']>0
    state = torch.load(out/'model.pt',weights_only=True,map_location='cpu')
    assert all(torch.isfinite(t).all() for t in state.values())


def test_inference_policy_requires_matching_checkpoint_and_runtime(monkeypatch, tmp_path):
    import hashlib,json
    from atlas_lm.runtime import inference_device
    monkeypatch.setenv('ATLAS_DATA_ROOT',str(tmp_path))
    monkeypatch.setenv('ATLAS_INFERENCE_DEVICE','auto')
    monkeypatch.setattr(torch.cuda,'is_available',lambda:True)
    model=tmp_path/'weights';model.mkdir()
    (model/'model.pt').write_bytes(b'checkpoint-a')
    policy={'torch':str(torch.__version__),'checkpoint_sha256':hashlib.sha256(b'checkpoint-a').hexdigest(),'device':'cpu'}
    (tmp_path/'inference_policy.json').write_text(json.dumps(policy))
    assert inference_device(model)=='cpu'
    assert inference_device(model,'cuda')=='cuda'
    assert inference_device(model,torch.device('cpu'))=='cpu'
    (model/'model.pt').write_bytes(b'checkpoint-changed')
    assert inference_device(model)=='cuda'


def test_training_records_actual_decision_task(tmp_path):
    from atlas_lm.training_engine import config_for
    from atlas_lm.runtime import inspect_checkpoint
    from atlas_lm.training_engine import save_weights
    config=config_for('micro',296,64)
    config.task='decision'
    save_weights(tmp_path,AtlasLM(config),AtlasTokenizer())
    assert inspect_checkpoint(tmp_path)[3]=='decision'
