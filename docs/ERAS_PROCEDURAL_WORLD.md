# ERAS procedural world + streaming

## Implemented
- `continuous/eras-procedural-world.mjs` produces deterministic, bounded scene manifests for terrain chunks, with object positions, scale, rotation and type.
- `continuous/eras-world-streaming.mjs` determines nearby chunks to load/unload as the player moves, prioritizing the nearest.
- Browser-compatible pure JavaScript, no GPU or local model dependency.

## Example
```js
import {planErasVisibleChunks,diffErasChunks} from './continuous/eras-world-streaming.mjs';
import {generateErasWorldChunk} from './continuous/eras-procedural-world.mjs';
const next=planErasVisibleChunks({x:100,z:40,radius:2,maxChunks:25});
const manifest=generateErasWorldChunk({seed:2026,chunkX:next.visible[0].x,chunkZ:next.visible[0].z});
console.log(manifest.objects);
```

## Required rendering integration
1. Create instanced meshes from the manifest with real tree/rock glTF assets and PBR materials.
2. Apply frustum/occlusion culling and LOD to render distant objects efficiently.
3. Use the streaming planner to load nearby assets and release old resources.
4. Supply terrain height and align object y values; the current manifest uses y=0.
5. Add collision, navigation meshes, environmental audio, weather, animation and asset memory budgets.
6. Profile on the actual Sites build and target mobile performance.

## Limits
This is not an AAA graphics engine or a complete open world. No terrain mesh, models, textures, animation or rendering pipeline is generated here. The ChatGPT Sites ERAS project has not been edited and the GitHub branch has not been merged.
