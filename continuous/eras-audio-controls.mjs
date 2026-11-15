/**
 * UI-independent ERAS sound controls. The host binds these methods to
 * user-gesture buttons; no autoplay or implicit AudioContext.resume().
 */
export function createErasAudioControls({audioContext,audioRuntime}={}){
 if(!audioContext||typeof audioContext.resume!=='function'||
  typeof audioContext.suspend!=='function'||!audioRuntime||
  typeof audioRuntime.syncScene!=='function')
  throw Error('ERAS audio controls require Web Audio runtime');
 let enabled=false,disposed=false;
 return Object.freeze({
  async enable(){
   if(disposed)throw Error('Audio controls disposed');
   await audioContext.resume();enabled=true;
   return Object.freeze({enabled});
  },
  async disable(){
   if(disposed)throw Error('Audio controls disposed');
   await audioContext.suspend();enabled=false;
   return Object.freeze({enabled});
  },
  syncScene(snapshot){
   if(disposed)throw Error('Audio controls disposed');
   if(!enabled)return Object.freeze({enabled:false,skipped:true});
   return audioRuntime.syncScene(snapshot);
  },
  get enabled(){return enabled;},
  dispose(){disposed=true;enabled=false;}
 });
}
