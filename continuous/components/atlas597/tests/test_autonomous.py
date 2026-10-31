"""Offline autonomy contracts; model training is mocked except one tiny stop/resume test."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from types import SimpleNamespace
import time

import pytest

from atlas_lm import autonomous as auto


def metrics(accuracy=0.50, format_rate=1.0, sources=0, executions=0):
    return {
        'total': 100, 'accuracy': accuracy, 'format_rate': format_rate,
        'fabricated_source_failures': sources,
        'fabricated_execution_failures': executions,
    }


def test_atomic_json_lock_and_pid_liveness(tmp_path, monkeypatch):
    path = tmp_path / 'status.json'
    auto.atomic_json(path, {'status': 'running', 'word': 'niño'})
    auto.atomic_json(path, {'status': 'stopped'})
    assert json.loads(path.read_text(encoding='utf-8')) == {'status': 'stopped'}
    with pytest.raises(ValueError):
        auto.atomic_json(path, {'invalid': float('nan')})
    assert json.loads(path.read_text(encoding='utf-8')) == {'status': 'stopped'}
    assert auto.pid_alive(os.getpid())
    assert not auto.pid_alive(-1)

    control = tmp_path / 'control'
    with auto.acquire_lock(control):
        owner = json.loads((control / 'runner.lock').read_text(encoding='utf-8'))
        assert owner['pid'] == os.getpid()
        with pytest.raises(RuntimeError, match='en marcha'):
            with auto.acquire_lock(control):
                pass
    assert not (control / 'runner.lock').exists()

    (control / 'runner.lock').write_text(json.dumps({'pid': 12345, 'token': 'stale'}), encoding='utf-8')
    monkeypatch.setattr(auto, 'pid_alive', lambda pid: False)
    with auto.acquire_lock(control):
        assert json.loads((control / 'runner.lock').read_text(encoding='utf-8'))['token'] != 'stale'
    assert not (control / 'runner.lock').exists()


def test_candidate_selection_rejects_regressions_and_invalid_metrics():
    baseline = metrics()
    assert auto.should_keep(metrics(accuracy=0.53), baseline)
    assert not auto.should_keep(metrics(accuracy=0.50), baseline)
    assert not auto.should_keep(metrics(accuracy=0.53, format_rate=0.99), baseline)
    assert not auto.should_keep(metrics(accuracy=0.53, sources=1), baseline)
    assert not auto.should_keep(metrics(accuracy=0.53, executions=1), baseline)
    assert not auto.should_keep(metrics(accuracy=float('nan')), baseline)
    assert not auto.should_keep(metrics(accuracy=float('inf')), baseline)
    assert not auto.should_keep({**metrics(accuracy=0.53), 'total': True}, baseline)


def test_cached_evaluation_is_bound_to_checkpoint_and_case_bytes(tmp_path):
    model = tmp_path / 'candidate'
    model.mkdir()
    (model / 'model.pt').write_bytes(b'candidate-a')
    cases = tmp_path / 'selection.jsonl'
    cases.write_bytes(b'case-a')
    run_dir = tmp_path / 'run'
    run_dir.mkdir()
    state = {
        'run_dir': str(run_dir),
        'curriculum': {
            'paths': {'selection': str(cases)},
            'sha256': {'selection': hashlib.sha256(cases.read_bytes()).hexdigest()},
        },
    }
    report = {**metrics(), 'input_sha256': auto.evaluation_fingerprint(model, cases)}
    auto.atomic_json(run_dir / 'selection-001.json', report)
    assert auto.evaluate_model(model, cases, 'selection-001', tmp_path, state, time.monotonic() + 60) == report

    (model / 'model.pt').write_bytes(b'candidate-edited')
    with pytest.raises(RuntimeError, match='checkpoint cambiado'):
        auto.evaluate_model(model, cases, 'selection-001', tmp_path, state, time.monotonic() + 60)


def fake_project(tmp_path, monkeypatch):
    root = tmp_path / 'atlas'
    (root / 'atlas_lm').mkdir(parents=True)
    baseline = root / 'baseline'
    baseline.mkdir()
    (baseline / 'model.pt').write_bytes(b'own checkpoint')

    def prepare_curriculum(directory, seed):
        directory.mkdir(parents=True)
        paths, digests = {}, {}
        for name in ('train', 'selection', 'audit'):
            path = directory / f'{name}.txt'
            path.write_text(f'{name}-{seed}', encoding='utf-8')
            paths[name] = str(path)
            digests[name] = hashlib.sha256(path.read_bytes()).hexdigest()
        return {'paths': paths, 'sha256': digests}

    from atlas_lm import offline_curriculum, runtime
    monkeypatch.setattr(offline_curriculum, 'prepare_curriculum', prepare_curriculum)
    monkeypatch.setattr(runtime, 'inspect_checkpoint', lambda path: (None, SimpleNamespace(max_seq_len=128), None, None))
    monkeypatch.setattr(auto.shutil, 'disk_usage', lambda path: SimpleNamespace(free=3 * 1024**3))
    args = auto.parser().parse_args([
        'run', '--root', str(root), '--hours', '0.1', '--max-cycles', '2',
        '--steps', '4', '--batch', '2', '--profile', 'decision', '--device', 'cpu',
        '--baseline', str(baseline), '--new-run',
    ])
    return root, baseline, args


def test_session_keeps_only_verified_selection_gain_and_writes_status(tmp_path, monkeypatch):
    root, _, args = fake_project(tmp_path, monkeypatch)
    evaluated = []

    def evaluate(model, cases, label, control, state, deadline):
        evaluated.append(label)
        return {'baseline_selection': metrics(), 'selection-001': metrics(accuracy=0.54),
                'selection-002': metrics(accuracy=0.53)}[label]

    monkeypatch.setattr(auto, 'evaluate_model', evaluate)
    monkeypatch.setattr(auto, 'train_candidate', lambda *parts: 'completed')

    def audit(control, state, deadline):
        state['audit'] = {'status': 'UNVALIDATED_CANDIDATE', 'activated': False}
        return True

    monkeypatch.setattr(auto, 'finish_audit', audit)
    status = auto.run_session(args)
    state = json.loads((auto.control_dir(root) / 'state.json').read_text(encoding='utf-8'))
    assert status['status'] == 'completed'
    assert status['local_only'] is True
    assert state['cycle'] == 2
    assert [row['status'] for row in state['history']] == ['kept', 'rejected']
    assert state['best_score'] == 0.54
    assert state['best_model'].endswith('cycle-001\\best') or state['best_model'].endswith('cycle-001/best')
    assert evaluated == ['baseline_selection', 'selection-001', 'selection-002']
    assert (Path(state['run_dir']) / 'REPORT.md').is_file()
    assert not (root / 'models').exists()  # No automatic activation of candidate weights.


def test_stopped_session_resumes_and_rejects_changed_baseline(tmp_path, monkeypatch):
    root, baseline, args = fake_project(tmp_path, monkeypatch)
    monkeypatch.setattr(auto, 'evaluate_model', lambda *parts: None)
    first = auto.run_session(args)
    assert first['status'] == 'stopped'
    assert first['reason'] == 'Evaluación inicial interrumpida'

    (baseline / 'model.pt').write_bytes(b'external edit')
    args.new_run = False
    with pytest.raises(RuntimeError, match='referencia sellado'):
        auto.run_session(args)
    assert auto.read_status(root)['status'] == 'failed'


def test_stop_during_final_audit_never_marks_candidate_valid(tmp_path, monkeypatch):
    root, baseline, _ = fake_project(tmp_path, monkeypatch)
    control = auto.control_dir(root)
    run_dir = control / 'runs' / 'one'
    run_dir.mkdir(parents=True)
    state = {
        'run_dir': str(run_dir), 'baseline_model': str(baseline), 'best_model': str(root / 'candidate'),
        'baseline_model_sha256': hashlib.sha256((baseline / 'model.pt').read_bytes()).hexdigest(),
        'curriculum': {'paths': {'audit': str(root / 'audit.txt')}},
        'audit_started': False, 'status': 'running',
    }

    def interrupt_audit(model, cases, label, control, state, deadline):
        auto.request_stop(root)
        return metrics()

    monkeypatch.setattr(auto, 'evaluate_model', interrupt_audit)
    assert auto.finish_audit(control, state, time.monotonic() + 300) is False
    assert state['audit']['status'] == 'AUDIT_INTERRUPTED_UNVALIDATED'
    assert state['audit']['activated'] is False
    assert not (run_dir / 'candidate.json').exists()


def test_run_reports_stop_during_audit_without_promotion(tmp_path, monkeypatch):
    root, _, args = fake_project(tmp_path, monkeypatch)
    args.max_cycles = 1
    monkeypatch.setattr(auto, 'evaluate_model', lambda *parts: metrics())
    monkeypatch.setattr(auto, 'train_candidate', lambda *parts: 'completed')

    def interrupted_audit(control, state, deadline):
        auto.request_stop(root)
        state['audit'] = {'status': 'AUDIT_INTERRUPTED_UNVALIDATED', 'activated': False}
        return False

    monkeypatch.setattr(auto, 'finish_audit', interrupted_audit)
    status = auto.run_session(args)
    state = json.loads((auto.control_dir(root) / 'state.json').read_text(encoding='utf-8'))
    assert status['status'] == 'stopped'
    assert state['audit']['status'] == 'AUDIT_INTERRUPTED_UNVALIDATED'
    assert state['audit']['activated'] is False
    assert 'Auditoría interrumpida' in status['reason']


def test_training_stop_file_checkpoints_then_resumes_to_same_weights(tmp_path):
    torch = pytest.importorskip('torch')
    from atlas_lm.training_engine import parser, train

    data = tmp_path / 'data.jsonl'
    data.write_text('\n'.join(json.dumps({'user': f'{i}+1', 'assistant': str(i+1), 'reviewed': True})
                              for i in range(12)), encoding='utf-8')
    out = tmp_path / 'resumed'
    full = tmp_path / 'full'
    stop_file = tmp_path / 'stop.request'
    common = ['--data', str(data), '--profile', 'decision', '--seq', '64', '--steps', '4',
              '--batch', '2', '--device', 'cpu', '--precision', 'fp32', '--eval-every', '2',
              '--threads', '1', '--seed', '19', '--stop-file', str(stop_file)]

    stop_file.write_text('checkpoint and stop', encoding='utf-8')
    stopped = train(parser().parse_args(common + ['--out', str(out)]))
    assert stopped['completed_steps'] == 1
    assert stopped['stop_reason'] == 'requested'
    assert (out / 'training_state.pt').is_file()

    stop_file.unlink()
    resumed = train(parser().parse_args(common + ['--out', str(out), '--resume', str(out)]))
    uninterrupted = train(parser().parse_args(common + ['--out', str(full)]))
    assert resumed['completed_steps'] == uninterrupted['completed_steps'] == 4
    assert resumed['stop_reason'] is None
    expected = torch.load(full / 'model.pt', map_location='cpu', weights_only=True)
    actual = torch.load(out / 'model.pt', map_location='cpu', weights_only=True)
    for key in expected:
        assert torch.equal(actual[key], expected[key]), key
