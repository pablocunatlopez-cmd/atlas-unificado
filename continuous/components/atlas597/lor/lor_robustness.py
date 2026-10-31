#!/usr/bin/env python3
"""Agregación multisemilla conservadora para LOR. No convierte proxies en física."""
from __future__ import annotations
from dataclasses import asdict
from typing import Any
import numpy as np
from lor_evaluation_protocol import run_minimal_protocol

def run_robustness(seeds=range(10), *, n_per_class=48, length=192)->dict[str,Any]:
    rs=[run_minimal_protocol(int(s),n_per_class=n_per_class,length=length) for s in seeds]
    d=np.array([r.delta for r in rs]); neg=np.array([r.negative_control_delta for r in rs]); rep=np.array([r.reparam_delta for r in rs])
    stable_gain=float(np.mean(d>.03)); harm=float(np.mean(d<0)); neg_bad=float(np.mean(neg>.08))
    if len(rs)<5: verdict='INSUFFICIENT_EVIDENCE'
    elif np.median(d)>.03 and stable_gain>=.8 and neg_bad<=.1 and np.median(rep)>.0: verdict='TENTATIVE'
    elif np.median(d)<=0 or harm>=.5: verdict='REDUNDANT'
    else: verdict='INSUFFICIENT_EVIDENCE'
    return {
      'verdict':verdict,'n_seeds':len(rs),'n_per_class':n_per_class,'length':length,'seeds':[r.details['seed'] for r in rs],
      'delta_mean':float(d.mean()),'delta_median':float(np.median(d)),'delta_std':float(d.std(ddof=1)) if len(d)>1 else 0.,
      'fraction_gain_gt_3pp':stable_gain,'fraction_harm':harm,'fraction_negative_control_bad':neg_bad,
      'negative_control_median':float(np.median(neg)),'reparam_delta_median':float(np.median(rep)),
      'rule':'Nunca SUPPORTED con proxies/sintético; TENTATIVE exige estabilidad multisemilla y controles.',
      'runs':[asdict(r) for r in rs]
    }
