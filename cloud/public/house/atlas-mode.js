/**
 * Browser-safe, opt-in Atlas mode coordinator for the existing ERAS house.
 * No imports from continuous/, no renderer allocation, no global listeners.
 * The host owns the scene, camera and animation loop.
 */
export function createAtlasHouseMode({enter,leave,renderFrame}={}){
 if([enter,leave,renderFrame].some(fn=>typeof fn!=='function'))
  throw Error('House mode requires explicit host adapters');
 let mode='house',disposed=false,elapsed=0;
 function activate(){
  if(disposed)throw Error('House mode disposed');
  if(mode==='atlas')return false;
  enter();mode='atlas';elapsed=0;return true;
 }
 function deactivate(){
  if(mode!=='atlas')return false;
  leave();mode='house';elapsed=0;return true;
 }
 function frame(deltaMs){
  if(disposed)throw Error('House mode disposed');
  if(!Number.isFinite(deltaMs)||deltaMs<0||deltaMs>1000)
   throw Error('Invalid frame delta');
  if(mode!=='atlas')return false;
  elapsed=Math.min(5000,elapsed+deltaMs);
  renderFrame(elapsed);return true;
 }
 function dispose(){if(disposed)return;deactivate();disposed=true;}
 return Object.freeze({activate,deactivate,frame,dispose,
  get mode(){return mode;},get disposed(){return disposed;},
  rendererCreated:false,houseRuntimeReplaced:false});
}
