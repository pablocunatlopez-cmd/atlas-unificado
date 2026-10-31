from __future__ import annotations
import argparse,random,json,math,time,hashlib
from pathlib import Path
from .tokenizer import AtlasTokenizer
from .model import AtlasLM,AtlasLMConfig
from .decision_corpus import build
from .contrastive_curriculum import write as build_contrastive
from atlas_paths import ensure_layout, resolve_output_path
SEP='\n\n<|sample_end|>\n\n'; MARK='<DECIDE>\n'

def splitrow(row,tok,seq):
    p=row.index(MARK)+len(MARK); pre=row[:p]; target=row[p:]
    a=tok.encode(pre,add_eos=False); b=tok.encode(target,add_bos=False,add_eos=True)
    if len(a) + len(b) > seq:
        raise ValueError('Decision sample exceeds seq; supervision must not be truncated')
    ids=a+b; labels=[-100]*len(a)+b
    if len(ids)<seq: ids += [tok.pad_id]*(seq-len(ids)); labels += [-100]*(seq-len(labels))
    return ids,labels

def batch(rows,tok,seq,dev):
    import torch
    z=[splitrow(x,tok,seq) for x in rows]
    return torch.tensor([x for x,_ in z],device=dev),torch.tensor([y for _,y in z],device=dev)

def ev(model,rows,tok,seq,bs,dev):
    import torch
    model.eval(); vals=[]
    with torch.no_grad():
      for i in range(0,len(rows),bs):
        x,y=batch(rows[i:i+bs],tok,seq,dev); vals.append(float(model(x,labels=y)['loss']))
    model.train(); return sum(vals)/len(vals)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--out',default='models/atlas-lm-decision-micro'); ap.add_argument('--steps',type=int,default=800); ap.add_argument('--n',type=int,default=6000); ap.add_argument('--seq',type=int,default=224); ap.add_argument('--batch',type=int,default=24); ap.add_argument('--lr',type=float,default=8e-4); ap.add_argument('--seed',type=int,default=98117); ap.add_argument('--contrastive-pairs',type=int,default=3000); a=ap.parse_args()
    import torch
    root=Path(__file__).resolve().parent.parent; droot=ensure_layout(); data=droot['datasets']/'atlas_decisions.txt'; build(data,a.n,a.seed); base=data.read_text(); cpath=droot['datasets']/'atlas_contrastive_train.txt'; build_contrastive(cpath,a.contrastive_pairs,a.seed+17); contrast=cpath.read_text(); raw=base+SEP+contrast; rows=[x for x in raw.split(SEP) if x.strip()]
    rng=random.Random(a.seed); rng.shuffle(rows); cut=int(len(rows)*.9); tr,va=rows[:cut],rows[cut:]
    tok=AtlasTokenizer(); cfg=AtlasLMConfig(vocab_size=tok.vocab_size,dim=64,n_layers=2,n_heads=4,n_kv_heads=2,hidden_dim=192,max_seq_len=a.seq,version='ATLAS-LM-0.3-decision-nano-lab')
    model=AtlasLM(cfg); dev='cuda' if torch.cuda.is_available() else 'cpu'; model.to(dev); opt=torch.optim.AdamW(model.parameters(),lr=a.lr,betas=(.9,.95),weight_decay=.05)
    hist=[]; t=time.time()
    for s in range(1,a.steps+1):
      x,y=batch([rng.choice(tr) for _ in range(a.batch)],tok,a.seq,dev); loss=model(x,labels=y)['loss']; opt.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); opt.step()
      if s in (1,a.steps) or s%100==0:
        vl=ev(model,va[:256],tok,a.seq,a.batch,dev); rec={'step':s,'train':float(loss),'val':vl}; hist.append(rec); print(json.dumps(rec),flush=True)
        if s%100==0 and s<a.steps:
          tmp=resolve_output_path(a.out+'-step'+str(s)); tmp.mkdir(parents=True,exist_ok=True); torch.save(model.state_dict(),tmp/'model.pt'); cfg.save(tmp/'config.json'); (tmp/'tokenizer.json').write_text(json.dumps({'type':'atlas-byte-structural','vocab_size':tok.vocab_size}))
    out=resolve_output_path(a.out); out.mkdir(parents=True,exist_ok=True); torch.save(model.state_dict(),out/'model.pt'); cfg.save(out/'config.json'); (out/'tokenizer.json').write_text(json.dumps({'type':'atlas-byte-structural','vocab_size':tok.vocab_size})); (out/'train_report.json').write_text(json.dumps({'history':hist,'samples':len(rows),'parameters':sum(p.numel() for p in model.parameters()),'elapsed_s':time.time()-t,'sha256':hashlib.sha256(raw.encode()).hexdigest()},indent=2))
if __name__=='__main__': main()
