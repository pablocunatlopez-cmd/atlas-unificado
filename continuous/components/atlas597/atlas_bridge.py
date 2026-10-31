"""Fixed, CPU-only interfaces for the canonical Atlas coordinator.

This bridge never starts another UI, executes arbitrary user code, or replaces
Qwen. The imported tiny classifier remains an experimental decision lab.
"""
from __future__ import annotations

import contextlib
import json
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent
DATA = Path(os.environ['ATLAS_SECONDARY_ROOT']).resolve()
BASELINE = ROOT / 'models' / 'atlas-lm-0.3-decision-nano-v2'


def run(action, payload):
    if action not in {'decision', 'game', 'train'}:
        raise ValueError('Action not allowed')
    if action == 'game':
        from atlas_lm.game_generator import AtlasGameGenerator
        game_id = payload['id']
        if not re.fullmatch(r'game-\d{10,16}-[a-f0-9]{8}', game_id):
            raise ValueError('Invalid game ID')
        result = AtlasGameGenerator(DATA / 'games' / game_id).generate_project(payload['prompt'])
        return {**result, 'localOnly': True, 'renderer': 'canvas_2d',
                'limitation': 'Prototipo 2D por plantilla; la dirección de arte no equivale a gráficos implementados.'}

    import torch
    torch.set_num_threads(2)
    if action == 'decision':
        from atlas_lm.cognitive_kernel import arbitrate
        from atlas_lm.runtime import inspect_checkpoint
        _, config, tokenizer, _ = inspect_checkpoint(BASELINE)
        question = payload['question']
        # Keep room for a complete decision with the bundled short context.
        limited = question
        while len(tokenizer.encode(f'<USER>{limited}</USER>\n<DECIDE>\n', add_eos=False)) > config.max_seq_len - 96:
            limited = limited[:-1]
        result = arbitrate(limited, str(BASELINE))
        if limited != question:
            # Only the short neural context is truncated. Explicit symbolic
            # evidence/fabrication checks still inspect the complete question.
            whole = arbitrate(question, None)
            if whole['rules']:
                result.update({key: whole[key] for key in ('decision', 'source', 'rules')})
                parsed = (result.get('lm') or {}).get('parsed', {})
                result['disagreement'] = (any(parsed.get(key) != whole['decision'][key]
                                              for key in ('claim', 'verdict', 'need'))
                                          if parsed.get('valid') else None)
        return {'ok': True, **result, 'questionTruncated': limited != question,
                'model': 'ATLAS-LM decision nano v2', 'device': 'cpu',
                'localOnly': True, 'weightsChanged': False,
                'limitation': 'Decisión experimental; reglas simbólicas y LM se informan por separado. No es conversación general.'}

    from atlas_lm import autonomous as auto
    auto.control_dir = lambda _root: DATA / 'autonomy'
    args = auto.parser().parse_args([
        'run', '--root', str(ROOT), '--device', 'cpu', '--profile', 'micro',
        '--steps', str(payload['steps']), '--batch', str(payload['batch']),
        '--max-cycles', '1', '--hours', '0.1', '--baseline', str(BASELINE), '--new-run',
    ])
    return auto.run_session(args)


if __name__ == '__main__':
    try:
        payload = json.loads(sys.stdin.read(20000))
        # Imported modules may print progress. JSON stdout is reserved for the
        # coordinator; progress is captured in bounded stderr and run logs.
        with contextlib.redirect_stdout(sys.stderr):
            result = run(sys.argv[1], payload)
        print(json.dumps(result, ensure_ascii=False, allow_nan=False))
    except Exception as error:
        print(json.dumps({'ok': False, 'error': f'{type(error).__name__}: {error}'}, ensure_ascii=False))
        sys.exit(1)
