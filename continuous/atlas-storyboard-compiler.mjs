/** Storyboard planner: structured cinematic shots, no invented render or AI output. */
const safeId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(id);
export function compileAtlasStoryboard({id,worldId,shots}={}){
 if(!safeId(id)||!safeId(worldId)||!Array.isArray(shots)||shots.length<1||shots.length>120)
  throw new TypeError('Invalid storyboard');
 const ids=new Set();let duration=0;
 const out=shots.map(s=>{
  if(!s||!safeId(s.id)||ids.has(s.id)||!Number.isFinite(s.durationSeconds)||
   s.durationSeconds<.1||s.durationSeconds>30||typeof s.description!=='string'||
   !s.description.trim()||s.description.length>1000||
   (s.camera!==undefined&&!['wide','medium','close-up','tracking','aerial'].includes(s.camera)))
   throw new TypeError('Invalid shot');
  ids.add(s.id);duration+=s.durationSeconds;
  return Object.freeze({id:s.id,durationSeconds:s.durationSeconds,
   description:s.description.trim(),camera:s.camera??'wide',status:'planned'});
 });
 if(duration>900)throw new RangeError('Storyboard exceeds 15 minutes');
 return Object.freeze({schema:'atlas-storyboard-v1',id,worldId,shots:Object.freeze(out),
  durationSeconds:duration,rendered:false,videoFile:null,requiresRenderer:true});
}
