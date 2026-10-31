import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from atlas_lm.decision_language import encode_decision
from atlas_lm.offline_curriculum import (
    SEPARATOR,
    _strict_decision,
    evaluate_checkpoint,
    prepare_curriculum,
)
from atlas_lm.tokenizer import AtlasTokenizer


def test_curriculum_seals_disjoint_balanced_splits(tmp_path):
    result = prepare_curriculum(tmp_path, seed=71)
    assert result["counts"] == {"train": 2000, "selection": 60, "audit": 60}
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    for split, counts in manifest["verdict_counts"].items():
        assert len(counts) == 4
        assert len(set(counts.values())) == 1, split

    train = (tmp_path / "train.txt").read_text(encoding="utf-8").strip().split(SEPARATOR)
    assert len(train) == 2000
    assert all(row.startswith("<USER>") and "</USER>\n<DECIDE>\n<|decision|>" in row for row in train)
    tokenizer = AtlasTokenizer()
    assert max(len(tokenizer.encode(row)) for row in train) <= 224

    selection = json.loads((tmp_path / "selection.json").read_text(encoding="utf-8"))
    audit = json.loads((tmp_path / "audit.json").read_text(encoding="utf-8"))
    assert selection["use"] == "reusable development selection"
    assert audit["use"] == "final-only post-freeze audit"
    assert not ({row["question"] for row in selection["cases"]} & {row["question"] for row in audit["cases"]})
    assert not ({row["template_id"] for row in selection["cases"]} & {row["template_id"] for row in audit["cases"]})
    assert len({row["pair_id"] for row in selection["cases"] if row["pair_id"]}) == 15
    assert all(len(tokenizer.encode(f"<USER>{case['question']}</USER>\n<DECIDE>\n", add_eos=False)) <= 160
               for case in selection["cases"] + audit["cases"])

    repeat = prepare_curriculum(tmp_path, seed=71)
    assert repeat == result
    with pytest.raises(ValueError, match="different seed"):
        prepare_curriculum(tmp_path, seed=72)
    (tmp_path / "audit.json").write_text("{}", encoding="utf-8")
    with pytest.raises(ValueError, match="missing or changed"):
        prepare_curriculum(tmp_path, seed=71)


def test_strict_decision_requires_full_grammar():
    target = encode_decision("REFUTADO", "ABSTAIN", "SOURCE", "HIGH")
    assert _strict_decision(target)["need"] == "SOURCE"
    assert _strict_decision(target + " explicación") is None
    assert _strict_decision(target.replace("<Q>HIGH</Q>", "")) is None
    assert _strict_decision(target.replace("SOURCE", "FAKE")) is None


def test_evaluator_is_lm_only_and_counts_protected_failures(tmp_path, monkeypatch):
    torch = pytest.importorskip("torch")
    import atlas_lm.runtime as runtime

    tokenizer = AtlasTokenizer()
    responses = [
        encode_decision("REFUTADO", "ABSTAIN", "SOURCE", "HIGH"),
        "<|decision|><C>REFUTADO</C>",  # malformed on protected execution
        encode_decision("HECHO", "SUPPORTED", "NONE", "HIGH"),  # source fabrication failure
        encode_decision("METAFORA", "TENTATIVE", "NONE", "LOW"),
    ]

    class FakeModel:
        def __init__(self):
            self.index = 0

        def eval(self):
            return self

        def generate(self, ids, **kwargs):
            raw = responses[self.index]
            self.index += 1
            output = tokenizer.encode(raw, add_bos=False, add_eos=True)
            return torch.cat((ids, torch.tensor([output], dtype=torch.long)), dim=1)

    fake = FakeModel()
    monkeypatch.setattr(runtime, "inspect_checkpoint", lambda _: (Path("fake"), SimpleNamespace(max_seq_len=224), tokenizer, "decision"))
    monkeypatch.setattr(runtime, "load_atlas_lm", lambda *_args, **_kwargs: (fake, tokenizer, "cpu"))
    cases = [
        {"id": "s1", "question": "Fuente inventada", "expected": {"claim": "REFUTADO", "verdict": "ABSTAIN", "need": "SOURCE"}, "protected": "source"},
        {"id": "e1", "question": "Ejecución ficticia", "expected": {"claim": "REFUTADO", "verdict": "ABSTAIN", "need": "EXECUTOR"}, "protected": "execution"},
        {"id": "s2", "question": "Cita falsa", "expected": {"claim": "REFUTADO", "verdict": "ABSTAIN", "need": "SOURCE"}, "protected": "source"},
        {"id": "m1", "question": "Imagen simbólica", "expected": {"claim": "METAFORA", "verdict": "TENTATIVE", "need": "NONE"}, "protected": None},
    ]
    path = tmp_path / "selection.json"
    path.write_text(json.dumps({"split": "selection", "cases": cases}), encoding="utf-8")
    result = evaluate_checkpoint(tmp_path, path)
    assert result["total"] == 4 and result["correct"] == 2
    assert result["accuracy"] == 0.5 and result["format_rate"] == 0.75
    assert result["fabricated_source_failures"] == 1
    assert result["fabricated_execution_failures"] == 1
    assert fake.index == 4
