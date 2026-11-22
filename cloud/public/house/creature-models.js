import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {residentById} from './residents.js';
import {HOUSE_FUNCTIONS} from './functional-world.js';

const UP=new THREE.Vector3(0,1,0);
const ARCHETYPES=new Set(['animal','bird','robot']);
const robotColors={
 'music-mixer':'#8d625d',
 'games-desk':'#78869a',
 'cinema-projector':'#536977',
 'body-console':'#77958b',
 'body-arm':'#b58b5f',
 'refutation-control':'#afb4b3',
 'language-symbol':'#486e77',
 'cinema-audience-2':'#9b8d9e'
};
const animalColors={
 'lab-bench':['#a8522e','#704733','#d7c5ac','#393033'],
 'games-maquette':['#c18c50','#996737','#f3e2be','#634435'],
 'cinema-audience-4':['#6d6457','#584b41','#e0cab6','#4b3a37']
};
const birdColors={
 'sky-sources':['#b79663','#836f59','#ead9b6','#4e3b32'],
 'sky-agents':['#504859','#75647d','#baa6ab','#302630'],
 'cinema-audience-6':['#61777a','#7b9290','#d9dfc9','#3f5156']
};

const toVector=point=>new THREE.Vector3(...point);
const channel=(value,max)=>Number.isFinite(value)?THREE.MathUtils.clamp(value,-max,max):0;
const profile=(color,roughness,metalness=0,emission=0)=>({color,roughness,metalness,emission});

// A swept, tapered surface gives the joints, muzzles, tails and feathers
// continuous silhouettes. The frames use a consistent reference normal.
function sweptSurface(points,radii,{segments=12,length=13,flat=1,up=UP}={}){
 length=Math.max(points.length+2,Math.round(length*.75));
 const curve=new THREE.CatmullRomCurve3(points.map(toVector));
 const positions=[],indices=[],uvs=[];
 for(let row=0;row<=length;row++){
  const t=row/length,p=curve.getPoint(t),tangent=curve.getTangent(t).normalize();
  const normal=new THREE.Vector3().crossVectors(tangent,up);
  if(normal.lengthSq()<.0001)normal.crossVectors(tangent,new THREE.Vector3(1,0,0));
  normal.normalize();
  const binormal=new THREE.Vector3().crossVectors(tangent,normal).normalize();
  const offset=t*(radii.length-1),i=Math.min(radii.length-2,Math.floor(offset));
  const r=THREE.MathUtils.lerp(radii[i],radii[i+1],offset-i);
  for(let k=0;k<=segments;k++){
   const angle=k/segments*Math.PI*2;
   const v=p.clone().addScaledVector(normal,Math.cos(angle)*r).addScaledVector(binormal,Math.sin(angle)*r*flat);
   positions.push(v.x,v.y,v.z);
   uvs.push(k/segments,t);
   if(row>0&&k>0){
    const q=row*(segments+1)+k;
    indices.push(q-segments-2,q,q-1,q-segments-2,q-segments-1,q);
   }
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 // The duplicated UV seam uses the same surface normal on both edges.
 const normals=geometry.attributes.normal;
 for(let row=0;row<=length;row++){
  const a=row*(segments+1),b=a+segments;
  const n=new THREE.Vector3().fromBufferAttribute(normals,a).add(new THREE.Vector3().fromBufferAttribute(normals,b)).normalize();
  normals.setXYZ(a,n.x,n.y,n.z);
  normals.setXYZ(b,n.x,n.y,n.z);
 }
 return geometry;
}

function sculptedForm(size,center,{roll=0,pitch=0,yaw=0,waist=0,square=0,segments=16,rings=10}={}){
 const geometry=new THREE.SphereGeometry(1,segments,rings),positions=geometry.attributes.position;
 for(let i=0;i<positions.count;i++){
  let x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
  if(square){
   const exponent=1-square;
   x=Math.sign(x)*Math.abs(x)**exponent;
   y=Math.sign(y)*Math.abs(y)**exponent;
   z=Math.sign(z)*Math.abs(z)**exponent;
  }
  const taper=1+waist*y;
  positions.setXYZ(i,size[0]*x*taper,size[1]*y,size[2]*z*taper);
 }
 if(pitch)geometry.rotateX(pitch);
 if(yaw)geometry.rotateY(yaw);
 if(roll)geometry.rotateZ(roll);
 geometry.translate(...center);
 geometry.computeVertexNormals();
 return geometry;
}

class CharacterSculpt {
 constructor(){
  this.root=new THREE.Bone();
  this.root.name='root';
  this.root.userData.index=0;
  this.bones=[this.root];
  this.parts=[];
 }
 joint(name,point,parent=this.root){
  const bone=new THREE.Bone();
  bone.name=name;
  bone.position.fromArray(point);
  bone.userData.index=this.bones.length;
  this.bones.push(bone);
  parent.add(bone);
  return bone;
 }
 add(bone,geometry,surface,shade){
  this.root.updateMatrixWorld(true);
  geometry.applyMatrix4(bone.matrixWorld);
  const position=geometry.attributes.position,count=position.count;
  const colors=new Float32Array(count*3),responses=new Float32Array(count*3),joints=new Uint16Array(count*4),weights=new Float32Array(count*4);
  const color=new THREE.Color(surface.color),variant=new THREE.Color();
  for(let i=0;i<count;i++){
   variant.copy(color);
   if(shade)shade(variant,position.getX(i),position.getY(i),position.getZ(i));
   colors.set([variant.r,variant.g,variant.b],i*3);
   responses.set([surface.roughness,surface.metalness,surface.emission],i*3);
   joints[i*4]=bone.userData.index;
   weights[i*4]=1;
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.setAttribute('skinIndex',new THREE.BufferAttribute(joints,4));
  geometry.setAttribute('skinWeight',new THREE.BufferAttribute(weights,4));
  geometry.setAttribute('surfaceResponse',new THREE.BufferAttribute(responses,3));
  this.parts.push(geometry);
 }
 form(bone,dimensions,center,surface,options,shade){
  this.add(bone,sculptedForm(dimensions,center,options),surface,shade);
 }
 sweep(bone,points,radii,surface,options,shade){
  this.add(bone,sweptSurface(points,radii,options),surface,shade);
 }
 ring(bone,radius,tube,center,surface,turn=0){
  const geometry=new THREE.TorusGeometry(radius,tube,6,20);
  geometry.rotateY(turn);
  geometry.translate(...center);
  this.add(bone,geometry,surface);
 }
 finish(material){
  const geometry=mergeGeometries(this.parts);
  for(const part of this.parts)part.dispose();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const mesh=new THREE.SkinnedMesh(geometry,material);
  mesh.add(this.root);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(this.bones));
  // A conservative sphere covers the seated bend, tail and wings after posing.
  mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.8,0),1.45);
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  return mesh;
 }
}

function robot(sculpt,id){
 const root=sculpt.root;
 const shell=profile(robotColors[id]||'#789492',.36,.57);
 const edge=profile('#b5c5c6',.25,.86),joint=profile('#293640',.57,.37),seal=profile('#202d33',.74);
 const glass=profile('#161f29',.095,.31),teal=profile(id==='language-symbol'?'#8bdaf3':'#a5e0d2',.23,.22,1);
 const torso=sculpt.joint('torso',[0,.92,0]);
 const head=sculpt.joint('head',[0,.47,0],torso);
 sculpt.form(torso,[.228,.259,.141],[0,.14,0],shell,{square:.23,waist:.23});
 sculpt.form(torso,[.186,.144,.049],[0,.172,.126],edge,{square:.15});
 sculpt.form(torso,[.176,.133,.049],[0,.170,.138],shell,{square:.13});
 sculpt.form(torso,[.116,.040,.020],[0,.133,.177],glass,{square:.30});
 sculpt.form(torso,[.065,.009,.010],[0,.138,.194],teal,{square:.20});
 for(const side of [-1,1])for(let y=0;y<4;y++){
  sculpt.sweep(torso,[[side*.125,.034+y*.024,.121],[side*.175,.028+y*.024,.104]], [.001,.005,.001],joint,{segments:6,length:4});
 }
 sculpt.form(root,[.160,.114,.115],[0,.817,0],shell,{square:.18,waist:.13});
 sculpt.form(torso,[.081,.067,.076],[0,-.055,0],seal,{});
 sculpt.form(head,[.152,.119,.134],[0,.056,0],shell,{square:.24,waist:-.12});
 sculpt.form(head,[.136,.069,.059],[0,.053,.101],glass,{square:.16,waist:.06});
 sculpt.form(head,[.107,.020,.034],[0,.049,.135],joint,{square:.17});
 for(const side of [-1,1]){
  sculpt.form(head,[.044,.008,.015],[side*.052,.053,.160],teal,{square:.25});
  sculpt.form(head,[.025,.059,.062],[side*.149,.051,-.007],joint,{square:.2});
  sculpt.ring(head,.043,.006,[side*.165,.051,-.007],edge,Math.PI/2);
  if(id==='cinema-projector'||id==='language-symbol'){
   sculpt.ring(head,.035,.005,[side*.05,.053,.16],edge);
   sculpt.form(head,[.028,.027,.016],[side*.05,.053,.16],glass,{});
  }
  const sideName=side<0?'Left':'Right';
  const arm=sculpt.joint('arm'+sideName,[side*.237,.296,.006],torso);
  const forearm=sculpt.joint('forearm'+sideName,[side*.040,-.237,.004],arm);
  const thigh=sculpt.joint('thigh'+sideName,[side*.102,.777,.004]);
  const shin=sculpt.joint('shin'+sideName,[0,-.347,0],thigh);
  const foot=sculpt.joint('foot'+sideName,[0,-.307,0],shin);
  sculpt.form(arm,[.080,.097,.092],[0,-.025,0],edge,{square:.14});
  sculpt.form(arm,[.077,.103,.092],[side*.013,-.044,0],shell,{square:.18});
  sculpt.sweep(arm,[[0,-.025,0],[side*.019,-.123,0],[side*.039,-.222,0]],[.043,.065,.036],shell,{length:12});
  sculpt.form(forearm,[.058,.059,.063],[0,0,0],joint,{});
  sculpt.sweep(forearm,[[0,-.013,0],[side*.012,-.082,.009],[side*.013,-.170,.014]],[.040,.072,.042],shell,{length:11,flat:.92});
  sculpt.form(forearm,[.044,.049,.047],[side*.013,-.195,.018],edge,{square:.19});
  for(let finger=0;finger<3;finger++){
   const x=side*.013+(finger-1)*.026;
   sculpt.sweep(forearm,[[x,-.205,.017],[x,-.244,.022],[x,-.247,.049]],[.015,.013,.006],joint,{segments:8,length:8});
  }
  sculpt.sweep(thigh,[[0,0,0],[0,-.14,.006],[0,-.335,.012]],[.080,.099,.060],shell,{length:13,flat:.96});
  sculpt.form(shin,[.070,.068,.076],[0,0,.014],joint,{});
  sculpt.form(shin,[.053,.059,.026],[0,0,.067],edge,{square:.12});
  sculpt.sweep(shin,[[0,-.028,.006],[0,-.13,.003],[0,-.295,0]],[.063,.076,.045],shell,{length:13});
  sculpt.form(foot,[.080,.056,.132],[0,-.061,.061],seal,{square:.34,waist:.16});
  sculpt.form(foot,[.071,.057,.110],[0,-.038,.068],shell,{square:.29});
 }
 const lens=id==='cinema-projector'?profile('#7194b1',.11,.35):teal;
 if(id==='cinema-projector'||id==='body-arm'){
  sculpt.ring(torso,.045,.006,[0,.231,.174],edge);
  sculpt.form(torso,[.041,.041,.020],[0,.231,.174],lens,{});
 }
}

function animal(sculpt,id){
 const root=sculpt.root,[main,back,cream,dark]=animalColors[id]||animalColors['lab-bench'];
 const fur=profile(main,.89),crest=profile(back,.86),throat=profile(cream,.91),feet=profile(dark,.93);
 const eye=profile('#241d1a',.14),iris=profile('#a26b37',.26),nose=profile('#3b2b29',.43);
 const darkColor=new THREE.Color(back),lightColor=new THREE.Color(cream);
 const head=sculpt.joint('head',[0,.67,.307]);
 const tail=sculpt.joint('tail',[0,.56,-.305]);
 sculpt.form(root,[.184,.213,.378],[0,.537,-.020],fur,{waist:-.14},(c,x,y,z)=>{
  c.lerp(y>.52?darkColor:lightColor,Math.min(.76,Math.abs(y-.52)*2.7));
  c.multiplyScalar(.975+Math.sin(339*x+187*z+41*y)*.025);
 });
 sculpt.form(root,[.155,.166,.159],[0,.570,.253],throat,{pitch:-.22,waist:.14});
 sculpt.sweep(head,[[0,-.05,-.11],[0,.046,-.025],[0,.032,.12],[0,-.008,.244]],[.045,.126,.093,.019],fur,{length:20,flat:.77},(c,x,y)=>{if(y<.699)c.lerp(lightColor,.74);});
 sculpt.sweep(head,[[0,-.016,.084],[0,-.041,.165],[0,-.025,.233]],[.021,.061,.018],throat,{flat:.48,length:10});
 sculpt.form(head,[.038,.027,.028],[0,-.004,.240],nose,{});
 for(const side of [-1,1]){
  const ear=sculpt.joint(side<0?'earLeft':'earRight',[side*.09,.111,-.043],head);
  sculpt.sweep(ear,[[0,-.02,.003],[side*.018,.047,-.008],[side*.045,.14,-.026]],[.050,.045,.002],crest,{flat:.52,up:new THREE.Vector3(0,0,1),length:10});
  sculpt.sweep(ear,[[0,-.013,.026],[side*.013,.028,.023],[side*.035,.114,-.002]],[.026,.028,.001],throat,{flat:.33,up:new THREE.Vector3(0,0,1),length:9});
  sculpt.form(head,[.032,.023,.014],[side*.089,.052,.101],feet,{yaw:side*.41,pitch:.26});
  sculpt.form(head,[.020,.015,.010],[side*.092,.051,.113],iris,{yaw:side*.41});
  sculpt.form(head,[.007,.013,.006],[side*.096,.052,.122],eye,{yaw:side*.40});
  sculpt.form(head,[.012,.010,.013],[side*.033,-.009,.25],nose,{});
  for(let i=0;i<3;i++){
   const y=-.017-i*.009;
   sculpt.sweep(head,[[side*.037,y,.185],[side*(.080+i*.007),y-.007,.173],[side*(.123+i*.010),y-.015,.151]],[.0007,.0010,.00015],throat,{segments:5,length:4});
  }
  for(const front of [true,false]){
   const legName=(front?'front':'hind')+(side<0?'Left':'Right');
   const leg=sculpt.joint(legName,[side*.116,.51,front?.230:-.217]);
   const lower=sculpt.joint(legName+'Lower',[side*.015,-.244,front?-.013:-.064],leg);
   sculpt.sweep(leg,[[0,.065,0],[side*.008,-.077,front?-.016:-.012],[side*.014,-.235,front?-.010:-.060]],[.082,.068,.039],fur,{length:12});
   sculpt.sweep(lower,[[0,.020,0],[0,-.119,front?.010:.048],[0,-.22,.027]],[.043,.036,.030],feet,{segments:12,length:11});
   sculpt.form(lower,[.049,.036,.078],[0,-.235,.067],feet,{square:.19});
   for(let toe=-1;toe<=1;toe++)sculpt.form(lower,[.013,.011,.024],[toe*.024,-.243,.124],nose,{segments:10,rings:8});
  }
 }
 sculpt.sweep(tail,[[0,0,0],[.010,-.004,-.22],[.076,-.088,-.414],[.228,-.171,-.564],[.341,-.210,-.587]], [.031,.081,.108,.074,.0015],fur,{segments:18,length:26},(c,x,y,z)=>{
  if(z<-.70)c.lerp(lightColor,THREE.MathUtils.smoothstep(-z,.66,.81)*.96);
  c.multiplyScalar(.97+Math.sin(x*211+y*307+z*159)*.03);
 });
}

function bird(sculpt,id){
 const root=sculpt.root,[main,back,light,dark]=birdColors[id]||birdColors['sky-sources'];
 const feather=profile(main,.84),wing=profile(back,.86),belly=profile(light,.89),quill=profile(dark,.88);
 const beak=profile('#ae8257',.63),eye=profile('#1f1519',.19),iris=profile('#b7884b',.31),foot=profile('#7c6152',.77);
 const head=sculpt.joint('head',[0,.659,.146]);
 const tail=sculpt.joint('tail',[0,.381,-.166]);
 const low=new THREE.Color(light),deep=new THREE.Color(dark);
 sculpt.form(root,[.160,.254,.228],[0,.431,-.025],feather,{pitch:-.47,waist:.10},(c,x,y,z)=>{
  c.lerp(z<0?deep:low,Math.min(.79,Math.abs(z)*3.0));
  c.multiplyScalar(.973+Math.cos(235*x+172*y+106*z)*.027);
 });
 sculpt.form(root,[.147,.153,.128],[0,.578,.109],belly,{pitch:-.24},(c,x,y,z)=>{
  c.lerp(deep,Math.max(0,Math.sin(x*141-y*212))*Math.max(0,.17-z));
 });
 sculpt.form(head,[.116,.099,.115],[0,.026,.025],feather,{waist:-.14,square:.05});
 sculpt.sweep(head,[[0,.018,.102],[0,.008,.165],[0,-.014,.250],[0,-.038,.247]],[.041,.030,.010,.001],beak,{segments:14,length:12,flat:.61});
 for(const side of [-1,1]){
  sculpt.form(head,[.039,.027,.012],[side*.088,.035,.087],wing,{yaw:side*.88});
  sculpt.form(head,[.017,.016,.012],[side*.099,.036,.095],iris,{yaw:side*.85});
  sculpt.form(head,[.012,.014,.009],[side*.107,.037,.101],eye,{yaw:side*.90});
  sculpt.form(head,[.005,.004,.002],[side*.031,.006,.151],quill,{});
  const wingJoint=sculpt.joint(side<0?'wingLeft':'wingRight',[side*.121,.500,-.029]);
  sculpt.form(wingJoint,[.063,.160,.192],[side*.028,-.040,-.066],wing,{roll:side*.26,pitch:-.29});
  for(let i=0;i<7;i++){
   const offset=i*.023;
   const start=[side*(.041+offset*.25),.036-offset*.38,.030-offset];
   const middle=[side*(.079+offset*.25),-.026-offset*.59,-.142-offset*.56];
   const end=[side*(.044+offset*.26),-.115-offset*.76,-.267-offset*.81];
   sculpt.sweep(wingJoint,[start,middle,end],[.007,.028,.0012],i%3===0?quill:feather,{segments:10,length:12,flat:.41},(c,x,y,z)=>{
    c.lerp(deep,.36*THREE.MathUtils.smoothstep(-z,.16,.38));
   });
  }
  const leg=sculpt.joint(side<0?'legLeft':'legRight',[side*.064,.276,-.001]);
  sculpt.sweep(leg,[[0,.022,0],[0,-.123,-.028],[0,-.237,.018]],[.029,.019,.010],foot,{segments:10,length:11});
  for(let toe=-1;toe<=1;toe++){
   sculpt.sweep(leg,[[0,-.23,.016],[toe*.027,-.251,.066],[toe*.038,-.262,.091]],[.013,.009,.002],foot,{segments:8,length:6});
   sculpt.sweep(leg,[[toe*.037,-.258,.085],[toe*.040,-.257,.102],[toe*.041,-.269,.109]],[.005,.005,.001],quill,{segments:6,length:5});
  }
 }
 for(let i=-2;i<=2;i++){
  sculpt.sweep(tail,[[i*.017,0,-.006],[i*.030,-.019,-.158],[i*.038,-.061,-.314+Math.abs(i)*.034]],[.003,.034,.001],i%2?wing:feather,{segments:10,length:12,flat:.22});
 }
}

function sculptMaterial(working,archetype){
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,metalness:0});
 material.onBeforeCompile=shader=>{
  shader.uniforms.creatureWorking=working;
  shader.vertexShader='attribute vec3 surfaceResponse;\nvarying vec3 vCreatureSurface;\nvarying vec3 vCreatureRest;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCreatureSurface = surfaceResponse;\nvCreatureRest = position;');
  shader.fragmentShader=`uniform float creatureWorking;
varying vec3 vCreatureSurface;
varying vec3 vCreatureRest;
float creatureGrain(float phase){
 return sin(phase) * (1.0 - smoothstep(0.50, 3.14, fwidth(phase)));
}
vec3 creatureNormal(vec3 normal, vec3 position, float height){
 vec3 u = normalize(dFdx(position));
 vec3 v = normalize(dFdy(position));
 vec3 ru = cross(v, normal);
 vec3 rv = cross(normal, u);
 float determinant = dot(u, ru);
 vec3 gradient = sign(determinant) * (dFdx(height) * ru + dFdy(height) * rv);
 return normalize(max(0.0001, abs(determinant)) * normal - gradient);
}
`+shader.fragmentShader;
  const grain=archetype==='robot'
   ?'creatureGrain(vCreatureRest.x * 2050.0 + vCreatureRest.y * 126.0) * 0.60 + creatureGrain(vCreatureRest.z * 1400.0) * 0.28'
   :archetype==='bird'
    ?'creatureGrain(vCreatureRest.x * 520.0 + vCreatureRest.y * 430.0) * creatureGrain(vCreatureRest.z * 185.0 + vCreatureRest.y * 79.0)'
    :'creatureGrain(vCreatureRest.x * 965.0 + sin(vCreatureRest.y * 58.0) * 2.5 + vCreatureRest.z * 440.0) * 0.61 + creatureGrain(vCreatureRest.z * 1560.0 + vCreatureRest.y * 225.0) * 0.31';
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float creatureMicro = (${grain}) * smoothstep(0.12, 0.50, vCreatureSurface.x);
diffuseColor.rgb *= 1.0 + creatureMicro * ${archetype==='robot'?'0.023':'0.105'};`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
normal = creatureNormal(normal, -vViewPosition, creatureMicro * ${archetype==='robot'?'0.015':'0.053'});`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = clamp(vCreatureSurface.x, 0.04, 1.0);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor = vCreatureSurface.y;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vCreatureSurface.z * (0.06 + 0.75 * creatureWorking);');
 };
 material.customProgramCacheKey=()=> 'atlas-sculpted-creatures-v2-'+archetype;
 return material;
}

function createActor(resident){
 const sculpt=new CharacterSculpt();
 const {id,archetype}=resident;
 if(archetype==='robot')robot(sculpt,id);
 if(archetype==='animal')animal(sculpt,id);
 if(archetype==='bird')bird(sculpt,id);
 const working={value:0},mesh=sculpt.finish(sculptMaterial(working,archetype));
 const actor=new THREE.Group();
 actor.name='atlas-sculpt-'+id;
 actor.userData={residentId:id,archetype,role:resident.role,functions:HOUSE_FUNCTIONS.filter(fn=>fn.owner===id).map(fn=>fn.id),source:'Atlas procedural 3D',scripted:true};
 actor.add(mesh);
 return{actor,mesh,working,joints:Object.fromEntries(sculpt.bones.map(bone=>[bone.name,bone])),pelvis:sculpt.root.position.y};
}

function poseRobot(model,resident,motion){
 const {joints}=model;
 const seated=resident.seated===true;
 joints.root.position.y=model.pelvis-(seated?.27:0);
 joints.torso.rotation.x=channel(motion.tilt,.25)*.56;
 joints.head.rotation.x=channel(motion.head,.4)*.65;
 for(const [name,side] of [['Left',-1],['Right',1]]){
  const gesture=channel(side<0?motion.leftArm:motion.rightArm,.8);
  const stride=side*channel(motion.limb,.5);
  joints['arm'+name].rotation.set((seated?-.47:0)+gesture*.64,0,side*.11);
  joints['forearm'+name].rotation.x=-.12-gesture*.40-(seated?.35:0);
  joints['thigh'+name].rotation.x=seated?-1.43:stride;
  joints['shin'+name].rotation.x=seated?1.47:Math.abs(stride)*.24;
  joints['foot'+name].rotation.x=seated?-.04:-stride*.73;
 }
}

function poseAnimal(model,resident,motion){
 const {joints}=model,seat=resident.seated?.46:0;
 joints.root.position.y=model.pelvis+seat;
 joints.head.rotation.x=channel(motion.head,.42)*.60;
 joints.head.rotation.y=channel(motion.tool,.3)*1.2;
 joints.tail.rotation.y=channel(motion.limb,.35)*.82;
 for(const [name,side] of [['Left',-1],['Right',1]]){
  const stride=channel(motion.limb,.5)*side;
  joints['ear'+name].rotation.y=channel(motion.head,.4)*side*.22;
  joints['front'+name].rotation.x=stride;
  joints['hind'+name].rotation.x=-stride;
  joints['front'+name+'Lower'].rotation.x=Math.max(0,-stride)*.54;
  joints['hind'+name+'Lower'].rotation.x=Math.max(0,stride)*.54;
 }
}

function poseBird(model,resident,motion){
 const {joints}=model;
 joints.root.position.y=model.pelvis+(resident.seated?.47:0);
 joints.head.rotation.x=channel(motion.head,.4)*.70;
 joints.head.rotation.y=channel(motion.tool,.3)*1.1;
 joints.tail.rotation.x=channel(motion.wing,.64)*.23;
 for(const [name,side] of [['Left',-1],['Right',1]]){
  joints['wing'+name].rotation.z=side*channel(motion.wing,.72)*.83;
  joints['wing'+name].rotation.y=side*channel(motion.wing,.72)*.32;
  joints['leg'+name].rotation.x=side*channel(motion.limb,.36)*.55;
 }
}

/** Generated local meshes replace primitive figures without making calls or
 * changing the resident's identity, tool bindings, work or route. */
export function createCreatureModels(parent){
 const root=new THREE.Group(),models=new Map();
 root.name='atlas-creature-models';
 parent.add(root);
 let disposed=false;
 return{
  update(resident,{position=resident?.position,yaw=resident?.yaw,motion={},working=false,reducedMotion=false}={}){
   if(disposed)return false;
   const canonical=residentById(resident?.id);
   if(!canonical||!ARCHETYPES.has(canonical.archetype)||!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))return false;
   let model=models.get(canonical.id);
   if(!model){
    model=createActor(canonical);
    root.add(model.actor);
    models.set(canonical.id,model);
   }
   const pose={seated:resident.seated===true};
   const channels=reducedMotion?{}:motion;
   model.actor.position.fromArray(position);
   model.actor.position.y+=channel(channels.bob,.075);
   model.actor.rotation.y=Math.PI-(Number.isFinite(yaw)?yaw:canonical.yaw);
   model.working.value=working===true?1:0;
   if(canonical.archetype==='robot')poseRobot(model,pose,channels);
   if(canonical.archetype==='animal')poseAnimal(model,pose,channels);
   if(canonical.archetype==='bird')poseBird(model,pose,channels);
   model.actor.userData.currentWork=working===true;
   return true;
  },
  dispose(){
   if(disposed)return;
   disposed=true;
   for(const {mesh} of models.values()){
    mesh.geometry.dispose();
    mesh.material.dispose();
    mesh.skeleton.dispose();
   }
   models.clear();
   root.removeFromParent();
  }
 };
}
