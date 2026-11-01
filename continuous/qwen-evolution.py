"""Isolated Qwen LoRA candidate runner; never publishes or edits the live GGUF.

The default preflight is CPU-only. A real training invocation checks the
coordinator's renewable lease before loading CUDA and before every optimizer step.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.metadata
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import subprocess
import time

MODEL_ID = "Qwen/Qwen3.5-9B"
REVISION = "c202236235762e1c871ad0ccb60c8ee5ba337b9a"
JOB_ID = re.compile(r"^qw-[a-f0-9]{32}$")
REQUIRED = ("torch", "transformers", "peft", "accelerate", "bitsandbytes", "safetensors")

def emit(kind, **values):
    print(json.dumps({"type": kind, **values}, ensure_ascii=False), flush=True)

def read_json(file):
    return json.loads(Path(file).read_text(encoding="utf-8"))

def write_json(file, value):
    file = Path(file)
    file.parent.mkdir(parents=True, exist_ok=True)
    temporary = file.with_suffix(file.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(file)

def child_path(root, *parts):
    root = Path(root).resolve()
    value = root.joinpath(*parts).resolve()
    if not value.is_relative_to(root):
        raise ValueError("Ruta fuera del laboratorio de evolución.")
    return value

def dependencies():
    result = {}
    for name in REQUIRED:
        try:
            result[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            result[name] = None
    return result

def model_snapshot(root):
    directory = child_path(root, "models", "Qwen3.5-9B")
    evidence_file = child_path(root, "model-source-verified.json")
    if not evidence_file.is_file():
        return directory, False
    evidence = read_json(evidence_file)
    if evidence.get("modelId") != MODEL_ID or evidence.get("revision") != REVISION:
        return directory, False
    files = evidence.get("files", [])
    if not files or len(files) > 30:
        return directory, False
    for item in files:
        file = child_path(directory, item["name"])
        if not file.is_file() or file.stat().st_size != item.get("bytes") or file.stat().st_mtime_ns != item.get("mtimeNs"):
            return directory, False
    return directory, True

def preflight(root):
    versions = dependencies()
    model_directory, model_present = model_snapshot(root)
    blocks = []
    if not all(versions.values()):
        blocks.append("Faltan dependencias del entorno aislado.")
    if not model_present:
        blocks.append("Falta el snapshot Hugging Face de Qwen3.5-9B verificado por hash; el GGUF activo no es un checkpoint entrenable con PEFT.")
    blocks.append("La receta BF16 LoRA de 9B documenta 22 GB de VRAM: esta GPU tiene 12 GB. QLoRA es experimental y Unsloth la desaconseja para Qwen3.5 por diferencias de cuantización.")
    native_export = child_path(root, "native-export-proof.json").is_file()
    benchmark_file = child_path(root, "training-profile-verified.json")
    benchmark = read_json(benchmark_file) if benchmark_file.is_file() else {}
    verified_profile = benchmark.get("modelRevision") == REVISION and benchmark.get("steps") == 8 and benchmark.get("candidateAdapterWeightsChanged") is True
    if not verified_profile:
        blocks.append("No se ha ejecutado todavía un backward de este Qwen9B ni medido que el perfil quepa en esta GPU.")
    result = {"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "modelId": MODEL_ID, "revision": REVISION, "dependencies": versions, "modelPresent": model_present, "trainingReady": bool(all(versions.values()) and model_present and verified_profile), "experimentalProbePrepared": bool(all(versions.values()) and model_present), "bf16LoraReady": False, "qloraExperimental": True, "blocks": blocks, "nativeAdapterConversionSmoke": native_export, "nativeCandidateEvaluationPassed": False, "qwenWeightsChanged": False, "cudaInitialized": False}
    write_json(child_path(root, "preflight.json"), result)
    return result

def assert_lease(file, owner_pid, nonce):
    lease = read_json(file)
    if lease.get("role") != "training" or lease.get("ownerPid") != owner_pid or lease.get("nonce") != nonce or lease.get("expiresAt", 0) <= time.time() * 1000:
        raise RuntimeError("La reserva exclusiva de GPU ha caducado.")
    if owner_pid <= 0:
        raise RuntimeError("Coordinador no válido.")
    if os.name == "nt":
        # os.kill(pid, 0) is NOT a portable liveness probe on Windows: 0 is
        # CTRL_C_EVENT there and may interrupt a shared console/process group.
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.OpenProcess.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.GetExitCodeProcess.argtypes = (wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD))
        kernel.GetExitCodeProcess.restype = wintypes.BOOL
        kernel.CloseHandle.argtypes = (wintypes.HANDLE,)
        handle = kernel.OpenProcess(0x1000, False, owner_pid)
        if not handle:
            raise RuntimeError("El proceso coordinador no está disponible.")
        try:
            code = wintypes.DWORD()
            if not kernel.GetExitCodeProcess(handle, ctypes.byref(code)) or code.value != 259:
                raise RuntimeError("El coordinador ha terminado.")
        finally:
            kernel.CloseHandle(handle)
    else:
        os.kill(owner_pid, 0)

def parse_exact_json(output, expected):
    try:
        actual = json.loads(output.strip())
        return json.dumps(actual, sort_keys=True, ensure_ascii=False) == json.dumps(expected, sort_keys=True, ensure_ascii=False)
    except (ValueError, TypeError):
        return False

def gate(baseline, candidate):
    b, c = baseline["holdout"], candidate["holdout"]
    measured = b["total"] >= 4 and b["total"] == c["total"]
    return {"measured": measured, "improvedOnSyntheticHoldout": measured and c["correct"] > b["correct"] and candidate["regression"]["correct"] >= baseline["regression"]["correct"], "canActivate": False, "reason": "Falta una evaluación nativa GGUF contra el modelo activo; no se publica automáticamente este adaptador."}

def messages(record, include_answer=False):
    values = [{"role": "system", "content": "Eres Atlas. Sigue exactamente el formato solicitado. No inventes pruebas ni cambios de pesos."}, {"role": "user", "content": record["prompt"]}]
    if include_answer:
        values.append({"role": "assistant", "content": json.dumps(record["answer"], ensure_ascii=False, separators=(",", ":"))})
    return values

def encode_training(tokenizer, record, max_length):
    prefix = tokenizer.apply_chat_template(messages(record), tokenize=True, add_generation_prompt=True, enable_thinking=False, return_dict=True)
    if hasattr(prefix, "keys"):
        prefix = prefix["input_ids"]
    # Concatenate the same generation prefix used in evaluation. Some templates
    # insert an empty thinking block only for add_generation_prompt=True; masking
    # by a different assistant-turn template could otherwise hide answer tokens.
    target = json.dumps(record["answer"], ensure_ascii=False, separators=(",", ":")) + tokenizer.eos_token
    complete = prefix + tokenizer(target, add_special_tokens=False)["input_ids"]
    # Silent truncation can delete the answer and train a model to stop early.
    if len(complete) > max_length or len(complete) <= len(prefix):
        raise ValueError("Una muestra excede la longitud revisada o carece de respuesta; no se trunca.")
    return {"input_ids": complete, "labels": [-100] * len(prefix) + complete[len(prefix):]}

def evaluate(model, tokenizer, corpus, lease_check):
    import torch
    result = {}
    model.eval()
    for split in ("holdout", "regression"):
        correct, answers = 0, []
        for record in corpus[split]:
            lease_check()
            inputs = tokenizer.apply_chat_template(messages(record), tokenize=True, add_generation_prompt=True, enable_thinking=False, return_tensors="pt", return_dict=True).to("cuda:0")
            with torch.inference_mode():
                output = model.generate(**inputs, max_new_tokens=96, do_sample=False, use_cache=True, pad_token_id=tokenizer.pad_token_id or tokenizer.eos_token_id)
            text = tokenizer.decode(output[0, inputs["input_ids"].shape[-1]:], skip_special_tokens=True)
            passed = parse_exact_json(text, record["answer"])
            correct += int(passed)
            answers.append({"id": record["id"], "passed": passed, "output": text[:1600]})
        result[split] = {"correct": correct, "total": len(corpus[split]), "answers": answers}
    return result

def validate_job(root, job_id):
    if not JOB_ID.fullmatch(job_id):
        raise ValueError("Identificador de experimento no válido.")
    directory = child_path(root, "jobs", job_id)
    job = read_json(directory / "job.json")
    if job.get("id") != job_id or job.get("model", {}).get("id") != MODEL_ID or job.get("model", {}).get("revision") != REVISION:
        raise ValueError("El experimento no pertenece a este modelo.")
    if (job.get("profile"), job.get("rank"), job.get("maxSequenceLength"), job.get("steps"), job.get("learningRate")) != ("qlora-experimental", 4, 128, 8, 0.00001):
        raise ValueError("La receta cambió fuera del presupuesto revisado.")
    if hashlib.sha256(Path(__file__).read_bytes()).hexdigest() != job.get("runnerSha256"):
        raise ValueError("El entrenador cambió después de preparar el experimento.")
    corpus_bytes = (directory / "corpus.json").read_bytes()
    if hashlib.sha256(corpus_bytes).hexdigest() != job.get("corpusSha256"):
        raise ValueError("El corpus no coincide con su identidad.")
    corpus = json.loads(corpus_bytes)
    if not (8 <= len(corpus.get("train", [])) <= 128 and 4 <= len(corpus.get("holdout", [])) <= 32 and len(corpus.get("regression", [])) == 2):
        raise ValueError("El corpus excede sus límites.")
    train_ids = {record["id"] for record in corpus["train"]}
    if any(record["id"] in train_ids for record in corpus["holdout"] + corpus["regression"]):
        raise ValueError("Hay contaminación entre entrenamiento y confirmación.")
    return directory, job, corpus

def train(root, job_id, lease_file, owner_pid, nonce):
    started = time.monotonic()
    lease_check = lambda: assert_lease(lease_file, owner_pid, nonce)
    lease_check()
    directory, job, corpus = validate_job(root, job_id)
    model_directory, verified = model_snapshot(root)
    if not verified:
        raise RuntimeError("Falta el snapshot entrenable verificado. El GGUF no se modifica.")
    # Only this branch imports a CUDA-capable model or allocates GPU memory.
    import torch
    from transformers import AutoTokenizer, BitsAndBytesConfig, Qwen3_5ForConditionalGeneration
    from peft import LoraConfig, get_peft_model
    torch.set_num_threads(2)
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA no está disponible para el experimento.")
    torch.cuda.reset_peak_memory_stats()
    emit("progress", stage="loading", progress=1)
    quantization = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=torch.bfloat16, llm_int8_skip_modules=["lm_head", "in_proj_a", "in_proj_b"])
    model = Qwen3_5ForConditionalGeneration.from_pretrained(model_directory, local_files_only=True, trust_remote_code=False, use_safetensors=True, dtype=torch.bfloat16, quantization_config=quantization, device_map={"": 0}, attn_implementation="sdpa")
    tokenizer = AutoTokenizer.from_pretrained(model_directory, local_files_only=True, trust_remote_code=False)
    rows = [encode_training(tokenizer, record, job["maxSequenceLength"]) for record in corpus["train"]]
    baseline = evaluate(model, tokenizer, corpus, lease_check)
    emit("progress", stage="baseline_measured", progress=20)
    # PEFT's general k-bit preparation may cast this model's huge embeddings and
    # language head to float32. Preserve frozen BF16 storage in this experiment;
    # its numerical stability and memory are explicitly not claimed in preflight.
    model.requires_grad_(False)
    model = get_peft_model(model, LoraConfig(r=4, lora_alpha=8, lora_dropout=0.0, bias="none", target_modules=["up_proj", "down_proj"], task_type="CAUSAL_LM"))
    parameters = [(name, p) for name, p in model.named_parameters() if p.requires_grad]
    if not parameters or any("lora_" not in name or ".mlp." not in name or ".layers." not in name for name, _ in parameters):
        raise RuntimeError("El adaptador intenta entrenar parámetros fuera de los MLP de texto.")
    model.enable_input_require_grads()
    model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
    model.config.use_cache = False
    optimizer = torch.optim.AdamW([p for _, p in parameters], lr=job["learningRate"])
    def adapter_digest():
        value = hashlib.sha256()
        for name, parameter in parameters:
            value.update(name.encode("utf-8"))
            value.update(parameter.detach().contiguous().view(torch.uint8).cpu().numpy().tobytes())
        return value.hexdigest()
    adapter_before = adapter_digest()
    losses = []
    model.train()
    for step in range(job["steps"]):
        lease_check()
        record = rows[step % len(rows)]
        batch = {key: torch.tensor([value], device="cuda:0") for key, value in record.items()}
        optimizer.zero_grad(set_to_none=True)
        output = model(**batch, use_cache=False)
        loss = output.loss
        if not math.isfinite(float(loss.detach())):
            raise RuntimeError("La pérdida no es finita; se conserva el modelo original.")
        loss.backward()
        torch.nn.utils.clip_grad_norm_([p for _, p in parameters], 1.0)
        optimizer.step()
        losses.append(float(loss.detach()))
        emit("progress", stage="training_candidate", progress=20 + round((step + 1) / job["steps"] * 50), loss=losses[-1])
    candidate = evaluate(model, tokenizer, corpus, lease_check)
    adapter_after = adapter_digest()
    adapter_changed = adapter_before != adapter_after
    target = child_path(directory, "adapter")
    model.save_pretrained(target, safe_serialization=True, save_embedding_layers=False)
    adapter_config = read_json(target / "adapter_config.json")
    adapter_config["base_model_name_or_path"] = MODEL_ID
    adapter_config["revision"] = REVISION
    write_json(target / "adapter_config.json", adapter_config)
    measured_gate = gate(baseline, candidate)
    if not adapter_changed:
        measured_gate["improvedOnSyntheticHoldout"] = False
    result = {"id": job_id, "trained": True, "active": False, "modelId": MODEL_ID, "revision": REVISION, "profile": job["profile"], "runnerSha256": job["runnerSha256"], "corpusSha256": job["corpusSha256"], "trainableParameters": sum(p.numel() for _, p in parameters), "steps": job["steps"], "losses": losses, "baseline": baseline, "candidate": candidate, "gate": measured_gate, "elapsedSeconds": time.monotonic() - started, "peakAllocatedBytes": torch.cuda.max_memory_allocated(), "qwenWeightsChanged": False, "candidateAdapterWeightsChanged": adapter_changed, "adapterBeforeSha256": adapter_before, "adapterAfterSha256": adapter_after, "scope": "Adaptador experimental separado. No sustituye el GGUF activo ni demuestra capacidad general; falta conversión y comparación nativa."}
    write_json(directory / "result.json", result)
    write_json(child_path(root, "training-profile-verified.json"), {"modelRevision": REVISION, "steps": job["steps"], "candidateAdapterWeightsChanged": adapter_changed, "gpuName": torch.cuda.get_device_name(0), "peakAllocatedBytes": result["peakAllocatedBytes"], "torchVersion": torch.__version__, "maxSequenceLength": job["maxSequenceLength"], "profile": job["profile"]})
    return result

def export_candidate(root, job_id):
    directory, _, _ = validate_job(root, job_id)
    result = read_json(directory / "result.json")
    if result.get("trained") is not True:
        raise RuntimeError("El candidato todavía no tiene un adaptador entrenado.")
    model_directory, verified = model_snapshot(root)
    if not verified:
        raise RuntimeError("El snapshot original debe conservarse verificado para exportar.")
    converter_root = child_path(root, "llama.cpp")
    # Pin the converter used by the CPU mapping smoke; no moving source branch.
    revision = subprocess.check_output(["git", "-C", str(converter_root), "rev-parse", "HEAD"], text=True).strip()
    if revision != "bc428e407a52bd3e21b5985cabeef57cdff9bc4a":
        raise RuntimeError("El convertidor cambió de versión; repite su preflight antes de usarlo.")
    import sys
    destination = child_path(directory, "adapter.gguf")
    arguments = [sys.executable, str(converter_root / "convert_lora_to_gguf.py"), "--base", str(model_directory), "--outtype", "f16", "--outfile", str(destination), str(directory / "adapter")]
    completed = subprocess.run(arguments, capture_output=True, text=True, timeout=180, env={**os.environ, "CUDA_VISIBLE_DEVICES": "", "HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1"}, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    if completed.returncode != 0 or not destination.is_file():
        raise RuntimeError("El convertidor no completó el adaptador real: " + completed.stderr[-400:])
    with destination.open("rb") as stream:
        if stream.read(4) != b"GGUF":
            raise RuntimeError("El resultado del convertidor no es GGUF.")
    value = {"id": job_id, "kind": "qwen35-lora-gguf", "bytes": destination.stat().st_size, "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(), "converterCommit": revision, "modelId": MODEL_ID, "modelRevision": REVISION, "nativeInferenceValidated": False, "canActivate": False, "qwenWeightsChanged": False}
    write_json(directory / "native-export.json", value)
    return value

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("preflight", "train", "export"))
    parser.add_argument("--root", required=True)
    parser.add_argument("--id")
    parser.add_argument("--lease-file")
    parser.add_argument("--owner-pid", type=int)
    parser.add_argument("--nonce")
    args = parser.parse_args()
    if args.action == "preflight":
        result = preflight(args.root)
    elif args.action == "export":
        if not args.id:
            raise ValueError("Falta el candidato para exportar.")
        result = export_candidate(args.root, args.id)
    else:
        if not args.id or not args.lease_file or not args.owner_pid or not args.nonce:
            raise ValueError("Faltan el candidato o la reserva de GPU.")
        result = train(args.root, args.id, args.lease_file, args.owner_pid, args.nonce)
    emit("result", result=result)

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        try:
            import sys
            job_id = sys.argv[sys.argv.index("--id") + 1]
            root = sys.argv[sys.argv.index("--root") + 1]
            if JOB_ID.fullmatch(job_id):
                write_json(child_path(root, "jobs", job_id, "error.json"), {"id": job_id, "trained": False, "active": False, "errorType": type(error).__name__, "error": str(error)[:1000], "qwenWeightsChanged": False, "at": time.time()})
        except Exception:
            pass
        emit("error", error=str(error)[:1000])
        raise SystemExit(1)
