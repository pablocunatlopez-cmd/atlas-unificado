/** Deterministic, bounded, editable world specification. No GPU or model required.
 * Export manifest is data only: consumers must validate assets and permissions.
 */
const KINDS=new Set(['terrain','building','tree','light','camera','character','prop']);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const vec=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(finite);
const safeId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(id);
export function compileAtlasWorld(spec){
 if(!spec||typeof spec!=='object'||Array.isArray(spec)||!safeId(spec.id)||
  typeof spec.title!=='string'||!spec.title.trim()||spec.title.length>120||
  !Array.isArray(spec.objects)||spec.objects.length>1000)
  throw new TypeError('Invalid Atlas world');
 const ids=new Set();
 const objects=spec.objects.map((o,i)=>{
  if(!o||!safeId(o.id)||ids.has(o.id)||!KINDS.has(o.kind)||
   !vec(o.position,3)||!vec(o.rotation??[0,0,0],3)||!vec(o.scale??[1,1,1],3)||
   [...o.position,...(o.rotation??[0,0,0]),...(o.scale??[1,1,1])].some(x=>Math.abs(x)>100000)||
   (o.scale??[1,1,1]).some(x=>x<=0)||
   (o.asset!==undefined&&(typeof o.asset!=='string'||o.asset.length>256||
     /^(?:https?:|data:|file:|javascript:)|\.\./i.test(o.asset))))
   throw new TypeError('Invalid world object at '+i);
  ids.add(o.id);
  return Object.freeze({id:o.id,kind:o.kind,position:Object.freeze([...o.position]),
   rotation:Object.freeze([...(o.rotation??[0,0,0])]),
   scale:Object.freeze([...(o.scale??[1,1,1])]),asset:o.asset??null});
 });
 return Object.freeze({schema:'atlas-world-manifest-v1',id:spec.id,title:spec.title.trim(),
  objects:Object.freeze(objects),objectCount:objects.length,
  editable:true,renderer:'not-selected',generatedAssets:false,
  renderExecuted:false,physicsExecuted:false,validatedAssets:false});
}
export function atlasWorldSceneSummary(world){
 if(!world||world.schema!=='atlas-world-manifest-v1'||!Array.isArray(world.objects))
  throw new TypeError('Invalid compiled world');
 const counts={};
 for(const obj of world.objects)counts[obj.kind]=(counts[obj.kind]??0)+1;
 return Object.freeze({worldId:world.id,counts:Object.freeze(counts),
  nextStep:'import-into-reviewed-renderer',gpuRequired:false});
}
