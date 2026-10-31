from __future__ import annotations
from .runtime import generate
from .decision_language import parse_decision


def decide(model_dir, text, max_new_tokens=96):
    prompt = f'<USER>{text}</USER>\n<DECIDE>\n'
    completion = generate(model_dir, prompt, max_new_tokens=max_new_tokens,
                          temperature=0, completion_only=True)
    return {'raw': completion, 'parsed': parse_decision(completion)}

