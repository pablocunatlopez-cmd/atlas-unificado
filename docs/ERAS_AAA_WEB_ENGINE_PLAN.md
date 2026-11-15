# ERAS · AAA-quality web graphics roadmap

## Goal
ERAS is a browser-first game in ChatGPT Sites. Aim for high-end visual fidelity and excellent controls, without promising Unreal Engine 5 console-grade output on a phone.

## Engine comparison (2026)
- **PlayCanvas** https://github.com/playcanvas/engine : WebGPU/WebGL2, PBR, skinning, glTF, compressed textures, animation state machines, clustered lighting, streaming. Recommended candidate for a separate vertical slice.
- **Babylon.js** https://github.com/BabylonJS/Babylon.js : mature engine with WebGPU, physics, animation, inspector; strong alternative.
- **Three.js** https://github.com/mrdoob/three.js : already a dependency of Atlas. Keep as the low-risk baseline until a visual prototype demonstrates a migration benefit.
- **Godot** https://github.com/godotengine/godot : strong native editor/game tooling, but exporting a full Godot project into the current Sites workflow is a larger architecture change.
- **Unreal Engine**: benchmark for art direction, materials, animation and environments, not a drop-in browser renderer.

## What to build
1. Vertical slice: one detailed character, one 100m environment, one interaction, one combat action, one cinematic camera.
2. Character: glTF skinned mesh with physically based skin/hair/cloth materials; rigged hand/weapon sockets; locomotion blend tree, idle/walk/run/turn, inverse kinematics for feet/hands.
3. World: chunk streaming, LOD/HLOD, instancing for foliage, occlusion/frustum culling, terrain materials, environmental audio, weather and time-of-day.
4. Rendering: PBR + image-based lighting, contact and cascade shadows, temporal antialiasing where supported, exposure, tone mapping, bloom used sparingly.
5. Performance: dynamic resolution, fixed physics timestep, telemetry for FPS, frame-time p95, draw calls, GPU memory proxies, startup and asset download size.
6. Controls: touch joystick with deadzone and configurable sensitivity, camera orbit, gamepad, keyboard/mouse, accessible HUD and motion options.
7. Creator tools: deterministic seeded terrain/vegetation generation, editable scene graph, asset import validation, generated content preview and undo/rollback.
8. AI creation: Atlas can draft scene JSON, scripts and asset manifests; generated 3D models/textures still need real production tools and visual QA.

## First code component
`continuous/eras-graphics-quality.mjs` exports profiles and quality adaptation. It does not itself modify the current Sites scene or install PlayCanvas.

## Migration gate
Do NOT replace Three.js without an A/B prototype on the actual Sites deployment target, measuring frame-time p95, asset download size, memory use, input latency, animation correctness and visual quality. Engine migration can break existing game content.

## Acceptance targets (engineering goals, not measured results)
- Desktop high: aim for 60 FPS with p95 frame time <= 20 ms in the vertical slice.
- Mobile: aim for stable 30 FPS with p95 frame time <= 38 ms and usable touch controls.
- Character rig: no floating weapon; hands remain attached to sockets during all locomotion/combat transitions.
- No missing textures, faceted placeholder character, broken trees, or black screen on fallback browsers.

## Honest status
This is a roadmap and a reusable quality governor committed in GitHub. No edits to the ChatGPT Sites ERAS project have been performed, no PlayCanvas migration has been executed, and AAA fidelity has not been achieved or measured.
