/** glTF 2.0 JSON scene skeleton for reviewed external renderer.
 * Primitive nodes have transforms only: no fabricated meshes or downloaded assets.
 */
export function exportLiaGltfScene(world){
 if(!world||world.schema!=='atlas-world-manifest-v1'||!Array.isArray(world.objects)||
  typeof world.id!=='string'||world.objects.length>1000)
  throw new TypeError('Invalid world manifest');
 const nodes=world.objects.map(o=>{
  if(!o||typeof o.id!=='string'||!Array.isArray(o.position)||o.position.length!==3||
   !Array.isArray(o.rotation)||o.rotation.length!==3||
   !Array.isArray(o.scale)||o.scale.length!==3||
   [...o.position,...o.rotation,...o.scale].some(n=>!Number.isFinite(n)))
   throw new TypeError('Invalid world node');
  const [x,y,z]=o.rotation.map(v=>v/2);
  const sx=Math.sin(x),cx=Math.cos(x),sy=Math.sin(y),cy=Math.cos(y),sz=Math.sin(z),cz=Math.cos(z);
  const q=[sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz];
  return {name:o.id,translation:[...o.position],rotation:q,scale:[...o.scale],
   extras:{atlasKind:o.kind,assetReference:o.asset??null,geometryGenerated:false}};
 });
 return {asset:{version:'2.0',generator:'Lia world skeleton exporter'},
  scene:0,scenes:[{name:world.title,nodes:nodes.map((_,i)=>i)}],nodes,
  extras:{liaWorldId:world.id,meshesGenerated:false,materialsGenerated:false}};
}
