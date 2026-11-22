/**
 * Extract approved listener/emitter coordinates from a simple ERAS scene
 * snapshot. This is a data adapter, not an audio player or a physics engine.
 */
export function planErasSceneAudioSync({camera,entities=[],maxEmitters=64}={}){
 const vec=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
 if(!vec(camera?.position)||!Array.isArray(entities)||entities.length>2000||
  !Number.isSafeInteger(maxEmitters)||maxEmitters<1||maxEmitters>128)
  throw Error('Invalid ERAS audio scene snapshot');
 const seen=new Set(),emitters=[];
 for(const entity of entities){
  if(!entity?.audio)continue;
  if(emitters.length>=maxEmitters)throw Error('ERAS audio emitter budget exceeded');
  const {id,position,audio}=entity;
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(id)||seen.has(id)||
   !vec(position)||typeof audio.gain!=='number'||!Number.isFinite(audio.gain)||
   audio.gain<0||audio.gain>1)throw Error('Invalid ERAS scene audio entity');
  seen.add(id);emitters.push({id,position:[...position],gain:audio.gain});
 }
 return Object.freeze({listener:[...camera.position],emitters,
  status:'ready_for_audio_runtime_sync',rendered:false});
}
