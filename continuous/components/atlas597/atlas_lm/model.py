#!/usr/bin/env python3
"""ATLAS-LM: own decoder with grouped-query attention and request-local KV cache.

State-dict names remain compatible with the bundled 0.1/0.3 checkpoints.
No external model weights or tokenizer are used.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict
import json
import math

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
except (ImportError, OSError):
    torch = nn = F = None


@dataclass
class AtlasLMConfig:
    vocab_size: int = 300
    dim: int = 512
    n_layers: int = 8
    n_heads: int = 8
    n_kv_heads: int = 4
    hidden_dim: int = 1536
    max_seq_len: int = 2048
    rope_theta: float = 10000.0
    dropout: float = 0.0
    tie_embeddings: bool = True
    version: str = 'ATLAS-LM-0.4'
    task: str = 'auto'

    def __post_init__(self):
        if self.task not in {'auto', 'decision', 'causal_lm'}:
            raise ValueError('Unknown model task')
        for name in ('vocab_size', 'dim', 'n_layers', 'n_heads', 'n_kv_heads',
                     'hidden_dim', 'max_seq_len'):
            value = getattr(self, name)
            if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
                raise ValueError(f'{name} must be a positive integer')
        if self.dim % self.n_heads or self.n_heads % self.n_kv_heads:
            raise ValueError('dim/heads and heads/kv_heads must divide exactly')
        if (self.dim // self.n_heads) % 2:
            raise ValueError('RoPE requires an even head dimension')
        if self.max_seq_len < 2 or not 0 <= self.dropout < 1 or self.rope_theta <= 0:
            raise ValueError('Invalid context length, dropout or RoPE theta')

    def save(self, path):
        from pathlib import Path
        Path(path).write_text(json.dumps(asdict(self), indent=2), encoding='utf-8')


if nn is not None:
    class RMSNorm(nn.Module):
        def __init__(self, d, eps=1e-6):
            super().__init__()
            self.weight = nn.Parameter(torch.ones(d))
            self.eps = eps

        def forward(self, x):
            # Accumulate normalization in fp32, then preserve the projection dtype.
            norm = x.float() * torch.rsqrt(x.float().pow(2).mean(-1, keepdim=True) + self.eps)
            return norm.to(x.dtype) * self.weight.to(x.dtype)


    def rope(x, positions, theta):
        half = x.shape[-1] // 2
        freqs = torch.exp(-math.log(theta) *
                          torch.arange(half, device=x.device, dtype=torch.float32) / half)
        angle = positions.float()[:, None] * freqs[None, :]
        cosine = angle.cos()[None, :, None, :].to(x.dtype)
        sine = angle.sin()[None, :, None, :].to(x.dtype)
        a, b = x[..., :half], x[..., half:]
        return torch.cat((a * cosine - b * sine, a * sine + b * cosine), dim=-1)


    class Attention(nn.Module):
        def __init__(self, c):
            super().__init__()
            self.h, self.kv, self.hd = c.n_heads, c.n_kv_heads, c.dim // c.n_heads
            self.theta, self.dropout = c.rope_theta, c.dropout
            self.q = nn.Linear(c.dim, self.h * self.hd, bias=False)
            self.k = nn.Linear(c.dim, self.kv * self.hd, bias=False)
            self.v = nn.Linear(c.dim, self.kv * self.hd, bias=False)
            self.o = nn.Linear(c.dim, c.dim, bias=False)
            # Reuse rotary tables across requests; not checkpoint parameters.
            half = self.hd // 2
            frequencies = torch.exp(-math.log(c.rope_theta) * torch.arange(half, dtype=torch.float32) / half)
            angles = torch.arange(c.max_seq_len, dtype=torch.float32)[:, None] * frequencies[None, :]
            self.register_buffer('rotary_cos', angles.cos(), persistent=False)
            self.register_buffer('rotary_sin', angles.sin(), persistent=False)

        def forward(self, x, past=None, use_cache=False):
            batch, length, _ = x.shape
            offset = 0 if past is None else past[0].size(2)
            query = self.q(x).view(batch, length, self.h, self.hd)
            key = self.k(x).view(batch, length, self.kv, self.hd)
            cosine = self.rotary_cos[offset:offset + length][None, :, None, :].to(query.dtype)
            sine = self.rotary_sin[offset:offset + length][None, :, None, :].to(query.dtype)
            def rotate(value):
                a, b = value[..., :self.hd // 2], value[..., self.hd // 2:]
                return torch.cat((a * cosine - b * sine, a * sine + b * cosine), dim=-1).transpose(1, 2)
            query, key = rotate(query), rotate(key)
            value = self.v(x).view(batch, length, self.kv, self.hd).transpose(1, 2)
            if past is not None:
                key = torch.cat((past[0], key), dim=2)
                value = torch.cat((past[1], value), dim=2)
            present = (key, value) if use_cache else None
            if self.kv != self.h:
                key = key.repeat_interleave(self.h // self.kv, dim=1)
                value = value.repeat_interleave(self.h // self.kv, dim=1)
            # A cached query is aligned to the END of the key sequence. SDPA's
            # is_causal alone would align a short query to its beginning.
            mask = None
            causal = offset == 0
            if offset and length > 1:
                positions = torch.arange(offset, offset + length, device=x.device)
                mask = torch.arange(key.size(2), device=x.device)[None, :] <= positions[:, None]
            result = F.scaled_dot_product_attention(
                query, key, value, attn_mask=mask, is_causal=causal,
                dropout_p=self.dropout if self.training else 0.0)
            result = self.o(result.transpose(1, 2).contiguous().view(batch, length, -1))
            return (result, present) if use_cache else result


    class Block(nn.Module):
        def __init__(self, c):
            super().__init__()
            self.n1, self.n2 = RMSNorm(c.dim), RMSNorm(c.dim)
            self.attn = Attention(c)
            self.g = nn.Linear(c.dim, c.hidden_dim, bias=False)
            self.u = nn.Linear(c.dim, c.hidden_dim, bias=False)
            self.d = nn.Linear(c.hidden_dim, c.dim, bias=False)

        def forward(self, x, past=None, use_cache=False):
            attention = self.attn(self.n1(x), past=past, use_cache=use_cache)
            delta, present = attention if use_cache else (attention, None)
            x = x + delta
            h = self.n2(x)
            x = x + self.d(F.silu(self.g(h)) * self.u(h))
            return (x, present) if use_cache else x


    class AtlasLM(nn.Module):
        def __init__(self, c: AtlasLMConfig):
            super().__init__()
            self.config = c
            self.tok = nn.Embedding(c.vocab_size, c.dim)
            self.blocks = nn.ModuleList([Block(c) for _ in range(c.n_layers)])
            self.norm = RMSNorm(c.dim)
            self.lm_head = nn.Linear(c.dim, c.vocab_size, bias=False)
            self.apply(self._init)
            if c.tie_embeddings:
                self.lm_head.weight = self.tok.weight

        def _init(self, module):
            if isinstance(module, (nn.Linear, nn.Embedding)):
                nn.init.normal_(module.weight, mean=0, std=.02)

        def forward(self, input_ids, labels=None, past_key_values=None, use_cache=False):
            if input_ids.ndim != 2 or input_ids.size(1) == 0:
                raise ValueError('input_ids must be a nonempty [batch, tokens] tensor')
            if past_key_values is not None and len(past_key_values) != len(self.blocks):
                raise ValueError('One KV cache is required per layer')
            offset = past_key_values[0][0].size(2) if past_key_values else 0
            if input_ids.size(1) + offset > self.config.max_seq_len:
                raise ValueError('Context exceeds max_seq_len')
            if labels is not None and (offset or labels.shape != input_ids.shape):
                raise ValueError('Training labels must match a complete uncached sequence')
            x = self.tok(input_ids)
            presents = []
            for i, block in enumerate(self.blocks):
                past = past_key_values[i] if past_key_values else None
                result = block(x, past=past, use_cache=use_cache)
                if use_cache:
                    x, present = result
                    presents.append(present)
                else:
                    x = result
            logits = self.lm_head(self.norm(x))
            loss = None
            if labels is not None:
                if not bool((labels[:, 1:] != -100).any()):
                    raise ValueError('Batch has no supervised next-token targets')
                loss = F.cross_entropy(logits[:, :-1].float().reshape(-1, logits.size(-1)),
                                       labels[:, 1:].reshape(-1), ignore_index=-100)
            result = {'logits': logits, 'loss': loss}
            if use_cache:
                result['past_key_values'] = tuple(presents)
            return result

        @torch.inference_mode()
        def generate(self, ids, max_new_tokens=256, temperature=.6, top_k=40,
                     eos_id=None, use_cache=True, generator=None):
            if max_new_tokens < 0 or temperature < 0 or top_k < 0:
                raise ValueError('Generation limits must be nonnegative')
            if ids.ndim != 2 or ids.size(1) == 0:
                raise ValueError('A nonempty prompt is required')
            if max_new_tokens == 0:
                return ids
            if self.training:
                raise RuntimeError('Call model.eval() before generation')
            finished = torch.zeros(ids.size(0), dtype=torch.bool, device=ids.device)
            output = self(ids[:, -self.config.max_seq_len:], use_cache=use_cache)
            for step in range(max_new_tokens):
                logits = output['logits'][:, -1, :]
                if temperature == 0:
                    nxt = logits.argmax(-1, keepdim=True)
                else:
                    logits = logits / max(temperature, 1e-4)
                    if top_k:
                        values, _ = torch.topk(logits, min(top_k, logits.size(-1)))
                        logits = logits.masked_fill(logits < values[:, -1, None], -float('inf'))
                    nxt = torch.multinomial(torch.softmax(logits, -1), 1, generator=generator)
                if eos_id is not None:
                    nxt = torch.where(finished[:, None], eos_id, nxt)
                    finished |= nxt[:, 0] == eos_id
                ids = torch.cat((ids, nxt), dim=1)
                if step + 1 == max_new_tokens or (eos_id is not None and bool(finished.all())):
                    break
                past = output.get('past_key_values')
                if use_cache and past[0][0].size(2) < self.config.max_seq_len:
                    output = self(nxt, past_key_values=past, use_cache=True)
                else:
                    # Rebase the sliding window to match the original noncached
                    # generation semantics when the trained context is exhausted.
                    output = self(ids[:, -self.config.max_seq_len:], use_cache=use_cache)
            return ids
else:
    class AtlasLM:
        def __init__(self, *args, **kwargs):
            raise RuntimeError('PyTorch no está instalado. El tribunal y la memoria local siguen disponibles.')

