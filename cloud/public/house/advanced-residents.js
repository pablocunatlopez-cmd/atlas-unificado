import * as THREE from './vendor/three.module.js';
import {roomAt} from './layout.js';

const BASE='/house/assets/models/avatar/';
const palette=['#497f79','#a96d51','#657690','#9a8558','#7b6d90'];
const maleIds=new Set(['language-object','cinema-audience-1','cinema-audience-5']);
const sexFor=id=>maleIds.has(id)?'male':'female';
const materialList=mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material];

// Every clone keeps a distinct bone graph. Geometry belongs to its loaded
// template and remains shared; it must not be disposed when a resident leaves.
export function cloneSkinnedTemplate(source){
 const clone=source.clone(true),map=new Map(),skeletons=new Map();
 function pair(a,b){map.set(a,b);for(let i=0;i<a.children.length;i++)pair(a.children[i],b.children[i]);}pair(source,clone);
 source.traverse(original=>{if(!original.isSkinnedMesh)return;const mesh=map.get(original);if(!skeletons.has(original.skeleton)){const skeleton=original.skeleton.clone();skeleton.bones=original.skeleton.bones.map(b=>map.get(b));if(skeleton.bones.some(b=>!b))throw Error('El esqueleto sale de la plantilla.');skeletons.set(original.skeleton,skeleton);}mesh.skeleton=skeletons.get(original.skeleton);mesh.bind(mesh.skeleton,original.bindMatrix);mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;});
 return clone;
}

// This is the same clothing-coverage rule as ERAS: keep original surface UVs
// and weights, draw exposed skin only, once per shared template.
function maskCoveredSkin(mesh){
 const g=mesh.geometry,index=g.index?.array;if(!index)return;const joints=g.attributes.skinIndex,weights=g.attributes.skinWeight;
 const exposed=mesh.skeleton.bones.map(b=>/^(head|neck|wrist|finger|metacarpal|eye|orbic|jaw|special|temporalis|levator|risor|bucc|tongue|oculi|oris)/.test(b.userData.anatomyBone||b.name));
 const visible=i=>{let n=0;for(let k=0;k<4;k++)if(exposed[joints.getComponent(i,k)])n+=weights.getComponent(i,k);return n>.18;};
 const keep=[],hidden=[];for(let i=0;i<index.length;i+=3){const tri=[index[i],index[i+1],index[i+2]];(tri.some(visible)?keep:hidden).push(...tri);}g.setIndex([...keep,...hidden]);g.setDrawRange(0,keep.length);
}
function disposeTemplate(bundle){
 const geometry=new Set(),materials=new Set();bundle.scene.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)for(const m of materialList(o))materials.add(m);});
 for(const g of geometry)g.dispose();for(const m of materials)m.dispose();for(const t of Object.values(bundle.textures||{}))t.dispose();
}

async function defaultAssets(sex){
 const [{GLTFLoader},motion]=await Promise.all([import('./vendor/GLTFLoader.js'),import('./motion-player.js')]);
 const textures={},completed=[];let model;
 const texture=async(name,color=true)=>{const t=await new THREE.TextureLoader().loadAsync(BASE+name);completed.push(t);t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.flipY=true;return t;};
 const jobs=[
  new GLTFLoader().loadAsync(BASE+sex+'.glb').then(g=>{model=g;return g;}),
  motion.loadMotionLibrary(),
  ...Object.entries({skin:[sex+'-skin.png',true],normal:[sex+'-normal.webp',false],roughness:[sex+'-roughness.webp',false],hair:[sex==='male'?'short02.png':'braid01.png',true],eyes:['eyes.png',true],eyebrows:['eyebrows.png',true],eyelashes:['eyelashes.png',true]}).map(async([key,[path,color]])=>{textures[key]=await texture(path,color);})
 ];
 const results=await Promise.allSettled(jobs),failed=results.find(r=>r.status==='rejected');
 if(failed){for(const t of completed)t.dispose();if(model)disposeTemplate({scene:model.scene,textures:{}});throw Error('No se pudo preparar el personaje; se conserva la figura ligera.');}
 const library=results[1].value;
 for(const clip of ['Idle_Loop','Walk_Loop','Interact'])if(!library.clips[clip]){disposeTemplate({scene:model.scene,textures});throw Error('Falta una animación de la biblioteca.');}
 model.scene.traverse(mesh=>{if(mesh.isSkinnedMesh&&mesh.userData.anatomyPart==='skin')maskCoveredSkin(mesh);});
 return{scene:model.scene,height:model.asset?.extras?.height||1.84,textures,motion:library,sample:motion.sampleMotion};
}

export function selectAdvancedResidents(candidates,camera,{limit=2,range=8}={}){
 if(!camera?.position||camera.position.y>3.2||camera.position.y<.3)return[];
 const room=roomAt(camera.position.x,camera.position.z);if(!room)return[];
 return candidates.filter(c=>c.archetype==='human'&&!c.seated&&roomAt(c.position[0],c.position[2])===room).map(c=>({id:c.id,distance:Math.hypot(camera.position.x-c.position[0],camera.position.z-c.position[2])})).filter(c=>c.distance<=range).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id)).slice(0,Math.max(0,Math.min(2,limit))).map(c=>c.id);
}
function initialDetail(){
 if(typeof window==='undefined')return false;
 try{if(new URLSearchParams(location.search).get('people')==='light'||localStorage.getItem('atlas-people-detail')==='light'||navigator.connection?.saveData)return false;}catch{}
 return true;
}

export function createAdvancedResidents(parent,{enabled=initialDetail(),limit=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches?1:2,reducedMotion=false,loadAssets=defaultAssets}={}){
 const deviceLimit=Math.max(0,Math.min(2,Number.isInteger(limit)?limit:2));limit=deviceLimit;
 const root=new THREE.Group();root.name='atlas-advanced-residents';parent.add(root);
 const templates=new Map(),pending=new Map(),failed=new Set(),actors=new Map();let disposed=false,selected=new Set();
 function removeActor(id){const a=actors.get(id);if(!a)return;a.root.removeFromParent();for(const m of a.materials)m.dispose();for(const s of a.skeletons)s.dispose();actors.delete(id);}
 function request(sex){
  if(disposed||templates.has(sex)||pending.has(sex)||failed.has(sex))return;
  const promise=Promise.resolve().then(()=>loadAssets(sex)).then(bundle=>{if(disposed){disposeTemplate(bundle);return;}templates.set(sex,bundle);}).catch(()=>{failed.add(sex);}).finally(()=>pending.delete(sex));pending.set(sex,promise);
 }
 function build(id,index){
  const sex=sexFor(id),bundle=templates.get(sex);if(!bundle)return null;
  const rig=cloneSkinnedTemplate(bundle.scene),holder=new THREE.Group();holder.name='advanced-'+id;holder.userData={residentId:id,anatomy:'MakeHuman CC0',source:'ERAS',scripted:true};holder.add(rig);
  const t=bundle.textures,materials={
   skin:new THREE.MeshStandardMaterial({map:t.skin,normalMap:t.normal,roughnessMap:t.roughness,normalScale:new THREE.Vector2(.48,.48),color:'#f3e3d7',roughness:.76}),
   tunic:new THREE.MeshStandardMaterial({color:palette[index%palette.length],roughness:.88}),trousers:new THREE.MeshStandardMaterial({color:'#46545c',roughness:.9}),boots:new THREE.MeshStandardMaterial({color:'#243d43',roughness:.85}),
   hair:new THREE.MeshStandardMaterial({map:t.hair,color:'#938b7d',alphaTest:.28,side:THREE.DoubleSide,roughness:.76}),eyes:new THREE.MeshStandardMaterial({map:t.eyes,color:'#f3f0e8',roughness:.25}),
   eyebrows:new THREE.MeshStandardMaterial({map:t.eyebrows,color:'#b49b88',alphaTest:.02,transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide,roughness:.9}),eyelashes:new THREE.MeshStandardMaterial({map:t.eyelashes,color:'#8a7b6d',alphaTest:.08,transparent:true,depthWrite:false,side:THREE.DoubleSide,roughness:.9})
  };
  const bones={},skeletons=new Set();let ground=0;
  rig.traverse(o=>{if(o.userData.anatomyBone)bones[o.userData.anatomyBone]=o;if(!o.isSkinnedMesh)return;const part=o.userData.anatomyPart||o.name;o.visible=!['mantle','cuirass','hem','belt',sex==='male'?'hair_long':'hair_short'].includes(part);o.material=part.startsWith('hair_')?materials.hair:materials[part]||materials.tunic;if(part==='boots'){o.geometry.computeBoundingBox();ground=-o.geometry.boundingBox.min.y;}skeletons.add(o.skeleton);});
  const scale=1.65/bundle.height;rig.scale.setScalar(scale);rig.position.y=.04+ground*scale;holder.userData.height=1.65;
  const pose={quaternions:bundle.motion.bones.map(()=>new THREE.Quaternion()),pelvis:0};
  const a={root:holder,rig,bones,skeletons,materials:new Set(Object.values(materials)),bundle,pose,sex,baseY:rig.position.y,lastClip:null};root.add(holder);actors.set(id,a);return a;
 }
 return{
  setBudget(value){if(Number.isInteger(value))limit=Math.max(0,Math.min(deviceLimit,value));},
  setEnabled(value){enabled=value===true;if(!enabled){selected.clear();for(const id of [...actors.keys()])removeActor(id);}},
  prepare(camera,candidates){
   if(disposed)return;selected=new Set(enabled?selectAdvancedResidents(candidates,camera,{limit}):[]);
   for(const id of [...actors.keys()])if(!selected.has(id))removeActor(id);
   for(const id of selected){const sex=sexFor(id);request(sex);if(templates.has(sex)&&!failed.has(sex)&&!actors.has(id)){try{build(id,candidates.findIndex(c=>c.id===id));}catch{failed.add(sex);}}}
   root.userData={enabled,selected:[...selected],active:[...actors.keys()],loading:[...pending.keys()],failed:[...failed],limit:Math.min(2,limit),source:'ERAS CC0',weightsChanged:false};
  },
  update(actor,{position,yaw,moving=false,working=false,time=0}={}){
   const a=actors.get(actor.id);if(disposed||!enabled||!selected.has(actor.id)||!a)return false;
   const clip=reducedMotion?'Idle_Loop':moving?'Walk_Loop':working?'Interact':'Idle_Loop',motion=a.bundle.motion.clips[clip];
   const phase=reducedMotion?0:(time/motion.duration)%1;a.bundle.sample(a.bundle.motion,a.sex,clip,phase,a.pose,clip!=='Interact');
   for(let i=0;i<a.bundle.motion.bones.length;i++){const bone=a.bones[a.bundle.motion.bones[i]];if(bone)bone.quaternion.copy(a.pose.quaternions[i]);}
   a.rig.position.y=a.baseY+(reducedMotion?0:a.pose.pelvis*a.rig.scale.y);a.root.position.fromArray(position||actor.position);a.root.rotation.y=Math.PI-(Number.isFinite(yaw)?yaw:actor.yaw);a.root.visible=true;a.root.userData.clip=clip;a.lastClip=clip;a.root.updateMatrixWorld(true);return true;
  },
  status(){return{...root.userData,enabled,selected:[...selected],active:[...actors.keys()],loading:[...pending.keys()],failed:[...failed],limit:Math.min(2,limit)};},
  dispose(){if(disposed)return;disposed=true;selected.clear();for(const id of [...actors.keys()])removeActor(id);for(const bundle of templates.values())disposeTemplate(bundle);templates.clear();root.removeFromParent();}
 };
}
