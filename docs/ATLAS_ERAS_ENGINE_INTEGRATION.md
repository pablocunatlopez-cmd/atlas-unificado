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

The resulting manifest contains a scene ID, profile, player coordinates, chunk manifests and required asset types. Its `renderStatus` is `manifest_only`: compilation alone does not render.

## Optional house renderer
`cloud/public/house/eras-manifest-three.js` accepts this procedural world manifest
(not the separate scene-editor snapshot format) and constructs a Three.js group
of instanced tree and rock placeholders. It validates versions, chunks, IDs,
types, transforms and budgets before allocating; it does not fetch assets or
interpret source code. The returned `{group, objectCount, dispose}` owns its
geometry, materials and instance buffers. Call `dispose()` when finished.

The house exposes an opt-in `buildHouse({erasManifest: manifest})` and
`house.setErasManifest(manifest)` for a host that already has a manifest.
The iframe's `HouseAPI.setErasManifest(manifest)` sends it over the existing
same-origin parent channel and returns `{accepted, objects}`. Interior and
out-of-range objects are filtered, while malformed manifests and empty results
preserve the previous world. The original garden remains under the optional
overlay. The default runtime does not supply a manifest, so its visuals are unchanged.
This does not add terrain, collision, streaming, a network endpoint, or a UI
for selecting manifests. Placeholders are not the required production assets;
graphics-profile metadata is not applied. Browser rendering and deployment
remain separate from successful manifest compilation.

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
