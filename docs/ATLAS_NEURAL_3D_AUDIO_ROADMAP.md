# Atlas multimodal neural roadmap (research and integration)

The local-first goal is a measured, resource-aware collection of replaceable
engines, **not** a claim that Atlas has trained a new frontier model.
No model is installed or executed by this document or the router.

## 1. Reasoning, coding and vision
- llama.cpp (https://github.com/ggml-org/llama.cpp): GGUF quantized
  inference with CUDA/CPU offload. Keep Ollama as the existing service option.
- Start with a small code-capable model, deterministic code tasks and a
  commit-bound evaluation suite. Never accept model claims as test evidence.
- Introduce retrieval and memory with source provenance and expiration;
  compare against the baseline before promoting any model.
- Route based on measured VRAM, tokens/s, accuracy, latency and power.
  No simultaneous model residency is promised on an RTX 3060.

## 2. ERAS neural 3D
- gsplat (https://github.com/nerfstudio-project/gsplat) for offline scene
  reconstruction; not a replacement for skeletal rigs, collisions or gameplay.
- Keep Three.js/glTF for interactive meshes, animation and mobile WebGL.
  Add a validated asset import pipeline, LOD and GPU frame-time benchmarks.
- Reconstruct static environments offline, export compatible assets and compare
  memory, frame time, loading and visual fidelity on target devices.
- Only allow approved model outputs through the existing ERAS asset registry.

## 3. Atlas audio
- whisper.cpp (https://github.com/ggml-org/whisper.cpp): local STT, optional
  CUDA. Require explicit microphone consent and do not persist raw recordings
  by default.
- AudioCraft (https://github.com/facebookresearch/audiocraft): music/SFX
  research. Code is MIT; published weights are CC-BY-NC 4.0. Do not use
  these weights for commercial output without appropriate rights.
- Demucs (https://github.com/facebookresearch/demucs): source separation
  research; repository archived. Review alternatives before production.
- For ERAS, prioritize deterministic spatial audio (Web Audio API, attenuation,
  occlusion and listener pose) before heavy generative inference.
- For music, export stems/MIDI/WAV only through explicitly approved workflows.

## Integration gates
1. Host probes actual installed runtime, model weights, hash and license.
2. Benchmark a baseline and candidate with identical representative inputs.
3. Enforce GPU/CPU budget and unload inactive models before changing domains.
4. Validate outputs (audio duration/sample rate, 3D mesh/texture budgets,
   code tests) and record provenance.
5. LOR-ΩΣ records measurements and negative outcomes; promotion requires
   independent trusted verification and human approval for risky changes.

## Status
Implemented: declarative backend catalog and fail-closed routing plan with tests.
Not implemented: downloads, runtime probes, neural inference, 3D reconstruction,
audio generation, Web Audio integration, benchmark-driven scheduling.

## Current hardware policy: no discrete GPU assumed
- CPU-only is the default for neural routing. CUDA-only gsplat is excluded
  until the host confirms a suitable CUDA device and available VRAM.
- Start with small quantized GGUF models and whisper.cpp tiny/base variants;
  actual compatibility, speed and memory must be measured on the user's CPU.
- CPU workload admission reserves RAM for the OS, model runtime and context.
  It is a conservative heuristic, not a runtime probe.
- ERAS real-time 3D should use lightweight Three.js/WebGL geometry and LOD,
  not neural scene reconstruction on the CPU.
- Use Web Audio spatialization for sound without a generative neural model.
- Load one heavyweight model at a time; preserve fallback to non-neural tools.
- Future GPU acceleration is optional and must not become a startup dependency.
