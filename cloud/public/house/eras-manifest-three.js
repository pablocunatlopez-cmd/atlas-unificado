import * as THREE from './vendor/three.module.js';

const finite=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;

// Only the procedural world manifest is supported; scene-editor snapshots have
// a different contract. Validate everything before allocating render resources.
function readManifest(manifest,acceptObject){
 if(!manifest||manifest.schemaVersion!==1||manifest.engine!=='ERAS'||manifest.renderStatus!=='manifest_only'||
    typeof manifest.sceneId!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(manifest.sceneId)||
    !Number.isSafeInteger(manifest.seed)||!Array.isArray(manifest.chunks)||manifest.chunks.length>289)
  throw Error('Invalid ERAS world manifest');
 const chunks=new Set(),ids=new Set(),objects=[];
 for(const chunk of manifest.chunks){
  if(!chunk||chunk.schemaVersion!==1||chunk.seed!==manifest.seed||!Array.isArray(chunk.chunk)||chunk.chunk.length!==2||
     !chunk.chunk.every(Number.isSafeInteger)||!finite(chunk.size,8,256)||chunk.key!==chunk.chunk.join(':')||
     chunks.has(chunk.key)||!Array.isArray(chunk.objects)||chunk.objects.length>200)
   throw Error('Invalid ERAS chunk');
  chunks.add(chunk.key);
  const [x,z]=chunk.chunk,lowX=x*chunk.size,lowZ=z*chunk.size;
  if(!finite(lowX,-1000000,1000000)||!finite(lowZ,-1000000,1000000))throw Error('ERAS chunk out of bounds');
  for(const object of chunk.objects){
   if(!object||typeof object.id!=='string'||!/^chunk--?\d+--?\d+-\d+$/.test(object.id)||ids.has(object.id)||
      !['tree','rock'].includes(object.type)||object.lodGroup!==object.type||
      !Array.isArray(object.position)||object.position.length!==3||
      !finite(object.position[0],lowX-.001,lowX+chunk.size+.001)||object.position[1]!==0||
      !finite(object.position[2],lowZ-.001,lowZ+chunk.size+.001)||
      !finite(object.rotationY,0,Math.PI*2+.0001)||!finite(object.scale,.65,1.75))
    throw Error('Invalid ERAS object');
   ids.add(object.id);
   const copy={id:object.id,type:object.type,position:[...object.position],rotationY:object.rotationY,scale:object.scale};
   if(ids.size>2000)throw Error('ERAS object budget exceeded');
   if(!acceptObject||acceptObject(copy))objects.push(copy);
  }
 }
 return objects;
}

/** Create bounded procedural placeholders. No asset loading, terrain or renderer.
 * The caller owns the returned group and must call dispose when finished. */
export function createErasManifestThree(manifest,{acceptObject}={}){
 if(acceptObject!==undefined&&typeof acceptObject!=='function')throw Error('Invalid host filter');
 const objects=readManifest(manifest,acceptObject);
 const group=new THREE.Group(),geometries=new Set(),materials=new Set();
 group.name='eras-manifest-world';
 let disposed=false;
 function dispose(){
  if(disposed)return;disposed=true;group.removeFromParent();
  group.traverse(object=>{if(object.isInstancedMesh)object.dispose();});group.clear();
  for(const geometry of geometries)geometry.dispose();
  for(const material of materials)material.dispose();
  geometries.clear();materials.clear();
 }
 try{
  const dummy=new THREE.Object3D();
  function instances(type,name,geometry,material,offset,shape){
   const entries=objects.filter(object=>object.type===type);if(!entries.length)return;
   const mesh=new THREE.InstancedMesh(geometry,material,entries.length);mesh.name=name;group.add(mesh);
   for(const [index,object] of entries.entries()){
    const [x,y,z]=object.position,s=object.scale;
    dummy.position.set(x,y+offset*s,z);dummy.rotation.set(0,object.rotationY,0);dummy.scale.set(shape[0]*s,shape[1]*s,shape[2]*s);dummy.updateMatrix();
    mesh.setMatrixAt(index,dummy.matrix);
   }
   mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;
  }
  const trees=objects.some(object=>object.type==='tree'),rocks=objects.some(object=>object.type==='rock');
  if(trees){
   const trunk=new THREE.CylinderGeometry(.12,.18,2.2,14);geometries.add(trunk);
   const crown=new THREE.SphereGeometry(1.2,14,10);geometries.add(crown);
   const wood=new THREE.MeshStandardMaterial({color:'#826044',roughness:.78});materials.add(wood);
   const leaves=new THREE.MeshStandardMaterial({color:'#506b55',roughness:.78});materials.add(leaves);
   instances('tree','eras-trees-trunks',trunk,wood,1,[1,1,1]);
   instances('tree','eras-trees-crowns',crown,leaves,3,[1,1.45,1]);
  }
  if(rocks){
   const geometry=new THREE.DodecahedronGeometry(1,0);geometries.add(geometry);
   const material=new THREE.MeshStandardMaterial({color:'#a9aaa0',roughness:.78});materials.add(material);
   instances('rock','eras-rocks',geometry,material,.45,[1,.45,.8]);
  }
  return {group,objectCount:objects.length,dispose};
 }catch(error){dispose();throw error;}
}
