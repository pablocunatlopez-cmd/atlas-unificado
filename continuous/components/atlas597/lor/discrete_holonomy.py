#!/usr/bin/env python3
"""Discrete, data-geometric holonomy features for ATLAS.

This is *not* spacetime curvature. It estimates transport of local PCA tangent
frames on delay embeddings of scalar time series and measures residual frame
rotation around near-return loops. Designed as a falsifiable feature generator.
"""
from __future__ import annotations
import numpy as np


def delay_embed(s: np.ndarray, dim: int = 3, tau: int = 1) -> np.ndarray:
    s=np.asarray(s,float).ravel(); n=len(s)-(dim-1)*tau
    if n < max(12, dim+3):
        raise ValueError('Serie demasiado corta para el embedding')
    return np.column_stack([s[i*tau:i*tau+n] for i in range(dim)])


def _orthogonal_procrustes(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    # maps coordinates in frame a approximately into frame b
    u,_,vt=np.linalg.svd(a.T @ b, full_matrices=False)
    r=u @ vt
    # keep proper rotations so a reflection is not mislabeled as accumulated angle
    if np.linalg.det(r) < 0:
        u[:,-1] *= -1
        r=u @ vt
    return r


def local_frames(points: np.ndarray, indices: np.ndarray, radius: int = 4, tangent_dim: int = 2) -> list[np.ndarray]:
    n,d=points.shape; frames=[]
    for idx in indices:
        lo=max(0,int(idx)-radius); hi=min(n,int(idx)+radius+1)
        x=points[lo:hi]-points[lo:hi].mean(axis=0,keepdims=True)
        if len(x) < tangent_dim+1:
            raise ValueError('Vecindad insuficiente')
        _,_,vt=np.linalg.svd(x,full_matrices=False)
        f=vt[:tangent_dim].T
        frames.append(f)
    return frames


def transport_product(frames: list[np.ndarray]) -> np.ndarray:
    k=frames[0].shape[1]; h=np.eye(k)
    for a,b in zip(frames[:-1],frames[1:]):
        h=h @ _orthogonal_procrustes(a,b)
    # explicit closure b -> a; near-return in state space is required upstream
    h=h @ _orthogonal_procrustes(frames[-1],frames[0])
    return h


def rotation_angle_2d(r: np.ndarray) -> float:
    return float(np.arctan2(r[1,0]-r[0,1], r[0,0]+r[1,1]))


def _candidate_loops(points: np.ndarray, min_sep: int = 24, max_loops: int = 4) -> list[tuple[int,int,float]]:
    n=len(points); scale=float(np.median(np.linalg.norm(np.diff(points,axis=0),axis=1))+1e-12)
    cand=[]
    # sample anchors to avoid quadratic explosion
    anchors=np.unique(np.linspace(0,max(0,n-min_sep-1),min(18,max(2,n//min_sep)),dtype=int))
    for a in anchors:
        js=np.arange(a+min_sep,n)
        if not len(js): continue
        dist=np.linalg.norm(points[js]-points[a],axis=1)
        k=int(np.argmin(dist)); b=int(js[k]); cand.append((a,b,float(dist[k]/scale)))
    cand.sort(key=lambda z:z[2])
    out=[]
    for item in cand:
        if all(abs(item[0]-a)>5 or abs(item[1]-b)>5 for a,b,_ in out): out.append(item)
        if len(out)>=max_loops: break
    return out


def discrete_holonomy_features(s: np.ndarray, dim: int = 3, tau: int = 1) -> np.ndarray:
    p=delay_embed(s,dim,tau); loops=_candidate_loops(p)
    if not loops: return np.zeros(6,float)
    angles=[]; closure=[]; inverse_err=[]
    for a,b,c in loops:
        idx=np.unique(np.linspace(a,b,min(28,b-a+1),dtype=int))
        fr=local_frames(p,idx)
        h=transport_product(fr); ang=abs(rotation_angle_2d(h)); angles.append(ang); closure.append(c)
        # inverse path should be matrix inverse if transport construction is coherent
        hr=transport_product(list(reversed(fr)))
        inverse_err.append(float(np.linalg.norm(hr-np.linalg.inv(h),ord='fro')))
    A=np.asarray(angles); C=np.asarray(closure); I=np.asarray(inverse_err)
    return np.array([A.mean(),A.max(),A.std(),C.mean(),I.mean(),len(loops)],float)


def batch_features(series: np.ndarray) -> np.ndarray:
    return np.vstack([discrete_holonomy_features(s) for s in np.asarray(series)])
