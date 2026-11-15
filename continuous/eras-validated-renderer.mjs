import {validateErasRenderSnapshot} from './eras-render-preflight.mjs';
import {createErasRendererBridge} from './eras-renderer-bridge.mjs';

/**
 * ERAS validated rendering facade. Inject trusted renderer and asset registry.
 * All model-generated scene snapshots pass through preflight first.
 */
export function createValidatedErasRenderer(adapter,registry,{maxNodes=1000}={}){
 const bridge=createErasRendererBridge(adapter,{maxNodes});
 return Object.freeze({
  async sync(snapshot){
   validateErasRenderSnapshot(snapshot,registry,{maxNodes});
   return bridge.sync(snapshot);
  },
  dispose:()=>bridge.dispose(),
  ids:()=>bridge.ids(),
 });
}
