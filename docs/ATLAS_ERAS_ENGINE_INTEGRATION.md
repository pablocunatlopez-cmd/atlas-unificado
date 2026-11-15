# Atlas / ERAS: integrated graphics engine contract

**ERAS is the graphics engine inside Atlas, not a separate game.** Atlas generates and edits scene specifications; ERAS translates those specifications into a rendered interactive world. LOR-ΩΣ evaluates scene quality, performance and correctness.

## Implemented integration layer
`continuous/atlas-eras-engine-bridge.mjs` combines existing procedural generation, chunk planning and graphics profiles into a single declarative scene manifest:

```js
import {compileAtlasErasScene} from './continuous/atlas-eras-engine-bridge.mjs';
const scene=compileAtlasErasScene({
  id:'forest',seed:42,player:{x:0,z:0},
  graphics:{mobile:true},world:{radius:1,maxChunks:9,vegetation:24}
});
```

The resulting manifest contains a scene ID, profile, player coordinates, chunk manifests and required asset types. **It is not yet a rendered scene.**

## Planned engine layers
1. Atlas creation API: `createScene`, `addCharacter`, `createTerrain`, `applyMaterial`, `animate`, `preview`, `benchmark`.
2. ERAS scene graph: entities, parent-child transforms, components, asset references, versioned serialization.
3. Renderer adapters: existing Three.js first; compare PlayCanvas and Babylon.js in the actual Sites runtime before migration.
4. Asset pipeline: glTF/GLB, PBR textures, skeletons, LOD, instancing, compressed texture loading and caching.
5. Runtime: physics, navigation, inverse kinematics, camera and mobile input.
6. Creator tools: preview, scene editing, undo/redo, reproducible seeds and export.
7. LOR-ΩΣ: visual regression screenshots, frame-time p95, memory and interaction tests with an independent evaluator.

## Non-goals and caveats
- The bridge does not execute model-generated JavaScript or fetch arbitrary assets.
- AAA graphics require real high-quality art assets and a working renderer; a JSON manifest alone is not AAA.
- This GitHub code is not automatically installed in ChatGPT Sites.
- No full end-to-end graphics test or actual Sites deployment has been performed.
