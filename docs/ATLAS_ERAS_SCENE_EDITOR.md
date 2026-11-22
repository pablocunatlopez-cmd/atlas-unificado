# Atlas / ERAS · Scene editor architecture

ERAS is Atlas's internal graphics and game-creation engine. This change adds a browser-safe scene graph editor in `continuous/eras-scene-editor.mjs`.

## Example
```js
import {createErasSceneEditor} from './continuous/eras-scene-editor.mjs';
const editor=createErasSceneEditor();
editor.add({id:'forest',type:'group',parent:null,
 position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],asset:''});
editor.add({id:'oak',type:'mesh',parent:'forest',
 position:[5,0,7],rotation:[0,0,0],scale:[1,1,1],asset:'assets/oak.glb'});
editor.update('oak',{position:[6,0,7]});
editor.undo();
console.log(editor.snapshot());
```

## Rendering contract
- Scene nodes are declarative. A renderer adapter must map node types to actual Three.js or PlayCanvas entities, import assets, manage lifecycle and release GPU resources.
- Atlas should propose bounded edits through an explicit command interface. Validate every command; never evaluate model-generated JavaScript.
- For production, add validated material components, lights, cameras, animation state machines, physics colliders, asset allowlists, serialization/migrations and project persistence.
- Use a real character pipeline (rigged glTF, skinning, facial expressions, animation blending, hand/weapon attachment, foot IK), not procedural primitives.
- Compare PlayCanvas versus existing Three.js on a fixed vertical slice before switching engines.

## Current limitations
- Editor state is in memory only; undo/redo are not persisted.
- Asset paths are stored as text, not verified or downloaded.
- No graphics renderer, real model generation, physical simulation, or AAA art pipeline is provided by this module.
- GitHub review branch only; not deployed in ChatGPT Sites.
- Tests are added but not verified by executing the full suite.
