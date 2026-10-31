#!/usr/bin/env python3
"""ATLAS-LM trainer v0.2: sample-aware causal LM with held-out validation.

No external model weights. Trains only on complete ATLAS samples, masks padding,
uses deterministic train/validation split, cosine LR, gradient accumulation and
saves reproducibility metadata. A falling training loss alone is never success.
"""
from __future__ import annotations
import argparse,json,math,random,time,hashlib,platform
from pathlib import Path
from .tokenizer import AtlasTokenizer
from .model import AtlasLM,AtlasLMConfig
from .corpus import build
from atlas_paths import ensure_layout, resolve_output_path

SEP='\n\n<|sample_end|>\n\n'

def _samples(text): return [x.strip() for x in text.split(SEP) if x.strip()]

def _batch(rows,tok,seq,device):
    import torch
    enc=[]
    for row in rows:
        ids=tok.encode(row)
        if len(ids)>seq: raise ValueError(f'sample length {len(ids)} exceeds seq={seq}; do not silently truncate supervision')
        if len(ids)<seq: ids += [tok.pad_id]*(seq-len(ids))
        enc.append(ids)
    x=torch.tensor(enc,dtype=torch.long,device=device)
    labels=x.clone(); labels[labels==tok.pad_id]=-100
    return x,labels

def evaluate(model,rows,tok,seq,batch,device):
    import torch
    model.eval(); vals=[]
    with torch.no_grad():
        for i in range(0,len(rows),batch):
            x,y=_batch(rows[i:i+batch],tok,seq,device); vals.append(float(model(x,labels=y)['loss'].cpu()))
    model.train(); return sum(vals)/max(1,len(vals))

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--data',default='training/generated/atlas_sl_bootstrap.txt'); ap.add_argument('--out',default='models/atlas-lm-0.2'); ap.add_argument('--steps',type=int,default=500); ap.add_argument('--seq',type=int,default=1024); ap.add_argument('--batch',type=int,default=4); ap.add_argument('--grad-accum',type=int,default=1); ap.add_argument('--lr',type=float,default=3e-4); ap.add_argument('--val-frac',type=float,default=.1); ap.add_argument('--eval-every',type=int,default=50); ap.add_argument('--seed',type=int,default=7331); ap.add_argument('--tiny',action='store_true'); a=ap.parse_args()
    import torch
    root=Path(__file__).resolve().parent.parent; droot=ensure_layout(); data=resolve_output_path(a.data)
    if not data.exists(): build(data)
    raw=data.read_text(encoding='utf-8'); rows=_samples(raw); rng=random.Random(a.seed); rng.shuffle(rows)
    nv=max(1,int(len(rows)*a.val_frac)); val=rows[:nv]; train=rows[nv:]
    tok=AtlasTokenizer(); cfg=AtlasLMConfig(vocab_size=tok.vocab_size,max_seq_len=a.seq,**({'dim':256,'n_layers':4,'n_heads':4,'n_kv_heads':2,'hidden_dim':768,'version':'ATLAS-LM-0.2-tiny'} if a.tiny else {'version':'ATLAS-LM-0.2'}))
    model=AtlasLM(cfg); dev='cuda' if torch.cuda.is_available() else ('mps' if getattr(torch.backends,'mps',None) and torch.backends.mps.is_available() else 'cpu'); model.to(dev)
    opt=torch.optim.AdamW(model.parameters(),lr=a.lr,betas=(.9,.95),weight_decay=.1); losses=[]; vals=[]; t=time.time(); model.train()
    for step in range(1,a.steps+1):
        opt.zero_grad(set_to_none=True); accum=0.0
        for _ in range(a.grad_accum):
            batch=[rng.choice(train) for _ in range(a.batch)]; x,y=_batch(batch,tok,a.seq,dev); loss=model(x,labels=y)['loss']/a.grad_accum; loss.backward(); accum+=float(loss.detach().cpu())
        torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); opt.step()
        # cosine decay with 5% warmup
        warm=max(1,int(a.steps*.05)); scale=step/warm if step<warm else .5*(1+math.cos(math.pi*(step-warm)/max(1,a.steps-warm)))
        for g in opt.param_groups:g['lr']=a.lr*max(scale,.05)
        losses.append(accum)
        if step==1 or step%a.eval_every==0 or step==a.steps:
            vl=evaluate(model,val,tok,a.seq,a.batch,dev); vals.append({'step':step,'val_loss':vl}); print(json.dumps({'step':step,'train_loss':round(accum,4),'val_loss':round(vl,4),'device':dev}))
    out=resolve_output_path(a.out); out.mkdir(parents=True,exist_ok=True); torch.save(model.state_dict(),out/'model.pt'); cfg.save(out/'config.json')
    fingerprint=hashlib.sha256(raw.encode()).hexdigest(); report={'steps':a.steps,'train_samples':len(train),'val_samples':len(val),'final_train_loss':losses[-1],'min_train_loss':min(losses),'validation':vals,'best_val_loss':min(x['val_loss'] for x in vals),'elapsed_s':time.time()-t,'device':dev,'seed':a.seed,'data_sha256':fingerprint,'python':platform.python_version(),'torch':torch.__version__,'parameters':sum(p.numel() for p in model.parameters())}
    (out/'tokenizer.json').write_text(json.dumps({'type':'atlas-byte-structural','vocab_size':tok.vocab_size,'system_language':'ATLAS-SL-0.2'},indent=2),encoding='utf-8'); (out/'train_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8'); print(out)
if __name__=='__main__':
    from .training_engine import parser, train
    print(json.dumps(train(parser().parse_args()), indent=2, ensure_ascii=False))
