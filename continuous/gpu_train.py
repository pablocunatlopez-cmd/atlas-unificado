"""CUDA backend for the exact Atlas Sites character-MLP architecture.

No imported model weights. Checkpoints remain compatible with language-model.mjs.
Mini-batch SGD differs from the original scalar optimizer; metrics state this.
"""
import argparse, copy, json, math, time, unicodedata
from pathlib import Path
import torch
from torch import nn
import torch.nn.functional as F

ALPHABET = '\n abcdefghijklmnopqrstuvwxyzáéíóúüñ0123456789.,;:¿?¡!()-/%+="\''
CONFIG = dict(context=8, embedding=8, hidden=40, vocabulary=len(ALPHABET))
SHAPES = dict(embedding=(62,8), hidden=(64,40), hiddenBias=(40,), output=(40,62), outputBias=(62,))

def encode(text):
    return [ALPHABET.index(c) for c in unicodedata.normalize('NFC',text.lower()) if c in ALPHABET]

def js_random(seed):
    s=seed & 0xffffffff
    while True:
        s=(s+0x6D2B79F5)&0xffffffff
        t=((s^(s>>15))*(s|1))&0xffffffff
        t ^= (t+(((t^(t>>7))*(t|61))&0xffffffff))&0xffffffff
        yield ((t^(t>>14))&0xffffffff)/4294967296

class Atlas(nn.Module):
    def __init__(self, snapshot, device):
        super().__init__()
        if snapshot.get('format')!='atlas-character-mlp-v1' or snapshot.get('config')!=CONFIG or snapshot.get('parameters')!=5638:
            raise ValueError('Checkpoint incompatible')
        self.original=copy.deepcopy(snapshot)
        self.weights=nn.ParameterDict()
        for key,shape in SHAPES.items():
            w=torch.tensor(snapshot['weights'][key],dtype=torch.float32,device=device).reshape(shape)
            if not torch.isfinite(w).all() or (w.abs()>=100).any(): raise ValueError('Pesos no finitos')
            self.weights[key]=nn.Parameter(w)
    def forward(self,x):
        w=self.weights
        embedding=F.embedding(x,w['embedding']).flatten(1)
        return torch.tanh(embedding@w['hidden']+w['hiddenBias'])@w['output']+w['outputBias']
    def snapshot(self,updates):
        result=copy.deepcopy(self.original)
        result['steps']+=updates
        result['weights']={k:v.detach().cpu().flatten().tolist() for k,v in self.weights.items()}
        if any(not math.isfinite(x) or abs(x)>=100 for v in result['weights'].values() for x in v): raise ValueError('Candidato inválido')
        return result

def reserve(documents,device):
    groups=[]
    for d in documents:
        row=encode(d['text']);rng=js_random(1729)
        windows=[]
        for _ in range(100):
            pos=8+int(next(rng)*(len(row)-8)); windows.append(row[pos-8:pos+1])
        groups.append(torch.tensor(windows,device=device,dtype=torch.long))
    return groups

def score(model,groups):
    with torch.no_grad():
        return sum(float(F.cross_entropy(model(g[:,:8]),g[:,8]).item()) for g in groups)/len(groups)

class BestCheckpoint:
    """Keep baseline unless a finite validation improvement is observed."""
    def __init__(self, baseline, snapshot, patience=4):
        self.score=baseline; self.snapshot=copy.deepcopy(snapshot)
        self.step=0; self.stale=0; self.patience=patience
    def consider(self, value, step, make_snapshot):
        if math.isfinite(value) and value < self.score - 1e-5:
            self.snapshot=make_snapshot(); self.score=value; self.step=step; self.stale=0
        else:
            self.stale+=1
        return self.stale >= self.patience

def run(request):
    if not torch.cuda.is_available(): raise RuntimeError('CUDA no disponible: no se permite afirmar que se ha usado GPU')
    device='cuda:0';torch.set_num_threads(2)
    torch.cuda.set_per_process_memory_fraction(.4)
    snapshot=request['snapshot'];documents=request['documents']
    train=[d for d in documents if d['role']=='train']; val=[d for d in documents if d['role']=='validation']
    if not train or not val: raise ValueError('Faltan particiones')
    if any(a['url']==b['url'] or a['hash']==b['hash'] for a in train for b in val): raise ValueError('Contaminación entre particiones')
    # Even coverage of the complete corpus instead of only the newest pages.
    if len(train)>64: train=[train[round(i*(len(train)-1)/63)] for i in range(64)]
    windows=[]
    for d in train:
        tokens=torch.tensor(encode(d['text']),dtype=torch.long,device=device)
        if len(tokens)>9: windows.append(tokens.unfold(0,9,1))
    pool=torch.cat(windows);validation=reserve(val,device)
    updates=min(2000,max(1,int(request.get('gpuUpdates',300))))
    batch=min(1024,max(8,int(request.get('batchSize',256))))
    candidates=[];best=None;started=time.monotonic()
    for index,rate in enumerate([.003,.001,.0003]):
        torch.manual_seed(109+index*997)
        model=Atlas(snapshot,device);before=score(model,validation)
        optimizer=torch.optim.SGD(model.parameters(),lr=rate)
        keeper=BestCheckpoint(before,snapshot)
        checks=[]; attempted=0
        model.train()
        for step in range(updates):
            ix=torch.randint(pool.shape[0],(batch,),device=device)
            data=pool[ix];optimizer.zero_grad(set_to_none=True)
            loss=F.cross_entropy(model(data[:,:8]),data[:,8]);loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(),5.0);optimizer.step()
            attempted=step+1
            if attempted%100==0 or attempted==updates:
                measured=score(model,validation)
                checks.append(dict(step=attempted,loss=measured if math.isfinite(measured) else None))
                if keeper.consider(measured,attempted,lambda:model.snapshot(attempted)): break
        torch.cuda.synchronize();after=keeper.score
        candidate=keeper.snapshot
        metrics=dict(index=index,before=before,after=after,steps=keeper.step,optimizerUpdates=attempted,trainingExamples=attempted*batch,learningRate=rate,accepted=after<before-.001,device='CUDA',validationChecks=checks,earlyStopped=attempted<updates,bestStep=keeper.step)
        candidates.append(metrics)
        if best is None or after<best['metrics']['after']:best=dict(candidate=candidate,metrics=metrics.copy())
    best['metrics'].update(candidateCount=len(candidates),candidates=candidates,attemptedStepsTotal=sum(c['optimizerUpdates'] for c in candidates),trainingExamplesTotal=sum(c['trainingExamples'] for c in candidates),trainingDocuments=len(train),validationDocuments=len(val),gpu=torch.cuda.get_device_name(0),cudaVersion=torch.version.cuda,peakAllocatedBytes=torch.cuda.max_memory_allocated(),elapsedSeconds=time.monotonic()-started,evaluation='Mini-batch CUDA; selección y parada con validación reutilizada. No test ciego. Actualizaciones distintas de los pasos escalares CPU.')
    return best

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--input');ap.add_argument('--output');ap.add_argument('--probe',action='store_true');ap.add_argument('--parity',action='store_true');args=ap.parse_args()
    if args.probe:
        available=torch.cuda.is_available()
        if not available: raise SystemExit('CUDA no disponible')
        a=torch.randn(1024,1024,device='cuda');b=a@a;torch.cuda.synchronize()
        print(json.dumps(dict(available=True,device=torch.cuda.get_device_name(0),torch=torch.__version__,cuda=torch.version.cuda,tensorDevice=str(b.device),finite=bool(torch.isfinite(b).all()))))
    else:
        request=json.loads(Path(args.input).read_text(encoding='utf-8'))
        if args.parity:
            model=Atlas(request['snapshot'],'cuda')
            with torch.no_grad(): actual=model(torch.tensor(request['contexts'],dtype=torch.long,device='cuda')).softmax(-1).cpu().tolist()
            delta=max(abs(x-y) for a,b in zip(actual,request['expected']) for x,y in zip(a,b))
            result=dict(maxAbsoluteError=delta,passed=delta<1e-5,device='cuda')
        else: result=run(request)
        Path(args.output).write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
