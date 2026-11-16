/**
 * Optional Atlas philosophy layer inside the existing ERAS Three.js scene.
 * This is illustrative geometry, not verified fidelity to original images.
 */
export function createAtlasSpiralLayer({THREE,scene}={}){
 if(!THREE?.Group||!THREE?.Vector3||!scene?.add||!scene?.remove)
  throw Error('Existing Three.js scene required');
 const group=new THREE.Group();
 group.name='atlas-canonical-spiral';
 group.visible=false;
 const materials=[],geometries=[],vertexMeshes=[];
 function line(points,color){
  const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
  const material=new THREE.LineBasicMaterial({color});
  geometries.push(geometry);materials.push(material);
  group.add(new THREE.Line(geometry,material));
 }
 const spiral=[];
 for(let i=0;i<144;i++){
  const t=i/143,angle=t*Math.PI*7,r=.3+t*7;
  spiral.push([Math.cos(angle)*r,1+t*4,Math.sin(angle)*r]);
 }
 line(spiral,0xb9c4d0);
 // Smaller open spirals echo the same historical trajectory at other scales.
 for(const scale of [.55,.27]){
  line(spiral.map(([x,y,z])=>[x*scale,y*scale+1.3,z*scale]),
   scale>.3?0x8e9bbd:0xc2a4ca);
 }
 const vertices=[
  {id:'mental',position:[-8,3,-5],color:0x7795d9},
  {id:'physical',position:[8,3,-5],color:0x8ec4a2},
  {id:'event',position:[0,3,9],color:0xe6c37a}
 ];
 for(const vertex of vertices){
  const geometry=new THREE.SphereGeometry(.7,16,12);
  const material=new THREE.MeshBasicMaterial({color:vertex.color});
  geometries.push(geometry);materials.push(material);
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='atlas-'+vertex.id;
  mesh.userData.atlasVertexId=vertex.id;
  vertexMeshes.push(mesh);
  mesh.position.set(...vertex.position);
  group.add(mesh);
  line([[0,3,0],vertex.position],0x677487);
 }
 let mounted=false,disposed=false;
 return Object.freeze({
  mount(){
   if(disposed)throw Error('Spiral layer disposed');
   if(mounted)return false;
   scene.add(group);mounted=true;return true;
  },
  show(){
   if(!mounted||disposed)throw Error('Spiral layer not mounted');
   group.visible=true;
  },
  hide(){group.visible=false;},
  pick({raycaster,camera,ndc}={}){
   if(!mounted||!group.visible||disposed)return null;
   if(!raycaster?.setFromCamera||!raycaster?.intersectObjects||!camera||
      !Array.isArray(ndc)||ndc.length!==2||ndc.some(v=>!Number.isFinite(v)||Math.abs(v)>1))
    throw Error('Invalid Atlas picking context');
   raycaster.setFromCamera({x:ndc[0],y:ndc[1]},camera);
   const hit=raycaster.intersectObjects(vertexMeshes,false)[0];
   return hit?.object?.userData?.atlasVertexId||null;
  },
  dispose(){
   if(disposed)return;
   group.visible=false;
   if(mounted)scene.remove(group);
   geometries.forEach(g=>g.dispose());
   materials.forEach(m=>m.dispose());
   disposed=true;mounted=false;
  },
  get visible(){return group.visible;},
  get mounted(){return mounted;},
  vertices:Object.freeze(vertices.map(v=>v.id)),
  rendererCreated:false,visualFidelityVerified:false
 });
}
