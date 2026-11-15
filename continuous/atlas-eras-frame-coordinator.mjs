/**
 * Explicit frame coordinator for ERAS visuals + positional audio.
 * The host supplies validated scene snapshots and audio-enabled entities.
 * No requestAnimationFrame loop is started by this module.
 */
export function createAtlasErasFrameCoordinator({visualRuntime,audioRuntime}={}){
 if(!visualRuntime||typeof visualRuntime.frame!=='function'||
  !audioRuntime||typeof audioRuntime.syncScene!=='function')
  throw Error('ERAS visual and audio runtimes required');
 let disposed=false,frameCount=0;
 return Object.freeze({
  frame(sceneSnapshot){
   if(disposed)throw Error('ERAS frame coordinator disposed');
   const audio=audioRuntime.syncScene(sceneSnapshot);
   visualRuntime.frame();
   frameCount++;
   return Object.freeze({frameCount,audio,visualRendered:true});
  },
  dispose(){disposed=true;}
 });
}
