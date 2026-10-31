"""Measure safe training batches and CPU/CUDA throughput on the actual hardware."""
from pathlib import Path
import argparse, gc, json, time
from .model import AtlasLM
from .tokenizer import AtlasTokenizer
from .training_engine import config_for, amp_context
from atlas_paths import ensure_layout


def training_trial(config, batch, device, precision, repeats=5):
    import torch
    gc.collect()
    if device == 'cuda':
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats()
    torch.manual_seed(511)
    model = AtlasLM(config).to(device).train()
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4, fused=device == 'cuda')
    scaler = torch.amp.GradScaler('cuda', enabled=device == 'cuda' and precision == 'fp16')
    x = torch.randint(0, config.vocab_size, (batch, config.max_seq_len), device=device)
    timings, loss_value = [], None
    for step in range(repeats + 2):
        if device == 'cuda':
            torch.cuda.synchronize()
        start = time.perf_counter()
        optimizer.zero_grad(set_to_none=True)
        with amp_context(device, precision):
            loss = model(x, labels=x)['loss']
        if not bool(torch.isfinite(loss)):
            raise RuntimeError('Non-finite loss during calibration')
        scaler.scale(loss).backward()
        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1., error_if_nonfinite=True)
        scaler.step(optimizer)
        scaler.update()
        if device == 'cuda':
            torch.cuda.synchronize()
        elapsed = time.perf_counter() - start
        if step >= 2:
            timings.append(elapsed)
        loss_value = float(loss.detach())
    import statistics
    seconds = statistics.median(timings)
    result = {'batch':batch,'device':device,'precision':precision, 'loss':loss_value,
              'median_step_seconds':seconds, 'tokens_per_second':batch*(config.max_seq_len-1)/seconds,
              'peak_allocated_bytes':torch.cuda.max_memory_allocated() if device == 'cuda' else 0,
              'peak_reserved_bytes':torch.cuda.max_memory_reserved() if device == 'cuda' else 0}
    del loss, model, optimizer, scaler, x
    gc.collect()
    if device == 'cuda':
        torch.cuda.empty_cache()
    return result


def calibrate(args):
    import torch
    if not torch.cuda.is_available():
        raise ValueError('CUDA no esta disponible; ejecuta gpu-doctor')
    if not 0 < args.memory_fraction < .9 or args.max_batch < 1 or args.repeats < 1:
        raise ValueError('Invalid calibration limits')
    torch.set_num_threads(4)
    precision = 'bf16' if torch.cuda.is_bf16_supported() else 'fp16'
    free, total = torch.cuda.mem_get_info()
    budget = int(free * args.memory_fraction)
    config = config_for(args.profile, AtlasTokenizer().vocab_size, args.seq)
    trials = []
    batch = 1
    while batch <= args.max_batch:
        try:
            result = training_trial(config, batch, 'cuda', precision, args.repeats)
            result['within_budget'] = result['peak_reserved_bytes'] <= budget
            trials.append(result)
            print(json.dumps(result), flush=True)
            if not result['within_budget']:
                break
        except torch.cuda.OutOfMemoryError:
            gc.collect(); torch.cuda.empty_cache()
            trials.append({'batch':batch, 'within_budget':False, 'error':'CUDA_OOM'})
            break
        batch *= 2
    valid = [x for x in trials if x['within_budget']]
    if not valid:
        raise RuntimeError('No batch passed the memory budget')
    # Recommend a measured throughput winner within the budget, not an estimate
    # derived solely from the GPU marketing name.
    chosen = max(valid, key=lambda x:x['tokens_per_second'])
    comparison_batch = min(8, chosen['batch'])
    cpu = training_trial(config, comparison_batch, 'cpu', 'fp32', args.repeats)
    cuda = training_trial(config, comparison_batch, 'cuda', precision, args.repeats)
    report = {'schema':1, 'torch':str(torch.__version__), 'gpu':torch.cuda.get_device_name(),
              'compute_capability':list(torch.cuda.get_device_capability()),
              'free_bytes_before':free, 'total_bytes':total, 'memory_budget_bytes':budget,
              'profile':args.profile,'seq':args.seq,'precision':precision,
              'recommended_batch':chosen['batch'],'trials':trials,
              'comparison':{'cpu_fp32':cpu,'cuda_mixed_precision':cuda,
                            'training_speedup':cpu['median_step_seconds']/cuda['median_step_seconds']},
              'scope':'Random synthetic tokens; model training throughput and memory only, not accuracy. CPU fp32 versus CUDA mixed precision.'}
    output = Path(args.output) if args.output else ensure_layout()['eval']/'gpu_calibration.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'report':str(output),'recommended_batch':chosen['batch'],
                      'training_speedup':report['comparison']['training_speedup']},indent=2))
    return report


def parser():
    p = argparse.ArgumentParser(description='Calibracion medida de ATLAS-LM en CUDA')
    p.add_argument('--profile',choices=['decision','micro','small'],default='small')
    p.add_argument('--seq',type=int,default=384)
    p.add_argument('--max-batch',type=int,default=128)
    p.add_argument('--memory-fraction',type=float,default=.65)
    p.add_argument('--repeats',type=int,default=5)
    p.add_argument('--output')
    return p

if __name__ == '__main__':
    calibrate(parser().parse_args())
