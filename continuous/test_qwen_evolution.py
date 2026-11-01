import importlib.util
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location("qwen_evolution", Path(__file__).with_name("qwen-evolution.py"))
evolution = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evolution)

class QwenEvolutionContracts(unittest.TestCase):
    def test_lease_rejects_other_owners_roles_and_expiry(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "lease.json"
            for delta in ({"role": "video"}, {"ownerPid": os.getpid() + 1}, {"expiresAt": 0}, {"nonce": "other"}):
                value = {"role": "training", "ownerPid": os.getpid(), "nonce": "test", "expiresAt": time.time() * 1000 + 10000, **delta}
                file.write_text(json.dumps(value), encoding="utf-8")
                with self.assertRaises(RuntimeError):
                    evolution.assert_lease(file, os.getpid(), "test")
            file.write_text(json.dumps({"role": "training", "ownerPid": os.getpid(), "nonce": "test", "expiresAt": time.time() * 1000 + 10000}), encoding="utf-8")
            evolution.assert_lease(file, os.getpid(), "test")
            if os.name == "nt":
                with mock.patch.object(os, "kill", side_effect=AssertionError("A Windows liveness check must not send a console event.")):
                    evolution.assert_lease(file, os.getpid(), "test")

    def test_json_metric_rejects_commentary_types_and_unproved_progress(self):
        self.assertTrue(evolution.parse_exact_json('{"x":1}', {"x": 1}))
        self.assertFalse(evolution.parse_exact_json('```json\n{"x":1}\n```', {"x": 1}))
        self.assertFalse(evolution.parse_exact_json('{"x":true}', {"x": 1}))
        self.assertFalse(evolution.parse_exact_json('{"x":"1"}', {"x": 1}))

    def test_mask_tracks_the_actual_generation_prefix_and_rejects_truncation(self):
        class Tokenizer:
            eos_token = '<stop>'
            def apply_chat_template(self, values, **options):
                self.assert_generation = options["add_generation_prompt"]
                return {"input_ids": [10, 11, 12, 13], "attention_mask": [1, 1, 1, 1]}
            def __call__(self, text, **options):
                self.target = text
                return {"input_ids": [20, 21]}
        tokenizer = Tokenizer()
        result = evolution.encode_training(tokenizer, {"prompt": "x", "answer": {"n": 7}}, 8)
        self.assertTrue(tokenizer.assert_generation)
        self.assertEqual(tokenizer.target, '{"n":7}<stop>')
        self.assertEqual(result["labels"], [-100, -100, -100, -100, 20, 21])
        with self.assertRaises(ValueError):
            evolution.encode_training(tokenizer, {"prompt": "x", "answer": {"n": 7}}, 5)

    def test_regressions_and_missing_native_evaluation_prevent_activation(self):
        baseline = {"holdout": {"correct": 2, "total": 8}, "regression": {"correct": 2, "total": 2}}
        candidate = {"holdout": {"correct": 8, "total": 8}, "regression": {"correct": 1, "total": 2}}
        self.assertFalse(evolution.gate(baseline, candidate)["improvedOnSyntheticHoldout"])
        candidate["regression"]["correct"] = 2
        self.assertTrue(evolution.gate(baseline, candidate)["improvedOnSyntheticHoldout"])
        self.assertFalse(evolution.gate(baseline, candidate)["canActivate"])

if __name__ == '__main__':
    unittest.main()
