import * as THREE from './vendor/three.module.js';

const PREFIX='atlas-house-evolution';
const SCOPE='Plan de Qwen incorporado como geometría acotada en la casa. Los seis contratos son geométricos; su presencia no demuestra mejora visual, aprendizaje ni cambios de pesos.';
const VARIANTS=new Set(['gallery','product','architecture','forest','neon']);
const LIGHTS=new Set(['day','sunset','night']);
const PALETTES=Object.freeze({Titanio:[.56,.60,.64],Oro:[.83,.57,.22],Azul:[.045,.18,.70],Rojo:[.65,.055,.045],Verde:[.08,.30,.18],Rosa:[.65,.08,.42],Blanco:[.88,.87,.82],Negro:[.055,.06,.065]});
const PLACEMENTS=Object.freeze([
 Object.freeze({id:'maquette',anchor:[7.5,.94,6.5],volume:[2.05,1.15,1.3]}),
 Object.freeze({id:'terrace',anchor:[7.8,.2,10.35],volume:[6,2.4,2.3]})
]);
const finite=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const vector=(value,min,max)=>Array.isArray(value)&&value.length===3&&[0,1,2].every(index=>Object.hasOwn(value,index)&&finite(value[index],min,max));
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const own=(value,key)=>Object.hasOwn(value,key);

function iso(value){
 if(typeof value!=='string'||value.length>35)return null;
 const parts=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
 if(!parts||Number(parts[4])>23||Number(parts[5])>59||Number(parts[6])>59)return null;
 const calendar=new Date(parts[1]+'-'+parts[2]+'-'+parts[3]+'T00:00:00.000Z');
 if(!Number.isFinite(calendar.getTime())||calendar.toISOString().slice(0,10)!==parts.slice(1,4).join('-'))return null;
 const stamp=Date.parse(value);return Number.isFinite(stamp)?new Date(stamp).toISOString():null;
}
function extents(object){
 const c=Math.abs(Math.cos(object.yaw)),s=Math.abs(Math.sin(object.yaw));
 return [c*object.size[0]+s*object.size[2],object.size[1],s*object.size[0]+c*object.size[2]];
}
function descriptor(value){
 if(!record(value)||value.executed!==true||value.invariantsPreserved!==true||value.cases!==6||value.passed!==6||value.renderVerified!==false||typeof value.artifactId!=='string'||!/^creative-[a-f0-9]{24}$/.test(value.artifactId))return null;
 const at=iso(value.at);if(!at)return null;
 if(value.evidenceHash!==undefined&&value.evidenceHash!==null&&(typeof value.evidenceHash!=='string'||!/^[a-f0-9]{64}$/.test(value.evidenceHash)))return null;
 const plan=value.plan;
 if(!record(plan)||plan.version!==1||!VARIANTS.has(plan.variant)||!LIGHTS.has(plan.lighting)||typeof plan.palette!=='string'||!own(PALETTES,plan.palette)||!Array.isArray(plan.objects)||plan.objects.length<1||plan.objects.length>8)return null;
 const objects=[],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const raw of plan.objects){
  if(!record(raw)||!['box','sphere'].includes(raw.type)||!vector(raw.position,-24,24)||!vector(raw.size,.1,3)||!Number.isInteger(raw.material)||raw.material<0||raw.material>11||!finite(raw.yaw??0,-Math.PI,Math.PI)||raw.position[1]>8)return null;
  const object={type:raw.type,position:[...raw.position],size:[...raw.size],material:raw.material,yaw:raw.yaw??0},half=extents(object);
  if(object.position[1]-half[1]<-1e-7||half.some((radius,index)=>Math.abs(object.position[index])+radius>32))return null;
  for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],object.position[axis]-half[axis]);max[axis]=Math.max(max[axis],object.position[axis]+half[axis]);}
  objects.push(object);
 }
 const span=max.map((value,index)=>value-min[index]);
 if(!span.every(value=>finite(value,.199999,64)))return null;
 const centerX=(min[0]+max[0])/2,centerZ=(min[2]+max[2])/2;
 const installations=PLACEMENTS.map(({id,anchor,volume})=>{
  const scale=Math.min(...volume.map((value,index)=>value/span[index]));
  return {id,anchor:[...anchor],volume:[...volume],scale,objects:objects.map(object=>({...object,position:[anchor[0]+(object.position[0]-centerX)*scale,anchor[1]+(object.position[1]-min[1])*scale,anchor[2]+(object.position[2]-centerZ)*scale],size:object.size.map(value=>value*scale)}))};
 });
 // Do not trust an external evidence hash as the geometry cache key. Only
 // whitelisted visible data participates, never titles, design or source text.
 const signature=JSON.stringify({palette:plan.palette,objects});
 return {artifactId:value.artifactId,at,evidenceHash:value.evidenceHash??null,palette:plan.palette,objects,bounds:{min,max,span},installations,signature};
}

/** Pure, bounded public-data adapter. No renderer, network, DOM or model code. */
export function describeCreativeInstallation(value){try{return descriptor(value);}catch{return null;}}

function materialParameters(index,palette){
 const table=[
  [[.63,.61,.56],.45,.08,0],[[.82,.80,.75],.30,.12,0],
  [PALETTES[palette],.20,.78,0],[[.15,.20,.15],.58,.05,0],
  [[.18,.105,.06],.50,.08,0],[[.85,.55,.12],.20,.83,0],
  [[.93,.86,.66],.30,.10,.30],[[.36,.05,.25],.25,.30,.65],
  [[.025,.03,.035],.30,.25,0],[[.45,.48,.52],.20,.90,0],
  [[.75,.31,.13],.40,.05,0],[[.15,.42,.59],.25,.45,0]
 ];
 const [rgb,roughness,metalness,emission]=table[index],color=new THREE.Color(...rgb);
 return {color,roughness,metalness,...(emission?{emissive:color.clone(),emissiveIntensity:emission}:{})};
}
function makeContent(description){
 const group=new THREE.Group();group.name=PREFIX+'-content';
 const geometries=new Set(),materials=new Set();
 const retainGeometry=value=>{geometries.add(value);return value;},retainMaterial=value=>{materials.add(value);return value;};
 function dispose(){for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();geometries.clear();materials.clear();group.clear();}
 try{
  const box=retainGeometry(new THREE.BoxGeometry(2,2,2)),sphere=retainGeometry(new THREE.SphereGeometry(1,16,10));
  const sources=new Map();
  const sourceMaterial=index=>{if(!sources.has(index))sources.set(index,retainMaterial(new THREE.MeshStandardMaterial(materialParameters(index,description.palette))));return sources.get(index);};
  const baseMaterial=retainMaterial(new THREE.MeshStandardMaterial({color:'#d6d5c8',roughness:.38,metalness:.12}));
  const frameMaterial=retainMaterial(new THREE.MeshStandardMaterial({color:'#315553',roughness:.27,metalness:.58}));
  const outlineMaterial=retainMaterial(new THREE.LineBasicMaterial({color:'#add6c7',transparent:true,opacity:.8,toneMapped:false}));
  function fixture(parent,name,material,position,half){
   const mesh=new THREE.Mesh(box,material);mesh.name=PREFIX+'-'+name;mesh.position.set(...position);mesh.scale.set(...half);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.sourceKind='fixed-frame';parent.add(mesh);return mesh;
  }
  for(const installation of description.installations){
   const part=new THREE.Group();part.name=PREFIX+'-'+installation.id;part.userData.installation=installation.id;group.add(part);
   for(const [index,object] of installation.objects.entries()){
    const mesh=new THREE.Mesh(object.type==='box'?box:sphere,sourceMaterial(object.material));mesh.name=PREFIX+'-'+installation.id+'-object-'+index;
    mesh.position.set(...object.position);mesh.rotation.y=object.yaw;mesh.scale.set(...object.size);mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.userData.sourceKind='qwen-plan';mesh.userData.sourceIndex=index;mesh.userData.sourceType=object.type;mesh.userData.materialIndex=object.material;part.add(mesh);
   }
   if(installation.id==='maquette')fixture(part,'maquette-base',baseMaterial,[7.5,.915,6.5],[1.09,.025,.70]);
   else{
    // A fixed plinth and rear frame make the intervention part of the house.
    // They stay east of the entry corridor and never alter walls or navigation.
    const base=fixture(part,'terrace-base',baseMaterial,[7.8,.14,10.35],[3.18,.06,1.3]);
    const edges=retainGeometry(new THREE.EdgesGeometry(box));
    const outline=new THREE.LineSegments(edges,outlineMaterial);outline.name=PREFIX+'-terrace-outline';outline.position.copy(base.position);outline.scale.copy(base.scale);outline.userData.sourceKind='fixed-frame';part.add(outline);
    for(const [index,x] of [4.62,10.98].entries())fixture(part,'terrace-pillar-'+index,frameMaterial,[x,1.52,8.98],[.055,1.32,.055]);
    fixture(part,'terrace-header',frameMaterial,[7.8,2.84,8.98],[3.235,.055,.055]);
   }
  }
  group.updateMatrixWorld(true);
  return {group,dispose};
 }catch(error){dispose();throw error;}
}

/** Two house installations, one real public source. Updates are transactional;
 * malformed/null/offline packets never remove the previous accepted geometry. */
export function createCreativeInstallation(scene){
 if(!scene?.isObject3D||typeof scene.add!=='function')throw new TypeError('Se requiere una escena Three.js.');
 const root=new THREE.Group();root.name=PREFIX;scene.add(root);
 let content=null,signature=null,disposed=false;
 let metadata={applied:false,artifactId:null,at:null,evidenceHash:null,objects:0,cases:0,passed:0,instances:0,renderVerified:false,learningChange:false,scope:SCOPE};
 const status=()=>({...metadata,disposed});
 function provenance(description){
  metadata={applied:true,artifactId:description.artifactId,at:description.at,evidenceHash:description.evidenceHash,objects:description.objects.length,cases:6,passed:6,instances:2,renderVerified:false,learningChange:false,scope:SCOPE};
  root.userData={artifactId:description.artifactId,at:description.at,evidenceHash:description.evidenceHash,sourceKind:'bounded-public-creative-plan',renderVerified:false,learningChange:false};
 }
 function setState(value){
  if(disposed)return {accepted:false,updated:false,...status()};
  const description=describeCreativeInstallation(value);
  if(!description)return {accepted:false,updated:false,...status()};
  // Bootstrap and heartbeat deliveries may arrive out of order. Preserve the
  // latest adopted source; equal timestamps keep incoming-order tie breaking.
  if(metadata.applied&&Date.parse(description.at)<Date.parse(metadata.at))return {accepted:false,updated:false,...status()};
  if(content&&signature===description.signature){provenance(description);return {accepted:true,updated:false,...status()};}
  let next;try{next=makeContent(description);}catch{return {accepted:false,updated:false,...status()};}
  // All validation and resource construction completed before the old revision
  // is detached. No half-built plan is ever visible in the live scene.
  const previous=content;root.add(next.group);if(previous)root.remove(previous.group);
  content=next;signature=description.signature;provenance(description);previous?.dispose();
  return {accepted:true,updated:true,...status()};
 }
 function dispose(){
  if(disposed)return;disposed=true;content?.dispose();content=null;signature=null;root.removeFromParent();root.clear();root.userData={};
  metadata={...metadata,applied:false,objects:0,cases:0,passed:0,instances:0};
 }
 return {setState,status,dispose};
}
