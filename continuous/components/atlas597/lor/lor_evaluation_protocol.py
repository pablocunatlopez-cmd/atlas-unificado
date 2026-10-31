#!/usr/bin/env python3
from __future__ import annotations
from dataclasses import dataclass,field
from typing import Any,Literal
import numpy as np
try:
    from discrete_holonomy import batch_features as true_holonomy_features
except ImportError:
    from lor.discrete_holonomy import batch_features as true_holonomy_features
Verdict=Literal['SUPPORTED','TENTATIVE','REDUNDANT','NULL_LIKE','HIDDEN_OR_SHARED_DRIVER','INSUFFICIENT_EVIDENCE','REFUTED','ABSTAIN']
@dataclass
class SyntheticConfig:
    n_per_class:int=120; length:int=256; noise_std:float=.15; seed:int=42

def _ar(rng,phi,n,noise):
    x=np.zeros(n)
    for t in range(1,n): x[t]=phi*x[t-1]+rng.normal(0,noise)
    return x

def generate_controlled_series(cfg:SyntheticConfig|None=None):
    cfg=cfg or SyntheticConfig(); rng=np.random.default_rng(cfg.seed); series=[]; labels=[]
    for _ in range(cfg.n_per_class):
        phi=rng.uniform(.3,.7); series.append(_ar(rng,phi,cfg.length,cfg.noise_std)); labels.append(0)
    for _ in range(cfg.n_per_class):
        h=cfg.length//2; p1,p2=rng.uniform(.2,.5),rng.uniform(.6,.9); a=_ar(rng,p1,h,cfg.noise_std); b=_ar(rng,p2,cfg.length-h,cfg.noise_std); b=b+(a[-1]-b[0]); series.append(np.r_[a,b]); labels.append(1)
    for _ in range(cfg.n_per_class):
        # Latent 2D path rotated by a slowly varying frame, then projected to 1D.
        t=np.linspace(0,6*np.pi,cfg.length); latent=np.c_[np.sin(t),np.cos(.7*t)]
        theta=.7*np.sin(t/5)+rng.normal(0,.015,cfg.length).cumsum()
        c,s=np.cos(theta),np.sin(theta); x=c*latent[:,0]-s*latent[:,1]+rng.normal(0,cfg.noise_std,cfg.length)
        series.append(x); labels.append(2)
    return {'series':np.asarray(series,float),'labels':np.asarray(labels,int),'class_names':{0:'standard_AR',1:'intrinsic_change',2:'frame_transport_proxy'},'config':cfg.__dict__}

def simple_baseline_features(X):
    out=[]
    for s in X:
        ac=np.corrcoef(s[:-1],s[1:])[0,1] if len(s)>2 else 0.; d=np.diff(s)
        out.append([np.mean(s),np.std(s),ac if np.isfinite(ac) else 0.,np.ptp(s),np.mean(d*d),np.quantile(s,.1),np.quantile(s,.9)])
    return np.asarray(out,float)

def lor_proxy_features(X):
    # Explicitly a geometric proxy, not physical holonomy.
    out=[]
    for s in X:
        pts=np.c_[s[:-2],s[1:-1],s[2:]]; vel=np.diff(pts,axis=0)
        speed=np.linalg.norm(vel,axis=1)+1e-12
        unit=vel/speed[:,None]
        bend=np.linalg.norm(np.diff(unit,axis=0),axis=1)
        # frame rotation proxy from 2D delay embedding tangent angle, wrapped.
        d2=np.diff(np.c_[s[:-1],s[1:]],axis=0); ang=np.unwrap(np.arctan2(d2[:,1],d2[:,0])); rot=np.diff(ang)
        out.append([np.mean(bend) if bend.size else 0.,np.std(bend) if bend.size else 0.,np.mean(np.abs(rot)) if rot.size else 0.,np.std(rot) if rot.size else 0.,abs(np.sum(rot)) if rot.size else 0.])
    return np.asarray(out,float)
@dataclass
class EvalResult:
    verdict:Verdict; baseline_score:float; lor_score:float; delta:float; negative_control_delta:float; reparam_delta:float; notes:list[str]=field(default_factory=list); details:dict[str,Any]=field(default_factory=dict)

def run_minimal_protocol(seed=42, n_per_class=120, length=256)->EvalResult:
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import accuracy_score
    data=generate_controlled_series(SyntheticConfig(seed=seed,n_per_class=n_per_class,length=length)); X,y=data['series'],data['labels']; rng=np.random.default_rng(seed+999)
    idx=np.arange(len(y)); rng.shuffle(idx); n=len(y); train=idx[:int(.6*n)]; cal=idx[int(.6*n):int(.8*n)]; test=idx[int(.8*n):]
    B=simple_baseline_features(X); G=lor_proxy_features(X); H=true_holonomy_features(X); BG=np.c_[B,G,H]
    def fit_score(F,tr=train,te=test,labels=y):
        m=make_pipeline(StandardScaler(),LogisticRegression(max_iter=2000)); m.fit(F[tr],labels[tr]); return accuracy_score(labels[te],m.predict(F[te]))
    sb,sl=fit_score(B),fit_score(BG); delta=sl-sb
    yperm=y.copy(); rng.shuffle(yperm); neg=fit_score(BG,labels=yperm)-fit_score(B,labels=yperm)
    # Monotone time reparameterization by interpolation. A robust geometry feature should not gain merely from this.
    warp=np.empty_like(X); u=np.linspace(0,1,X.shape[1]); uw=u**1.35
    for i,s in enumerate(X): warp[i]=np.interp(uw,u,s)
    Br=simple_baseline_features(warp); Gr=lor_proxy_features(warp); Hr=true_holonomy_features(warp); reparam=fit_score(np.c_[Br,Gr,Hr])-fit_score(Br)
    notes=['Incluye holonomía discreta de marcos PCA sobre embedding temporal: sigue siendo geometría de datos, NO holonomía física ni nueva física.','Split train/calibration/test congelado; test no usado para ajuste.','Control de etiquetas permutadas y reparametrización incluidos.']
    if sl<sb-.03: verdict='REFUTED'
    elif abs(delta)<.01: verdict='NULL_LIKE'
    elif delta<.03: verdict='REDUNDANT'
    else: verdict='TENTATIVE'
    if neg>.08: verdict='INSUFFICIENT_EVIDENCE'; notes.append('Control negativo inestable: no interpretar la mejora.')
    return EvalResult(verdict,float(sb),float(sl),float(delta),float(neg),float(reparam),notes,{'seed':seed,'n':len(y),'n_per_class':n_per_class,'length':length,'test_n':len(test),'calibration_n':len(cal),'holonomy_features':int(H.shape[1])})
if __name__=='__main__':
    r=run_minimal_protocol(); print(r)
