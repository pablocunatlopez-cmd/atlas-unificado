const NODE_ID=/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const finiteVector=value=>Array.isArray(value)&&value.length===3&&
 value.every(component=>typeof component==='number'&&Number.isFinite(component)&&Math.abs(component)<=1e6);

/**
 * Convert a bounded ERAS compiler manifest into renderer-neutral scene nodes.
 * Only procedural tree/rock primitives are supported; manifests cannot name
 * arbitrary assets, URLs or executable content.
 */
export function atlasErasManifestToSceneGraph(manifest,{maxNodes=1000}={}){
 if(!manifest||manifest.schemaVersion!==1||manifest.engine!=='ERAS'||
    manifest.renderStatus!=='manifest_only'||!Array.isArray(manifest.chunks)||
    !Number.isSafeInteger(maxNodes)||maxNodes<1||maxNodes>10000)
  throw Error('Invalid ERAS manifest');
 const nodes=[{
  id:'eras-root',type:'group',parent:null,
  position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],asset:''
 }];
 for(const [chunkIndex,chunk] of manifest.chunks.entries()){
  if(!chunk||!Array.isArray(chunk.chunk)||chunk.chunk.length!==2||
     !chunk.chunk.every(Number.isSafeInteger)||!Array.isArray(chunk.objects))
   throw Error('Invalid ERAS chunk');
  const [chunkX,chunkZ]=chunk.chunk;
  const groupId=`eras-chunk-${chunkX}-${chunkZ}`;
  if(!NODE_ID.test(groupId))throw Error('Invalid ERAS chunk ID');
  nodes.push({
   id:groupId,type:'group',parent:'eras-root',
   position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],asset:''
  });
  if(nodes.length>maxNodes)throw Error('ERAS scene node budget exceeded');
  for(const [objectIndex,object] of chunk.objects.entries()){
   if(!object||!['tree','rock'].includes(object.type)||
      !finiteVector(object.position)||!Number.isFinite(object.rotationY)||
      !Number.isFinite(object.scale)||object.scale<=0||object.scale>100)
    throw Error('Invalid ERAS object');
   const id=`eras-object-${chunkIndex}-${objectIndex}`;
   if(!NODE_ID.test(id))throw Error('Invalid ERAS object ID');
   nodes.push({
    id,type:'mesh',parent:groupId,
    position:object.position,
    rotation:[0,object.rotationY,0],
    scale:[object.scale,object.scale,object.scale],
    asset:'',primitive:object.type
   });
   if(nodes.length>maxNodes)throw Error('ERAS scene node budget exceeded');
  }
 }
 return Object.freeze({schemaVersion:1,sceneId:manifest.sceneId,nodes});
}
