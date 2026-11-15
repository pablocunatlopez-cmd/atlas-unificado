import {createErasThreeViewport} from './eras-three-viewport.mjs';
import {createErasThreeAdapter} from './eras-three-adapter.mjs';
import {createValidatedErasRenderer} from './eras-validated-renderer.mjs';

/**
 * Atlas ERAS runtime: host injects THREE, canvas and approved asset registry.
 * No automatic network, model calls, RAF or script execution.
 */
export function createAtlasErasRuntime({THREE,canvas,registry,resolveAsset,width=800,height=450,pixelRatio=1}={}){
 if(!registry||typeof registry.validateReferences!=='function')
   throw Error('Trusted asset registry required');
 const viewport=createErasThreeViewport({THREE,canvas,width,height,pixelRatio});
 const adapter=createErasThreeAdapter({THREE,scene:viewport.scene,resolveAsset});
 const bridge=createValidatedErasRenderer(adapter,registry);
 let disposed=false;
 const ensureOpen=()=>{if(disposed)throw Error('ERAS runtime disposed');};
 return Object.freeze({
  async applyScene(snapshot){ensureOpen();return bridge.sync(snapshot);},
  frame(){ensureOpen();viewport.render();},
  resize(w,h,ratio){ensureOpen();viewport.resize(w,h,ratio);},
  get scene(){return viewport.scene;},
  get camera(){return viewport.camera;},
  async dispose(){
   if(disposed)return;
   // If renderer disposal fails, retain a retryable state.
   await bridge.dispose();
   viewport.dispose();disposed=true;
  },
 });
}
