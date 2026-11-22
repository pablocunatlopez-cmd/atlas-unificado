# Atlas + ERAS · First actual browser render runtime

ERAS is the **graphics engine inside Atlas**, not a standalone game.

The new `continuous/atlas-eras-runtime.mjs` composes:
1. `eras-three-viewport.mjs`: Three.js WebGLRenderer, scene, camera, lighting, resize and draw.
2. `eras-three-adapter.mjs`: create/update/delete scene objects.
3. `eras-validated-renderer.mjs`: validate nodes and registered asset references before syncing.

## Browser host example
```js
import * as THREE from 'three';
import {createErasAssetRegistry} from './continuous/eras-asset-registry.mjs';
import {createAtlasErasRuntime} from './continuous/atlas-eras-runtime.mjs';

const canvas=document.querySelector('#atlas-eras-canvas');
const registry=createErasAssetRegistry();
const eras=createAtlasErasRuntime({THREE,canvas,registry});
await eras.applyScene({schemaVersion:1,nodes:[
 {id:'cube',type:'mesh',parent:null,position:[0,0,0],
  rotation:[0,0,0],scale:[1,1,1],asset:''}
]});
eras.frame();
// Host owns the animation loop, input handling, asset loading and lifecycle.
```

## What is now possible
If the host can import these modules and has Three.js installed, a scene with a placeholder mesh can be drawn in a canvas. This is the first end-to-end *code path* from declarative scene to actual render calls, not a verified deployed screenshot.

## Important limitations
- This code is not yet integrated or deployed in ChatGPT Sites.
- No browser-based visual verification, GPU benchmarks, CI execution or AAA art validation has been performed.
- Real glTF assets need an approved loader and integrity verification; current placeholders are boxes.
- Camera controls, animation loop, physics, collision, rigging, terrain height, LOD and robust renderer error recovery remain.
- Changing an existing node's type or asset is currently unsupported; the scene adapter rejects that update.
- Three.js must be supplied by the actual host runtime.

## Next acceptance milestone
Deploy an Atlas page with a canvas, render a licensed rigged character and PBR environment, verify on iPhone and desktop, and measure frame-time p95. Only then compare against a PlayCanvas prototype.
