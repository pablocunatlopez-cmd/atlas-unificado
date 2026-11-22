/**
 * Optional Three.js runtime adapter. Caller injects a compatible THREE module,
 * a pre-created scene and a plan; nothing happens until mount() is called.
 * No animation loop, network request, autonomous code or repository mutation.
 */
export function createAtlasThreeViewport({THREE,scene,plan}={}){
 if(!THREE||!scene||typeof scene.add!=='function'||!plan||
    plan.renderer!=='threejs_compatible_descriptor'||
    plan.threeObjectsCreated!==false)throw Error('Invalid viewport dependencies');
 const objects=[];
 let mounted=false;
 function add(obj){scene.add(obj);objects.push(obj);return obj;}
 function mount(){
  if(mounted)throw Error('Viewport already mounted');
  const geometry=new THREE.BufferGeometry().setFromPoints(
   plan.spiral.points.map(p=>new THREE.Vector3(...p)));
  add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xb9c4d0})));
  const palette={mental:0x7795d9,physical:0x8ec4a2,event:0xe6c37a};
  for(const anchor of plan.anchors){
   const radius=anchor.id==='observer'?0.28:anchor.id==='spiral'?0.18:0.48;
   const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,16,12),
    new THREE.MeshBasicMaterial({color:palette[anchor.id]??0xaab4c2}));
   mesh.position.set(...anchor.position);
   mesh.userData.atlasNodeId=anchor.id;
   add(mesh);
  }
  for(const edge of plan.edges){
   const g=new THREE.BufferGeometry().setFromPoints(
    edge.points.map(p=>new THREE.Vector3(...p)));
   add(new THREE.Line(g,new THREE.LineBasicMaterial({color:0x5d6777})));
  }
  mounted=true;
  return Object.freeze({objectsAdded:objects.length,mode:'runtime_opt_in'});
 }
 function unmount(){
  for(const obj of objects.splice(0)){
   scene.remove(obj);
   obj.geometry?.dispose?.();
   if(Array.isArray(obj.material))obj.material.forEach(m=>m.dispose?.());
   else obj.material?.dispose?.();
  }
  mounted=false;
 }
 return Object.freeze({mount,unmount,get mounted(){return mounted;},
  get objectCount(){return objects.length;}});
}
