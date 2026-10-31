"""Reproducible own-model training with grouped validation and resumable state."""
from __future__ import annotations
from pathlib import Path
from contextlib import nullcontext
import argparse
import hashlib
import json
import math
import random
import time
import unicodedata
from .tokenizer import AtlasTokenizer, SPECIAL
from .model import AtlasLMConfig
from atlas_paths import ensure_layout

SEP = '\n\n<|sample_end|>\n\n'


def canonical(text):
    return ' '.join(unicodedata.normalize('NFKC', text).casefold().split())


def load_samples(path):
    raw = Path(path).read_text(encoding='utf-8-sig')
    rows, seen = [], set()
    if Path(path).suffix == '.jsonl':
        for line in raw.splitlines():
            if not line.strip():
                continue
            item = json.loads(line)
            if item.get('reviewed') is not True:
                raise ValueError('JSONL training examples require reviewed=true')
            user, assistant = item['user'].strip(), item['assistant'].strip()
            if not user or not assistant:
                raise ValueError('Empty prompt or target')
            prefix = f'<USER>{user}</USER>\n<ASSISTANT>\n'
            row = {'text': prefix + assistant, 'prefix': prefix, 'group': canonical(user)}
            signature = hashlib.sha256(row['text'].encode()).hexdigest()
            if signature not in seen:
                seen.add(signature)
                rows.append(row)
    else:
        for text in raw.split(SEP):
            text = text.strip()
            if not text:
                continue
            signature = hashlib.sha256(text.encode()).hexdigest()
            if signature in seen:
                continue
            seen.add(signature)
            prefix = ''
            for marker in ('<DECIDE>\n', '<ASSISTANT>\n', '<ATLAS_SL>'):
                if marker in text:
                    prefix = text[:text.index(marker) + len(marker)]
                    break
            if '<USER>' in text and '</USER>' in text:
                group = canonical(text.split('<USER>', 1)[1].split('</USER>', 1)[0])
            else:
                group = canonical(text)
            rows.append({'text': text, 'prefix': prefix, 'group': group})
    if len(rows) < 2:
        raise ValueError('At least two distinct samples are required')
    return rows, hashlib.sha256(Path(path).read_bytes()).hexdigest()


def split_samples(rows, fraction, seed):
    if not 0 < fraction < 1:
        raise ValueError('Validation fraction must be strictly between 0 and 1')
    groups = sorted({row['group'] for row in rows})
    if len(groups) < 2:
        raise ValueError('At least two distinct prompt groups are required')
    random.Random(seed).shuffle(groups)
    count = min(len(groups) - 1, max(1, int(len(groups) * fraction)))
    validation = set(groups[:count])
    train = [r for r in rows if r['group'] not in validation]
    val = [r for r in rows if r['group'] in validation]
    fingerprint = hashlib.sha256(json.dumps({'train': sorted(set(groups) - validation),
                                             'val': sorted(validation)}, ensure_ascii=False).encode()).hexdigest()
    return train, val, fingerprint


def encode_sample(row, tokenizer, seq):
    tokens = tokenizer.encode(row['text'])
    if len(tokens) > seq:
        raise ValueError(f'Sample has {len(tokens)} tokens, exceeds seq={seq}; supervision was not truncated')
    labels = tokens.copy()
    if row['prefix']:
        prefix_length = len(tokenizer.encode(row['prefix'], add_eos=False))
        labels[:prefix_length] = [-100] * prefix_length
    if not any(value != -100 for value in labels[1:]):
        raise ValueError('No supervised target tokens')
    missing = seq - len(tokens)
    return tokens + [tokenizer.pad_id] * missing, labels + [-100] * missing


def batch_encoded(rows, device):
    import torch
    # Remove only the shared unsupervised suffix. Causal attention means it
    # cannot influence earlier targets; shorter samples still retain their masks.
    length = max(max((i + 1 for i, target in enumerate(y) if target != -100), default=0) for _, y in rows)
    if length < 2:
        raise ValueError('Batch has no supervised next-token targets')
    return (torch.tensor([x[:length] for x, _ in rows], dtype=torch.long, device=device),
            torch.tensor([y[:length] for _, y in rows], dtype=torch.long, device=device))


def validation_loss(model, rows, batch_size, device, precision='fp32'):
    import torch
    previous = model.training
    model.eval()
    numerator, denominator = 0.0, 0
    try:
        with torch.inference_mode():
            for i in range(0, len(rows), batch_size):
                x, y = batch_encoded(rows[i:i + batch_size], device)
                count = int((y[:, 1:] != -100).sum())
                with amp_context(device, precision):
                    value = model(x, labels=y)['loss']
                numerator += float(value) * count
                denominator += count
    finally:
        model.train(previous)
    if not denominator:
        raise ValueError('Validation contains no supervised tokens')
    return numerator / denominator


def amp_context(device, precision):
    import torch
    if precision == 'fp32':
        return nullcontext()
    return torch.autocast(device_type=device, dtype={'fp16': torch.float16, 'bf16': torch.bfloat16}[precision])


def config_for(profile, vocab, seq):
    specs = {
        'decision': dict(dim=64, n_layers=2, n_heads=4, n_kv_heads=2, hidden_dim=192),
        'micro': dict(dim=128, n_layers=4, n_heads=4, n_kv_heads=2, hidden_dim=384),
        'small': dict(dim=256, n_layers=6, n_heads=8, n_kv_heads=4, hidden_dim=768),
    }
    return AtlasLMConfig(vocab_size=vocab, max_seq_len=seq, version=f'ATLAS-LM-0.4-{profile}',
                         **specs[profile])


def save_weights(directory, model, tokenizer):
    import torch
    directory.mkdir(parents=True, exist_ok=True)
    temporary = directory / 'model.pt.tmp'
    torch.save(model.state_dict(), temporary)
    temporary.replace(directory / 'model.pt')
    model.config.save(directory / 'config.json')
    (directory / 'tokenizer.json').write_text(json.dumps({
        'type': 'atlas-byte-structural', 'vocab_size': tokenizer.vocab_size,
        'special_tokens': list(SPECIAL)}, ensure_ascii=False, indent=2), encoding='utf-8')


def train(args):
    import torch
    from .model import AtlasLM
    if args.steps < 1 or args.batch < 1 or args.grad_accum < 1 or args.eval_every < 1 or args.lr <= 0:
        raise ValueError('Steps, batch, accumulation, evaluation interval and learning rate must be positive')
    if args.threads < 1:
        raise ValueError('CPU thread count must be positive')
    max_seconds = float(getattr(args, 'max_seconds', 0))
    memory_fraction = float(getattr(args, 'memory_fraction', 1.0))
    if max_seconds < 0 or not 0 < memory_fraction <= 1:
        raise ValueError('Invalid time or GPU memory limit')
    torch.set_num_threads(args.threads)
    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)
    rng = random.Random(args.seed)
    rows, data_hash = load_samples(args.data)
    tr, va, split_hash = split_samples(rows, args.val_frac, args.seed)
    tokenizer = AtlasTokenizer()
    config = config_for(args.profile, tokenizer.vocab_size, args.seq)
    device = ('cuda' if torch.cuda.is_available() else 'cpu') if args.device == 'auto' else args.device
    precision = ('bf16' if torch.cuda.is_bf16_supported() else 'fp16') if args.precision == 'auto' and device == 'cuda' else ('fp32' if args.precision == 'auto' else args.precision)
    if device == 'cuda' and not torch.cuda.is_available():
        raise ValueError('CUDA no está disponible en este entorno; ejecuta gpu-doctor')
    if device == 'cuda' and memory_fraction < 1:
        torch.cuda.set_per_process_memory_fraction(memory_fraction)
    if device == 'cpu' and precision != 'fp32':
        raise ValueError('CPU training uses fp32 in this implementation')
    if args.init_from:
        from .runtime import inspect_checkpoint
        _, config, _, _ = inspect_checkpoint(args.init_from)
        if config.max_seq_len != args.seq:
            raise ValueError('Fine tuning must explicitly use the checkpoint context length')
    decision_rows = [row['prefix'].endswith('<DECIDE>\n') for row in rows]
    if any(decision_rows) and not all(decision_rows):
        raise ValueError('Decision and conversation examples must be trained separately')
    config.task = 'decision' if all(decision_rows) else 'causal_lm'
    train_rows = [encode_sample(row, tokenizer, config.max_seq_len) for row in tr]
    val_rows = [encode_sample(row, tokenizer, config.max_seq_len) for row in va]
    model = AtlasLM(config).to(device)
    if args.init_from:
        model.load_state_dict(torch.load(Path(args.init_from) / 'model.pt', map_location=device, weights_only=True))
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, betas=(.9, .95), weight_decay=.1, fused=device == 'cuda')
    scaler = torch.amp.GradScaler('cuda', enabled=device == 'cuda' and precision == 'fp16')
    output = Path(args.out).expanduser().resolve()
    if args.resume and output != Path(args.resume).expanduser().resolve():
        raise ValueError('Resume must write back to its own checkpoint directory')
    if output.exists() and any((output / name).exists() for name in ('training_state.pt', 'model.pt')) and not args.resume:
        raise ValueError('Output already contains training state; use --resume or another output directory')
    output.mkdir(parents=True, exist_ok=True)
    start, history, best = 0, [], float('inf')
    contract = {'data_sha256': data_hash, 'split_sha256': split_hash, 'seed': args.seed,
                'steps': args.steps, 'seq': config.max_seq_len, 'batch': args.batch,
                'grad_accum': args.grad_accum, 'lr': args.lr, 'precision': precision,
                'config': config.__dict__, 'device': device, 'threads': args.threads,
                'engine_version': '5.11', 'optimizer_fused': device == 'cuda', 'dynamic_right_padding': True,
                'initial_weights_sha256': hashlib.sha256((Path(args.init_from) / 'model.pt').read_bytes()).hexdigest() if args.init_from else None}
    if args.resume:
        state = torch.load(Path(args.resume) / 'training_state.pt', map_location='cpu', weights_only=True)
        if state['contract'] != contract:
            raise ValueError('Resume contract changed: dataset, split, architecture or training settings differ')
        model.load_state_dict(state['model'])
        optimizer.load_state_dict(state['optimizer'])
        scaler.load_state_dict(state['scaler'])
        rng.setstate(state['python_rng'])
        torch.set_rng_state(state['torch_rng'])
        if device == 'cuda':
            torch.cuda.set_rng_state_all(state['cuda_rng'])
        start, history, best = state['step'], state['history'], state['best_val_loss']
    if args.stop_after and not start < args.stop_after <= args.steps:
        raise ValueError('stop-after must follow the resumed step and not exceed steps')
    if device == 'cuda':
        torch.cuda.reset_peak_memory_stats()
        torch.cuda.synchronize()
    started = time.perf_counter()
    stop_file = Path(args.stop_file) if getattr(args, 'stop_file', None) else None
    stop_reason = None
    initial = validation_loss(model, val_rows, args.batch, device, precision)
    model.train()
    last = start
    for step in range(start + 1, args.steps + 1):
        warmup = max(1, int(args.steps * .05))
        scale = step / warmup if step <= warmup else .5 * (1 + math.cos(math.pi * (step - warmup) / max(1, args.steps - warmup)))
        for group in optimizer.param_groups:
            group['lr'] = args.lr * max(.05, scale)
        optimizer.zero_grad(set_to_none=True)
        selected = [[rng.choice(train_rows) for _ in range(args.batch)] for _ in range(args.grad_accum)]
        counts = [sum(sum(value != -100 for value in labels[1:]) for _, labels in batch) for batch in selected]
        total_targets = sum(counts)
        train_loss = 0.0
        for examples, targets in zip(selected, counts):
            x, y = batch_encoded(examples, device)
            with amp_context(device, precision):
                loss = model(x, labels=y)['loss']
                weighted = loss * targets / total_targets
            if not bool(torch.isfinite(loss)):
                raise RuntimeError('Non-finite training loss; checkpoint not promoted')
            scaler.scale(weighted).backward()
            train_loss += float(weighted.detach())
        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0, error_if_nonfinite=True)
        scaler.step(optimizer)
        scaler.update()
        last = step
        requested_stop = stop_file is not None and stop_file.exists()
        time_exhausted = max_seconds > 0 and time.perf_counter() - started >= max_seconds
        if step == 1 or step % args.eval_every == 0 or step == args.steps or step == args.stop_after or requested_stop or time_exhausted:
            vl = validation_loss(model, val_rows, args.batch, device, precision)
            if not math.isfinite(vl):
                raise RuntimeError('Non-finite validation loss')
            entry = {'step': step, 'train_loss': train_loss, 'val_loss': vl}
            history.append(entry)
            if vl < best:
                best = vl
                save_weights(output / 'best', model, tokenizer)
            save_weights(output, model, tokenizer)
            state = {'model': model.state_dict(), 'optimizer': optimizer.state_dict(),
                     'scaler': scaler.state_dict(), 'python_rng': rng.getstate(),
                     'torch_rng': torch.get_rng_state(),
                     'cuda_rng': torch.cuda.get_rng_state_all() if device == 'cuda' else [],
                     'step': step, 'history': history, 'best_val_loss': best, 'contract': contract}
            temporary = output / 'training_state.pt.tmp'
            torch.save(state, temporary)
            temporary.replace(output / 'training_state.pt')
            print(json.dumps(entry), flush=True)
        if requested_stop or time_exhausted:
            stop_reason = 'requested' if requested_stop else 'time_budget'
            break
        if args.stop_after and step >= args.stop_after:
            break
    if device == 'cuda':
        torch.cuda.synchronize()
    report = {**contract, 'completed_steps': last, 'train_samples': len(tr), 'val_samples': len(va),
              'initial_val_loss_this_run': initial, 'best_val_loss': best, 'validation': history,
              'parameters': sum(p.numel() for p in model.parameters()),
              'elapsed_s_this_run': time.perf_counter() - started, 'torch': torch.__version__,
              'peak_cuda_allocated_bytes': torch.cuda.max_memory_allocated() if device == 'cuda' else 0,
              'status': 'UNVALIDATED_CANDIDATE', 'stop_reason': stop_reason,
              'split_policy': 'deduplicate exact samples and group identical normalized user prompts',
              'limitation': 'Validation loss is not a conversational competency or frontier comparison benchmark'}
    (output / 'train_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return report


def parser():
    p = argparse.ArgumentParser(description='Entrena ATLAS-LM propio sin pesos externos')
    p.add_argument('--data', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--profile', choices=['decision', 'micro', 'small'], default='micro')
    p.add_argument('--steps', type=int, default=500)
    p.add_argument('--seq', type=int, default=384)
    p.add_argument('--batch', type=int, default=8)
    p.add_argument('--grad-accum', type=int, default=1)
    p.add_argument('--lr', type=float, default=3e-4)
    p.add_argument('--val-frac', type=float, default=.1)
    p.add_argument('--eval-every', type=int, default=50)
    p.add_argument('--seed', type=int, default=7331)
    p.add_argument('--device', choices=['auto', 'cpu', 'cuda'], default='auto')
    p.add_argument('--precision', choices=['auto', 'fp32', 'fp16', 'bf16'], default='auto')
    p.add_argument('--threads', type=int, default=4)
    p.add_argument('--resume')
    p.add_argument('--init-from')
    p.add_argument('--stop-after', type=int, default=0)
    p.add_argument('--stop-file', help='Checkpoint and stop when this local file exists')
    p.add_argument('--max-seconds', type=float, default=0, help='Per-invocation time budget; 0 disables it')
    p.add_argument('--memory-fraction', type=float, default=1.0)
    return p


if __name__ == '__main__':
    args = parser().parse_args()
    print(json.dumps(train(args), indent=2, ensure_ascii=False))

