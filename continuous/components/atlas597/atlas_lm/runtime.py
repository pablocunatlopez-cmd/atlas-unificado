#!/usr/bin/env python3
"""Validated, reusable loading for ATLAS's own checkpoints."""
from __future__ import annotations
from functools import lru_cache
from pathlib import Path
from threading import RLock
import json
import hashlib
import os
from .tokenizer import AtlasTokenizer
from .model import AtlasLMConfig

_LOAD_LOCK = RLock()


def inspect_checkpoint(model_dir):
    path = Path(model_dir).expanduser().resolve()
    for name in ('config.json', 'model.pt', 'tokenizer.json'):
        if not (path / name).is_file():
            raise ValueError(f'Checkpoint incompleto: falta {name}')
    config = AtlasLMConfig(**json.loads((path / 'config.json').read_text(encoding='utf-8-sig')))
    descriptor = json.loads((path / 'tokenizer.json').read_text(encoding='utf-8-sig'))
    tokenizer = AtlasTokenizer()
    if config.vocab_size != tokenizer.vocab_size or descriptor.get('vocab_size') != tokenizer.vocab_size:
        raise ValueError('El vocabulario del checkpoint no coincide con el tokenizer propio')
    if descriptor.get('type') != 'atlas-byte-structural':
        raise ValueError('Tokenizer externo o desconocido: este motor requiere AtlasTokenizer')
    if 'special_tokens' in descriptor and descriptor['special_tokens'] != list(tokenizer.stoi):
        raise ValueError('El orden de tokens estructurales no coincide')
    task = config.task if config.task != 'auto' else ('decision' if 'decision' in config.version.lower() else 'causal_lm')
    return path, config, tokenizer, task


@lru_cache(maxsize=2)
def _load_cached(path, signature, device):
    import torch
    from .model import AtlasLM
    root, config, tokenizer, _ = inspect_checkpoint(path)
    model = AtlasLM(config)
    state = torch.load(root / 'model.pt', map_location='cpu', weights_only=True)
    model.load_state_dict(state, strict=True)
    model.to(device).eval()
    return model, tokenizer, device


def clear_model_cache():
    with _LOAD_LOCK:
        _load_cached.cache_clear()


@lru_cache(maxsize=8)
def _checkpoint_sha(path, mtime_ns, size):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def inference_device(model_dir, requested=None):
    import torch
    choice = str(requested or os.getenv('ATLAS_INFERENCE_DEVICE', 'auto'))
    if choice not in {'auto','cpu','cuda'} and not choice.startswith('cuda:'):
        raise ValueError('ATLAS_INFERENCE_DEVICE must be auto, cpu or cuda')
    if choice != 'auto':
        if choice.startswith('cuda') and not torch.cuda.is_available():
            raise RuntimeError('CUDA requested but unavailable')
        return choice
    fallback = 'cuda' if torch.cuda.is_available() else 'cpu'
    try:
        from atlas_paths import layout
        policy = json.loads((layout()['root']/'inference_policy.json').read_text(encoding='utf-8'))
        path = Path(model_dir).expanduser().resolve()/'model.pt'
        stat = path.stat()
        sha = _checkpoint_sha(str(path), stat.st_mtime_ns, stat.st_size)
        if policy.get('torch') == str(torch.__version__) and policy.get('checkpoint_sha256') == sha and policy.get('device') == 'cpu':
            # The UI and training run in separate processes; this affects only
            # the measured small decoder process, not a running training job.
            torch.set_num_threads(1)
            return 'cpu'
    except (OSError, ValueError, TypeError):
        pass
    return fallback


def load_atlas_lm(model_dir, device=None):
    import torch
    path, _, _, _ = inspect_checkpoint(model_dir)
    dev = inference_device(path, device)
    signature = tuple((name, (path/name).stat().st_mtime_ns, (path/name).stat().st_size)
                      for name in ('config.json', 'model.pt', 'tokenizer.json'))
    with _LOAD_LOCK:
        return _load_cached(str(path), signature, dev)


def generate(model_dir, prompt, max_new_tokens=256, temperature=.3, *,
             completion_only=False, device=None, use_cache=True):
    import torch
    model, tok, dev = load_atlas_lm(model_dir, device=device)
    ids = torch.tensor([tok.encode(prompt, add_eos=False)], device=dev)
    out = model.generate(ids, max_new_tokens=max_new_tokens, temperature=temperature,
                         eos_id=tok.eos_id, use_cache=use_cache)
    tokens = out[0, ids.shape[1]:] if completion_only else out[0]
    return tok.decode(tokens.tolist(), skip_special=True)

