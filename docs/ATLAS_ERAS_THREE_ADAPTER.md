# Atlas / ERAS · Three.js renderer adapter

ERAS is Atlas's integrated 3D engine. The first host renderer adapter is now in `continuous/eras-three-adapter.mjs`.

## Integration sketch
```js
import * as THREE from 'three';
import {createErasThreeAdapter} from './continuous/eras-three-adapter.mjs';
import {createValidatedErasRenderer} from './continuous/eras-validated-renderer.mjs';
import {createErasAssetRegistry} from './continuous/eras-asset-registry.mjs';

const scene=new THREE.Scene();
const registry=createErasAssetRegistry();
const adapter=createErasThreeAdapter({THREE,scene,resolveAsset:async id=>{
  // Must use an approved asset registry and actual verified loader.
  throw Error('No approved asset loader configured: '+id);
}});
const renderer=createValidatedErasRenderer(adapter,registry);
await renderer.sync({schemaVersion:1,nodes:[
 {id:'demo',type:'mesh',parent:null,position:[0,0,0],
  rotation:[0,0,0],scale:[1,1,1],asset:''}
]});
// The host must also instantiate WebGLRenderer/WebGPURenderer, camera,
// canvas, lighting and an animation/render loop.
```

## Features
- Real Three.js object creation for groups, meshes, lights and cameras.
- Parent-child hierarchy, transform updates, and object removal.
- Placeholder geometry uses disposable geometry/material resources.
- Optional trusted model resolver (returns clonable Three.js objects).

## Limitations and next steps
1. This adapter does not instantiate a canvas or render loop. The Sites host must provide them.
2. Asset loading requires a verified, approved loader. Asset registry SHA-256 is metadata only until the loader checks bytes.
3. Changing a node's asset or type currently throws: bridge must support replacement/recreation.
4. Renderer sync is not transactional: partial failures require recovery.
5. The adapter is not yet deployed or visually tested in ChatGPT Sites. Unit tests are committed but not verified in CI.
6. To achieve AAA quality: use licensed high-quality rigged assets, PBR textures, shadows, environment lighting, animation blending, physics, LOD, streaming and real performance benchmarks.
