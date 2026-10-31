"""Bounded offline experiments for Atlas's own decision model.

No model APIs, network, generated code execution or source rewriting. Development
selection can choose a candidate; a final audit never feeds the training loop.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import uuid


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + f'.{os.getpid()}.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    temporary.replace(path)


def pid_alive(pid):
    if type(pid) is not int or pid <= 0:
        return False
    if os.name == 'nt':
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
        kernel.GetExitCodeProcess.restype = wintypes.BOOL
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        kernel.CloseHandle.restype = wintypes.BOOL
        handle = kernel.OpenProcess(0x1000, False, pid)
        if not handle:
            return ctypes.get_last_error() == 5  # Access denied: fail closed.
        try:
            code = wintypes.DWORD()
            return bool(kernel.GetExitCodeProcess(handle, ctypes.byref(code))) and code.value == 259
        finally:
            kernel.CloseHandle(handle)
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


@contextmanager
def acquire_lock(control):
    control = Path(control)
    control.mkdir(parents=True, exist_ok=True)
    path = control / 'runner.lock'
    token = uuid.uuid4().hex
    for _ in range(2):
        try:
            fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            break
        except FileExistsError:
            try:
                owner = json.loads(path.read_text(encoding='utf-8'))
            except (OSError, ValueError):
                raise RuntimeError('Bloqueo ilegible; comprueba que no hay otro proceso antes de retirarlo')
            if pid_alive(owner.get('pid')):
                raise RuntimeError('Ya hay una mejora local de Atlas en marcha')
            path.unlink(missing_ok=True)
    else:
        raise RuntimeError('No se pudo adquirir el bloqueo de Atlas')
    with os.fdopen(fd, 'w', encoding='utf-8') as stream:
        json.dump({'pid': os.getpid(), 'token': token, 'started_at': now()}, stream)
    try:
        yield
    finally:
        try:
            if json.loads(path.read_text(encoding='utf-8')).get('token') == token:
                path.unlink()
        except (OSError, ValueError):
            pass


def valid_metrics(metrics):
    try:
        return (type(metrics['total']) is int and metrics['total'] > 0 and all(
            type(metrics[k]) in (int, float) and math.isfinite(metrics[k]) and 0 <= metrics[k] <= 1
            for k in ('accuracy', 'format_rate')) and all(
            type(metrics[k]) is int and metrics[k] >= 0
            for k in ('fabricated_source_failures', 'fabricated_execution_failures')))
    except (KeyError, TypeError):
        return False


def should_keep(candidate, baseline, min_gain=0.01):
    if not valid_metrics(candidate) or not valid_metrics(baseline):
        return False
    return (candidate['accuracy'] >= baseline['accuracy'] + min_gain
            and candidate['format_rate'] >= baseline['format_rate']
            and candidate['fabricated_source_failures'] <= baseline['fabricated_source_failures']
            and candidate['fabricated_execution_failures'] <= baseline['fabricated_execution_failures'])


def control_dir(root):
    return Path(root).resolve() / 'runtime_data' / 'autonomy'


def read_status(root):
    control = control_dir(root)
    try:
        result = json.loads((control / 'status.json').read_text(encoding='utf-8'))
    except FileNotFoundError:
        return {'status': 'not_started', 'local_only': True}
    result['process_alive'] = pid_alive(result.get('pid'))
    if result['status'] in {'running', 'preparing', 'auditing'} and not result['process_alive']:
        result['status'] = 'interrupted'
    return result


def request_stop(root):
    control = control_dir(root)
    control.mkdir(parents=True, exist_ok=True)
    (control / 'stop.request').write_text(now(), encoding='utf-8')
    return {'status': 'stop_requested', 'message': 'Se guardará el checkpoint antes de parar.'}


def save_state(control, state):
    state['updated_at'] = now()
    atomic_json(control / 'state.json', state)
    atomic_json(Path(state['run_dir']) / 'state.json', state)
    atomic_json(control / 'status.json', {
        k: state.get(k) for k in ('status', 'pid', 'run_id', 'run_dir', 'cycle', 'phase',
                                'best_score', 'updated_at', 'reason', 'local_only')})


def save_heartbeat(control, state):
    """Refresh only public liveness fields while a child owns the long work."""
    atomic_json(control / 'status.json', {
        **{k: state.get(k) for k in ('status', 'pid', 'run_id', 'run_dir', 'cycle', 'phase',
                                    'best_score', 'reason', 'local_only')},
        'updated_at': now(),
    })


def event(state, kind, **values):
    entry = {'at': now(), 'event': kind, **values}
    with (Path(state['run_dir']) / 'events.jsonl').open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(entry, ensure_ascii=False, allow_nan=False) + '\n')


def verify_curriculum(state):
    for name, expected in state['curriculum']['sha256'].items():
        path = Path(state['curriculum']['paths'][name])
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise RuntimeError(f'El corpus sellado ha cambiado: {name}')


def verify_baseline(state):
    expected = state.get('baseline_model_sha256')
    path = Path(state['baseline_model']) / 'model.pt'
    if not expected or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise RuntimeError('El checkpoint de referencia sellado ha cambiado')


def evaluation_fingerprint(model, cases):
    return {
        'model_sha256': hashlib.sha256((Path(model) / 'model.pt').read_bytes()).hexdigest(),
        'cases_sha256': hashlib.sha256(Path(cases).read_bytes()).hexdigest(),
    }


def run_child(command, log, control, state, deadline, stop_file=None):
    """Monitor one child; request a checkpoint before enforcing the deadline."""
    started_stop = None
    next_heartbeat = 0.0
    with Path(log).open('a', encoding='utf-8') as stream:
        process = subprocess.Popen(command, cwd=state['project_root'], stdout=stream,
                                   stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
        try:
            while process.poll() is None:
                stopping = (control / 'stop.request').exists() or time.monotonic() >= deadline
                if stopping:
                    if started_stop is None:
                        started_stop = time.monotonic()
                        if stop_file:
                            Path(stop_file).write_text('checkpoint and stop', encoding='utf-8')
                    if not stop_file or time.monotonic() - started_stop >= 30:
                        process.terminate()
                        try:
                            process.wait(timeout=10)
                        except subprocess.TimeoutExpired:
                            process.kill()
                            process.wait(timeout=10)
                        return 'interrupted'
                if time.monotonic() >= next_heartbeat:
                    save_heartbeat(control, state)
                    next_heartbeat = time.monotonic() + 5
                time.sleep(1)
            return 'completed' if process.returncode == 0 else 'failed'
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=10)


def evaluate_model(model, cases, label, control, state, deadline):
    verify_curriculum(state)
    output = Path(state['run_dir']) / f'{label}.json'
    fingerprint = evaluation_fingerprint(model, cases)
    if output.exists():
        metrics = json.loads(output.read_text(encoding='utf-8'))
        if valid_metrics(metrics) and metrics.get('input_sha256') == fingerprint:
            return metrics
        raise RuntimeError(f'Informe inválido o checkpoint cambiado: {output}')
    command = [sys.executable, '-m', 'atlas_lm.autonomous', 'evaluate', '--model', str(model),
               '--cases', str(cases), '--out', str(output)]
    outcome = run_child(command, output.with_suffix('.log'), control, state, deadline)
    if outcome != 'completed':
        return None
    metrics = json.loads(output.read_text(encoding='utf-8'))
    if not valid_metrics(metrics) or metrics.get('input_sha256') != fingerprint:
        raise RuntimeError('El evaluador no produjo métricas válidas')
    return metrics


def default_baseline(root):
    for path in (root / 'runtime_data/checkpoints/decision_micro_511/best',
                 root / 'models/atlas-lm-0.3-decision-nano-v2'):
        if (path / 'model.pt').is_file():
            return str(path)
    raise RuntimeError('No hay un checkpoint propio de referencia')


def new_state(args, control):
    from .offline_curriculum import prepare_curriculum
    root = Path(args.root).resolve()
    run_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + uuid.uuid4().hex[:6]
    run_dir = control / 'runs' / run_id
    run_dir.mkdir(parents=True)
    seed = args.seed
    curriculum = prepare_curriculum(run_dir / 'corpus', seed=seed)
    baseline = str(Path(args.baseline).resolve()) if args.baseline else default_baseline(root)
    baseline_weights = Path(baseline) / 'model.pt'
    if not baseline_weights.is_file():
        raise RuntimeError(f'Checkpoint propio de referencia incompleto: {baseline}')
    state = {'schema': 1, 'run_id': run_id, 'run_dir': str(run_dir), 'project_root': str(root),
             'local_only': True, 'status': 'preparing', 'phase': 'baseline', 'cycle': 0,
             'seed': seed, 'curriculum': curriculum, 'baseline_model': baseline,
             'baseline_model_sha256': hashlib.sha256(baseline_weights.read_bytes()).hexdigest(),
             'best_model': baseline, 'best_score': None, 'best_metrics': None,
             'history': [], 'pending': None, 'plateau': 0, 'failures': 0,
             'settings': {k: getattr(args, k) for k in ('steps', 'batch', 'profile', 'device', 'max_cycles')},
             'audit_started': False, 'created_at': now()}
    return state


def train_candidate(args, trial, control, state, deadline):
    directory = Path(trial['directory'])
    directory.mkdir(parents=True, exist_ok=True)
    stop_file = directory / 'stop.request'
    stop_file.unlink(missing_ok=True)
    command = [sys.executable, '-m', 'atlas_lm.training_engine', '--data', state['curriculum']['paths']['train'],
               '--out', str(directory), '--profile', args.profile, '--steps', str(args.steps),
               '--seq', '384', '--batch', str(trial['batch']), '--lr', str(trial['lr']),
               '--seed', str(trial['seed']), '--eval-every', '100', '--threads', '2',
               '--device', args.device, '--precision', 'auto', '--memory-fraction', '0.65',
               '--stop-file', str(stop_file)]
    if trial.get('init_from'):
        command += ['--init-from', trial['init_from']]
    if (directory / 'training_state.pt').exists():
        command += ['--resume', str(directory)]
    outcome = run_child(command, directory / 'training.log', control, state, deadline, stop_file)
    report_path = directory / 'train_report.json'
    if outcome == 'completed' and report_path.exists():
        report = json.loads(report_path.read_text(encoding='utf-8'))
        if report['completed_steps'] < args.steps:
            return 'interrupted'
    return outcome


def finish_audit(control, state, deadline):
    if state['best_model'] == state['baseline_model']:
        state['audit'] = {'status': 'NO_IMPROVEMENT', 'activated': False}
        return True
    if state.get('audit_started'):
        # Never automatically reuse a final audit after an interrupted exposure.
        state['audit'] = {'status': 'AUDIT_INTERRUPTED_UNVALIDATED', 'activated': False}
        return True
    if time.monotonic() + 120 > deadline:
        return False
    state['audit_started'] = True
    state['status'] = 'auditing'
    save_state(control, state)
    verify_baseline(state)
    cases = state['curriculum']['paths']['audit']
    baseline = evaluate_model(state['baseline_model'], cases, 'audit_baseline', control, state, deadline)
    if baseline is None or (control / 'stop.request').exists() or time.monotonic() >= deadline:
        state['audit'] = {'status': 'AUDIT_INTERRUPTED_UNVALIDATED', 'activated': False}
        return False
    candidate = evaluate_model(state['best_model'], cases, 'audit_candidate', control, state, deadline)
    if candidate is None or (control / 'stop.request').exists() or time.monotonic() >= deadline:
        state['audit'] = {'status': 'AUDIT_INTERRUPTED_UNVALIDATED', 'activated': False}
        return False
    passed = bool(candidate and baseline and valid_metrics(candidate) and
                  candidate['accuracy'] >= .90 and candidate['format_rate'] >= .99 and
                  candidate['accuracy'] > baseline['accuracy'] and
                  candidate['format_rate'] >= baseline['format_rate'] and
                  candidate['fabricated_source_failures'] == 0 and candidate['fabricated_execution_failures'] == 0)
    state['audit'] = {'status': 'PROMOTABLE_EXPERIMENT' if passed else 'UNVALIDATED_CANDIDATE',
                      'activated': False, 'baseline': baseline, 'candidate': candidate,
                      'scope': 'Synthetic decision task, LM-only. Development selection reused; final audit once.'}
    atomic_json(Path(state['run_dir']) / 'candidate.json', {
        'model': state['best_model'], 'audit': state['audit'], 'local_only': True,
        'corpus_sha256': state['curriculum']['sha256']})
    return True


def write_report(state):
    audit = state.get('audit', {}).get('status', 'PENDING')
    text = (f"# Atlas: mejora local\n\nEstado: {state['status']}\n\n"
            f"Experimentos terminados: {state['cycle']}\n\n"
            f"Mejor exactitud de selección: {state['best_score']}\n\n"
            f"Checkpoint candidato: {state['best_model']}\n\nAuditoría final: {audit}\n\n"
            "Entrenamiento local con etiquetas sintéticas controladas. No usa APIs ni créditos. "
            "Este resultado mide decisiones epistemológicas; no demuestra conversación general ni mejora del código. "
            "Los pesos en uso por la interfaz no se sustituyen automáticamente.\n")
    (Path(state['run_dir']) / 'REPORT.md').write_text(text, encoding='utf-8')


def run_session(args):
    if not math.isfinite(args.hours) or not 0 < args.hours <= 72:
        raise ValueError('hours debe estar entre 0 y 72')
    if not 1 <= args.max_cycles <= 100 or not 1 <= args.steps <= 5000 or not 1 <= args.batch <= 128:
        raise ValueError('Límites inválidos de ciclos, pasos o batch')
    root = Path(args.root).resolve()
    if not (root / 'atlas_lm').is_dir():
        raise ValueError('root debe ser la carpeta del proyecto Atlas')
    control = control_dir(root)
    deadline = time.monotonic() + args.hours * 3600
    with acquire_lock(control):
        state_path = control / 'state.json'
        if state_path.exists() and not args.new_run:
            state = json.loads(state_path.read_text(encoding='utf-8'))
            if state.get('status') == 'completed':
                raise RuntimeError('Sesión terminada; usa --new-run para otro experimento')
            run_path = Path(state['run_dir']).resolve()
            if not run_path.is_relative_to(control / 'runs'):
                raise ValueError('Directorio de sesión inválido')
            for key, value in state['settings'].items():
                setattr(args, key, value)
        else:
            state = new_state(args, control)
        # The canonical coordinator clears stale stop markers before launch.
        # Preserve any new request arriving while this process imports torch or
        # prepares its corpus, so an immediate user stop cannot be lost.
        if os.environ.get('ATLAS_PRESERVE_STOP_REQUEST') != '1':
            (control / 'stop.request').unlink(missing_ok=True)
        state.update(pid=os.getpid(), status='running', reason=None)
        save_state(control, state)
        try:
            verify_curriculum(state)
            verify_baseline(state)
            if state['best_metrics'] is None:
                metrics = evaluate_model(state['baseline_model'], state['curriculum']['paths']['selection'],
                                         'baseline_selection', control, state, deadline)
                if metrics is not None:
                    state.update(best_metrics=metrics, best_score=metrics['accuracy'], phase='training')
                else:
                    state['reason'] = 'Evaluación inicial interrumpida'
            while state['best_metrics'] is not None and state['cycle'] < args.max_cycles and state['plateau'] < 5 and state['failures'] < 3:
                if (control / 'stop.request').exists() or time.monotonic() >= deadline:
                    break
                if shutil.disk_usage(control).free < 1024**3:
                    state['reason'] = 'Queda menos de 1 GB libre'
                    break
                if sum(p.stat().st_size for p in Path(state['run_dir']).rglob('*') if p.is_file()) > 2 * 1024**3:
                    state['reason'] = 'Se alcanzó el límite de 2 GB de la sesión'
                    break
                cycle = state['cycle'] + 1
                if state['pending'] is None:
                    init = None
                    if cycle % 3 != 0:
                        from .runtime import inspect_checkpoint
                        if inspect_checkpoint(state['best_model'])[1].max_seq_len == 384:
                            init = state['best_model']
                    state['pending'] = {'directory': str(Path(state['run_dir']) / f'cycle-{cycle:03d}'),
                                        'seed': state['seed'] + cycle, 'batch': args.batch,
                                        'lr': (1e-4, 3e-4, 6e-4)[(cycle - 1) % 3], 'init_from': init}
                trial = state['pending']
                state['phase'] = f'training_{cycle}'
                save_state(control, state)
                verify_curriculum(state)
                outcome = train_candidate(args, trial, control, state, deadline)
                if outcome == 'interrupted':
                    break
                if outcome == 'failed':
                    state['failures'] += 1
                    state['history'].append({'cycle': cycle, 'status': 'failed', 'trial': trial})
                    event(state, 'training_failed', cycle=cycle, log=str(Path(trial['directory']) / 'training.log'))
                else:
                    state['phase'] = f'selection_{cycle}'
                    metrics = evaluate_model(Path(trial['directory']) / 'best', state['curriculum']['paths']['selection'],
                                             f'selection-{cycle:03d}', control, state, deadline)
                    if metrics is None:
                        break
                    if not valid_metrics(metrics):
                        raise RuntimeError('Métricas de selección inválidas')
                    keep = should_keep(metrics, state['best_metrics'])
                    state['history'].append({'cycle': cycle, 'status': 'kept' if keep else 'rejected',
                                             'metrics': metrics, 'trial': trial})
                    state['failures'] = 0
                    if keep:
                        state.update(best_model=str(Path(trial['directory']) / 'best'), best_metrics=metrics,
                                     best_score=metrics['accuracy'], plateau=0)
                    else:
                        state['plateau'] += 1
                    event(state, 'selection', cycle=cycle, kept=keep, accuracy=metrics['accuracy'])
                state['cycle'], state['pending'] = cycle, None
                save_state(control, state)
            if (control / 'stop.request').exists():
                state.update(status='stopped', reason='Parada solicitada; se puede reanudar')
            elif state['reason']:
                state['status'] = 'stopped'
            elif time.monotonic() >= deadline or state['pending'] is not None:
                state.update(status='budget_exhausted', reason='Presupuesto temporal agotado; se puede reanudar')
            elif state['failures'] >= 3:
                state.update(status='failed', reason='Tres entrenamientos consecutivos fallaron; revisar logs')
            elif state['best_metrics'] is not None:
                state['phase'] = 'final_audit'
                if finish_audit(control, state, deadline):
                    state.update(status='completed', phase='finished', reason='Límite de experimentos o meseta de selección')
                else:
                    if (control / 'stop.request').exists():
                        state.update(status='stopped', reason='Auditoría interrumpida; la candidatura no está validada')
                    else:
                        state.update(status='budget_exhausted', reason='Auditoría interrumpida; la candidatura no está validada')
        except Exception as exc:
            state.update(status='failed', reason=f'{type(exc).__name__}: {exc}')
            event(state, 'error', reason=state['reason'])
            raise
        finally:
            save_state(control, state)
            write_report(state)
        return read_status(root)


def parser():
    p = argparse.ArgumentParser(description='Atlas: experimentos locales sin APIs ni créditos')
    sub = p.add_subparsers(dest='command', required=True)
    run = sub.add_parser('run')
    run.add_argument('--root', default=str(Path(__file__).resolve().parents[1]))
    run.add_argument('--hours', type=float, default=4)
    run.add_argument('--max-cycles', type=int, default=12)
    run.add_argument('--steps', type=int, default=800)
    run.add_argument('--batch', type=int, default=32)
    run.add_argument('--profile', choices=['decision', 'micro'], default='micro')
    run.add_argument('--device', choices=['auto', 'cpu', 'cuda'], default='auto')
    run.add_argument('--seed', type=int, default=98117)
    run.add_argument('--baseline')
    run.add_argument('--new-run', action='store_true')
    for name in ('status', 'stop'):
        sub.add_parser(name).add_argument('--root', default=str(Path(__file__).resolve().parents[1]))
    worker = sub.add_parser('evaluate')
    worker.add_argument('--model', required=True)
    worker.add_argument('--cases', required=True)
    worker.add_argument('--out', required=True)
    return p


def main():
    args = parser().parse_args()
    if args.command == 'evaluate':
        from .offline_curriculum import evaluate_checkpoint
        fingerprint = evaluation_fingerprint(args.model, args.cases)
        result = evaluate_checkpoint(args.model, args.cases, device='cpu', threads=2)
        if evaluation_fingerprint(args.model, args.cases) != fingerprint:
            raise RuntimeError('Checkpoint o casos cambiaron durante la evaluación')
        result['input_sha256'] = fingerprint
        atomic_json(args.out, result)
    elif args.command == 'run':
        result = run_session(args)
    elif args.command == 'stop':
        result = request_stop(args.root)
    else:
        result = read_status(args.root)
    print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == '__main__':
    main()
