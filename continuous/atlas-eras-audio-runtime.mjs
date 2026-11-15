import {planErasSpatialAudio} from './eras-spatial-audio.mjs';
import {planErasSceneAudioSync} from './eras-scene-audio-sync.mjs';
import {createErasWebAudioBridge} from './eras-web-audio-bridge.mjs';
/**
 * Optional ERAS audio subsystem. Sources are injected by an approved host.
 * This module creates panner inputs, not autoplay or media decoders.
 */
export function createAtlasErasAudioRuntime({audioContext,listenerNode}={}){
 const bridge=createErasWebAudioBridge({audioContext,listenerNode});
 let disposed=false;
 return Object.freeze({
  sync({listener,emitters}={}){
   if(disposed)throw Error('ERAS audio runtime disposed');
   return bridge.sync(planErasSpatialAudio({listener,emitters}));
  },
  syncScene(snapshot){
   if(disposed)throw Error('ERAS audio runtime disposed');
   const scene=planErasSceneAudioSync(snapshot);
   return bridge.sync(planErasSpatialAudio(scene));
  },
  getEmitterInput(id){if(disposed)throw Error('ERAS audio runtime disposed');return bridge.getInput(id);},
  dispose(){if(disposed)return;bridge.dispose();disposed=true;}
 });
}
