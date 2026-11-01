import * as THREE from './vendor/three.module.js';
import {ROOMS} from './layout.js';
import {normalizeProcessState,processForRoom,processMotion,creatureArchetype,measuredChanges,PHASE_LABELS,STATE_LABELS} from './process-state.js';

const stations={salon:[2.7,2.9],music:[-5.6,2],lab:[-5.5,-5.6],games:[5.6,2],cinema:[5.25,-1.6],constellation:[0,-1.45],mind:[-10.4,-12.5],body:[-5.4,-12.5],refutation:[3.3,-12.4],language:[10.6,-12.5]};
const colours={idle:'#a6b6b7',running:'#91e0c3',passed:'#a3d6a6',failed:'#ed9a8c',waiting:'#c5b591'};
const roles={human:{label:'Mente · figura humana',colour:'#b6d3dd'},robot:{label:'Ion · robot de trabajo',colour:'#a9c9bc'},animal:{label:'Animal · exploración',colour:'#d8af8b'},bird:{label:'Cielo · ave de contraste',colour:'#b9b4df'}};
const PARTS=9;
const LABEL_WIDTH=2.8,LABEL_HEIGHT=.66,LABEL_MAX_PX=220;

// Ten stylized residents share primitive instances: two actor draws and one
// optional retained-change display. Neither motion nor elapsed time adds data.
export function createProcessCreatures(scene,textures,{now=Date.now}={}){
 const box=new THREE.BoxGeometry(1,1,1),bodyMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.6,metalness:.12});
 const bodies=new THREE.InstancedMesh(box,bodyMaterial,ROOMS.length*PARTS);
 const heads=new THREE.InstancedMesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.6,metalness:.08}),ROOMS.length);
 const marks=new THREE.InstancedMesh(box,new THREE.MeshStandardMaterial({color:'#c9ddb1',roughness:.5,metalness:.2}),3);
 bodies.name='atlas-process-bodies';heads.name='atlas-process-heads';marks.name='atlas-measured-changes';marks.userData.basis='experience.counters.accepted';marks.visible=false;bodies.userData.archetypes=[];
 for(const mesh of [bodies,heads,marks]){mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;scene.add(mesh);}
 let telemetry=normalizeProcessState(null),receivedAt=-Infinity,sourceAge=Infinity;
 const dummy=new THREE.Object3D(),colour=new THREE.Color(),accent=new THREE.Color(),cameraPosition=new THREE.Vector3();
 const labels=ROOMS.map(room=>{
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=120;const context=canvas.getContext('2d'),map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;textures.push(map);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false}));const[x,z]=stations[room.id];sprite.position.set(x,1.85,z);sprite.scale.set(LABEL_WIDTH,LABEL_HEIGHT,1);sprite.name='atlas-resident-label-'+room.id;scene.add(sprite);return {room,context,map,sprite,caption:''};
 });
 function put(mesh,index,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);}
 function part(k,index,...pose){put(bodies,k+index,...pose);}
 function label(entry,process,kind,accepted){
  const title={human:'Mente · humano',robot:'Ion · robot',animal:'Animal · explorador',bird:'Ave · Cielo'}[kind];
  const caption=process.workVerified&&process.phase?PHASE_LABELS[process.phase]+' · en curso':STATE_LABELS[process.state];
  const count=process.id==='experience'?process.counters?.accepted:entry.room.id==='body'?accepted:null;
  const proof=Number.isSafeInteger(count)&&count>=0?'Cambios medidos '+count:process.counters?.observations!==undefined?'Observaciones '+process.counters.observations:process.counters?.trials!==undefined?'Pruebas '+process.counters.trials:process.workVerified?'Trabajo comunicado':'Sin trabajo activo';
  const key=title+'|'+caption+'|'+proof;if(entry.caption===key)return;entry.caption=key;
  const ctx=entry.context;ctx.clearRect(0,0,512,120);ctx.fillStyle='#10272eea';ctx.beginPath();ctx.roundRect(4,4,504,112,14);ctx.fill();ctx.strokeStyle=colours[process.state];ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle=colours[process.state];ctx.font='600 30px system-ui';ctx.textAlign='center';ctx.fillText(title,256,30);
  ctx.fillStyle='#edf3ed';ctx.font='27px system-ui';ctx.fillText(caption,256,66);ctx.fillStyle='#d0e0d8';ctx.font='25px system-ui';ctx.fillText(proof,256,104);entry.map.needsUpdate=true;
 }
 function fitLabels(camera,viewportHeight){
  if(!camera?.isPerspectiveCamera||!Number.isFinite(viewportHeight)||viewportHeight<=0)return;
  camera.updateMatrixWorld();const projection=viewportHeight/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2));
  for(const {sprite} of labels){
   const depth=-cameraPosition.copy(sprite.position).applyMatrix4(camera.matrixWorldInverse).z;sprite.visible=depth>camera.near;
   if(!sprite.visible)continue;
   const factor=Math.min(1,LABEL_MAX_PX*depth/(LABEL_WIDTH*projection));sprite.scale.set(LABEL_WIDTH*factor,LABEL_HEIGHT*factor,1);
  }
 }
 return {
  setState(value,at=performance.now()){telemetry=normalizeProcessState(value);receivedAt=at;sourceAge=telemetry.at?now()-Date.parse(telemetry.at):Infinity;},
  update(time,camera,viewportHeight){
   fitLabels(camera,viewportHeight);
   const elapsed=time*1000-receivedAt,ageMs=sourceAge<0||elapsed<0||elapsed>75000?Infinity:sourceAge+elapsed,accepted=measuredChanges(telemetry);
   for(let i=0;i<ROOMS.length;i++){
    const room=ROOMS[i],process=processForRoom(telemetry,room.id,{ageMs}),motion=processMotion(process,time,i*.73),kind=creatureArchetype(process,room.id),base=stations[room.id],x=base[0]+motion.travel,z=base[1],bob=motion.bob,k=i*PARTS;
    bodies.userData.archetypes[i]=kind;colour.set(roles[kind].colour).lerp(accent.set(colours[process.state]),motion.working?.22:.08);
    for(let j=0;j<PARTS;j++){bodies.setColorAt(k+j,colour);part(k,j,0,-30,0,.00001,.00001,.00001);}heads.setColorAt(i,colour);
    if(kind==='human'){
     part(k,0,x,.65+bob,z,.36,.45,.25,motion.tilt);put(heads,i,x,1.03+bob,z,.21,.24,.20,motion.head);
     for(let j=0;j<2;j++){const side=j?1:-1;part(k,1+j,x+side*.27,.64+bob,z,.09,.37,.11,j?motion.rightArm:motion.leftArm,0,side*.1);part(k,3+j,x+side*.11,.24+bob,z,.12,.38,.14,-side*motion.limb);}
     part(k,5,x,.87+bob,z,.39,.055,.28);part(k,6,x,.64+bob,z-.29,.32,.23,.045,.2+motion.tool);part(k,7,x,1.06+bob,z-.195,.22,.035,.025);part(k,8,x,1.23+bob,z,.33,.055,.28);
     bodies.setColorAt(k+7,accent.set('#173c40'));bodies.setColorAt(k+6,accent.set('#779c8a'));
    }else if(kind==='robot'){
     part(k,0,x,.65+bob,z,.48,.43,.31,motion.tilt);part(k,5,x,1.03+bob,z,.4,.30,.32,motion.head);put(heads,i,x,1.34+bob,z,.055,.055,.055);
     for(let j=0;j<2;j++){const side=j?1:-1;part(k,1+j,x+side*.34,.63+bob,z,.14,.39,.14,j?motion.rightArm:motion.leftArm);part(k,3+j,x+side*.14,.23+bob,z,.17,.32,.20,-side*motion.limb);}
     part(k,6,x,1.24+bob,z,.026,.17,.026);part(k,7,x,1.05+bob,z-.177,.32,.09,.035);part(k,8,x+.45,.46+bob+motion.tool,z-.14,.34,.08,.11,motion.rightArm);
     bodies.setColorAt(k+7,accent.set('#173c40'));bodies.setColorAt(k+8,accent.set('#d5bc81'));
    }else if(kind==='animal'){
     part(k,0,x,.37+bob,z,.55,.27,.35);put(heads,i,x+.3,.55+bob,z,.22,.20,.18,0,0,motion.head*.5);
     for(let j=0;j<4;j++){const side=j%2?1:-1,front=j<2?-1:1;part(k,1+j,x+front*.20,.19+bob,z+side*.14,.075,.26,.08,side*motion.limb*front);}
     part(k,5,x-.39,.45+bob,z,.38,.11,.11,0,0,-.3+motion.head*.2);part(k,6,x+.29,.77+bob,z-.105,.075,.15,.1,0,0,.2);part(k,7,x+.29,.77+bob,z+.105,.075,.15,.1,0,0,.2);part(k,8,x+.49,.52+bob,z,.16,.10,.17);
     bodies.setColorAt(k+8,accent.set('#354549'));
    }else{
     part(k,0,x,.76+bob,z,.25,.22,.40);put(heads,i,x,1.0+bob,z-.15,.14,.15,.14,motion.head);
     for(let j=0;j<2;j++){const side=j?1:-1;part(k,1+j,x+side*.28,.82+bob,z,.48,.055,.26,0,0,side*(.18+motion.wing));part(k,3+j,x+side*.07,.53+bob,z,.035,.24,.035);}
     part(k,5,x,.76+bob,z+.31,.23,.055,.29,-.25);part(k,6,x,1.0+bob,z-.32,.08,.06,.17);part(k,7,x,1.17+bob,z-.13,.035,.15,.06,0,0,motion.head);
     bodies.setColorAt(k+6,accent.set('#d7bb7a'));
    }
    label(labels[i],process,kind,accepted);
   }
   // Retained counter marks are not generated projects or progress animation.
   const visible=accepted===null?0:Math.min(3,accepted);marks.visible=visible>0;marks.userData.acceptedChanges=accepted;
   for(let i=0;i<3;i++)put(marks,i,visible>i?-4.6:0,visible>i?.13+i*.21:-30,-12.1,visible>i?.26:.00001,visible>i?.18:.00001,visible>i?.26:.00001,0,i*.2);
   for(const mesh of [bodies,heads,marks]){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  }
 };
}
