# Atlas / ERAS · Engine comparison and upgrade gates (2026-11)

ERAS is the integrated graphics and interactive-world engine **inside Atlas**, not a separate game. Atlas is responsible for authoring, planning and validating scene edits; ERAS owns renderers, assets, animation, physics and runtime.

## Compared technologies (official documentation)
| Engine | Strengths | Risks | ERAS decision |
|---|---|---|---|
| PlayCanvas | WebGPU/WebGL2, PBR, state animations, physics, glTF compression, Gaussian splats, browser editor | Migration costs, host integration unknown | Leading prototype candidate |
| Babylon.js | WebGPU, Havok physics, frame graph, scene tools | Migration costs, bundle/asset integration | Comparison candidate |
| Three.js | Existing project-compatible baseline, WebGPURenderer, TSL, postprocessing | WebGPU path experimental; existing shaders/effects may need porting | Baseline and fallback |

Sources:
- https://developer.playcanvas.com/user-manual/engine/
- https://developer.playcanvas.com/user-manual/graphics/
- https://www.babylonjs.com/specifications/
- https://threejs.org/manual/pages/webgpurenderer

## Implementation already added
- Scene graph with undo/redo
- Deterministic world chunk generation and streaming plans
- Adaptive graphics profile planner
- Declarative Atlas-to-ERAS scene compilation
- Renderer reconciliation adapter
- Allowlisted asset registry with SHA-256 metadata

## Security and correctness rules
- Atlas never emits executable code to the renderer; use validated declarative commands.
- Asset IDs resolve only to host-approved local resources; SHA-256 metadata must be verified by the actual loader, not merely stored.
- Render sync must become transactional or recoverable after adapter failure.
- Approval for publishing code or assets must be verified by trusted host identity.
- No claims of AAA quality without screenshots, GPU profiling and input tests on actual hardware.

## Required vertical slice
1. Import a rigged glTF character and animation clips.
2. Load an HDR environment and PBR materials with real texture assets.
3. Show terrain, foliage instancing and chunk streaming.
4. Camera orbit + touch controls, skeletal hand/weapon attachment.
5. Compare Three.js vs PlayCanvas with the same assets and hardware.
6. Record p95 frame time, memory, startup bytes, input latency and screenshot regression.
7. Integrate the winning renderer into the real Atlas Sites runtime.

## Extension/access needs
To perform actual deployment, need access to the Atlas Sites project editor or source files and its supported storage/runtime API. GitHub access alone does not grant permission or a technical route to deploy Sites. A verified asset source or licensed glTF art pack is needed for a photorealistic scene.

## Current status
GitHub review branch only. No visual scene, renderer deployment, or AAA result has been verified.
