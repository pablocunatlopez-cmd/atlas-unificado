import {furnitureBox} from './surface-materials.js';
import {bindResidentSurfaces,residentSurface} from './resident-surfaces.js';
import {createWorkCourier} from './work-courier.js?v=housework1';
import {createAdvancedResidents} from './advanced-residents.js?v=characters2';
import {createLivingPresentations} from './living-presentation.js';
import * as THREE from './vendor/three.module.js';
import {roomAt} from './layout.js';
import {RESIDENTS,residentById,processForResident} from './residents.js';
export {processForResident} from './residents.js';
import {normalizeProcessState,processMotion,measuredChanges,PHASE_LABELS,STATE_LABELS} from './process-state.js?v=housework1';
import {createSkyJourneys} from './sky-journeys.js';

const BOX_PARTS=18,ROUND_PARTS=6;
const LABEL_WIDTH=2,LABEL_HEIGHT=.5,LABEL_MAX_PX=160;
const statusColours={idle:'#a6b6b7',running:'#91e0c3',passed:'#a3d6a6',failed:'#ed9a8c',waiting:'#c5b591'};
const shirts=['#497f79','#a96d51','#657690','#9a8558','#7b6d90'];
const skins=['#d2a079','#b98262','#e1b994','#9b6b50'];
const dark='#243d43',cream='#e9dfc8',wood='#936d47';

// Eighteen furnished stations and six quiet cinema seats share two actor draws.
// Their existence is independent of connectivity; work gestures require a fresh
// report from an explicitly assigned real process. Presence never adds learning.
export function createProcessCreatures(scene,textures,{now=Date.now,walls,reducedMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches}={}){
 const group=new THREE.Group();group.name='atlas-residents';group.userData.roster=RESIDENTS;scene.add(group);
 const box=furnitureBox(1,1,1),sphere=new THREE.SphereGeometry(1,16,12);
 const bodies=new THREE.InstancedMesh(box,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.72,metalness:.08}),RESIDENTS.length*BOX_PARTS);
 const rounds=new THREE.InstancedMesh(sphere,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.66,metalness:.04}),RESIDENTS.length*ROUND_PARTS);
 const marks=new THREE.InstancedMesh(box,new THREE.MeshStandardMaterial({color:'#c9ddb1',roughness:.5,metalness:.2}),3);
 const bodySurfaces=bindResidentSurfaces(bodies.material,box,RESIDENTS.length*BOX_PARTS),roundSurfaces=bindResidentSurfaces(rounds.material,sphere,RESIDENTS.length*ROUND_PARTS);
 bodies.name='atlas-process-bodies';rounds.name='atlas-process-heads';marks.name='atlas-measured-changes';
 bodies.userData.roster=RESIDENTS;bodies.userData.parts=BOX_PARTS;rounds.userData.parts=ROUND_PARTS;
 bodies.userData.archetypes=RESIDENTS.map(resident=>resident.archetype);bodies.userData.work=[];
 marks.userData.basis='experience.counters.accepted';marks.visible=false;
 for(const mesh of [bodies,rounds,marks]){mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;group.add(mesh);}
 bodies.castShadow=true;rounds.castShadow=true;
 let telemetry=normalizeProcessState(null),receivedAt=-Infinity,sourceAge=Infinity,actor,motion,actorIndex;
 const renderedPositions=new Map();
 const courier=createWorkCourier({now,walls,reducedMotion}),journeys=createSkyJourneys({now,walls,reducedMotion}),presentations=createLivingPresentations({walls,reducedMotion}),advanced=createAdvancedResidents(group,{reducedMotion});
 const dummy=new THREE.Object3D(),colour=new THREE.Color(),yawRotation=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0),cameraPoint=new THREE.Vector3(),actorOrigin=new THREE.Vector3();
 const labels=RESIDENTS.filter(resident=>!resident.cosmetic).map(resident=>{
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const context=canvas.getContext('2d'),map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;textures.push(map);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false}));
  const height=resident.archetype==='animal'?1.70:resident.archetype==='bird'?1.93:resident.seated?1.94:2.02;
  sprite.position.set(resident.position[0],resident.position[1]+height,resident.position[2]);sprite.scale.set(LABEL_WIDTH,LABEL_HEIGHT,1);
  sprite.name='atlas-resident-label-'+resident.id;sprite.visible=false;group.add(sprite);return {resident,context,map,sprite,caption:''};
 });
 function hide(mesh,index){dummy.position.set(0,-30,0);dummy.scale.set(.00001,.00001,.00001);dummy.quaternion.identity();dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);}
 function put(mesh,index,tint,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){
  dummy.position.set(x+motion.travel,y+motion.bob,z).applyQuaternion(yawRotation).add(actorOrigin);
  dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.quaternion.premultiply(yawRotation);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);mesh.setColorAt(index,colour.set(tint));
  const surfaces=mesh===bodies?bodySurfaces:roundSurfaces,part=index%(mesh===bodies?BOX_PARTS:ROUND_PARTS);surfaces.setXYZ(index,...residentSurface(actor,mesh===bodies?'body':'round',part,{working:motion.working===true}));
 }
 const b=(part,...pose)=>put(bodies,actorIndex*BOX_PARTS+part,...pose);
 const r=(part,...pose)=>put(rounds,actorIndex*ROUND_PARTS+part,...pose);
 function legs(seated,tint,robot=false){
  for(let side=-1;side<=1;side+=2){const j=side<0?0:1,x=side*(robot?.15:.12),width=robot?.17:.14;
   if(seated){b(2+j,tint,x,.58,-.16,width,.16,.42);b(4+j,tint,x,.29,-.35,width,.43,.15);}
   else b(2+j,tint,x,.39,0,width,.57,robot?.21:.18,-side*motion.limb);
   b(6+j,dark,x,.09,seated?-.43:-.035,robot?.25:.21,.15,robot?.36:.32);
  }
 }
 function arms(shoulderY,tint,handTint,robot=false){
  for(let side=-1;side<=1;side+=2){const j=side<0?0:1,angle=(actor.seated?.85:.08)+(side<0?motion.leftArm:motion.rightArm),length=robot?.43:.44,x=side*(robot?.32:.28);
   const handY=shoulderY-length*Math.cos(angle),handZ=-length*Math.sin(angle);
   b(8+j,tint,x,shoulderY-length*.5*Math.cos(angle),-length*.5*Math.sin(angle),robot?.14:.11,length,robot?.15:.12,angle);
   r(1+j,handTint,x,handY,handZ,robot?.085:.065,robot?.08:.075,.065);
  }
 }
 function human(){
  const skin=skins[actorIndex%skins.length],shirt=actor.room==='lab'||actor.room==='refutation'?cream:shirts[actorIndex%shirts.length],torsoY=actor.seated?.92:1.03,headY=actor.seated?1.36:1.47;
  legs(actor.seated,'#46545c');b(0,shirt,0,torsoY,0,.41,.48,.28,motion.tilt);b(1,'#46545c',0,actor.seated?.65:.72,0,.36,.18,.26);
  arms(torsoY+.18,shirt,skin);r(0,skin,0,headY,0,.215,.22,.20,motion.head);
  b(10,'#493d37',0,headY+.17,.025,.42,.13,.36);b(11,skin,0,headY-.03,-.215,.055,.075,.065);
  b(12,dark,0,headY-.11,-.187,.105,.018,.018);b(13,cream,0,torsoY+.21,-.15,.18,.055,.035);
  b(14,'#6c9390',0,torsoY-.12,-.40,.31,.21,.035,.32+motion.tool);b(15,motion.working?'#b9e6c2':'#c9ae70',.12,torsoY+.09,-.154,.07,.08,.025);
  for(let side=-1;side<=1;side+=2){const j=side<0?0:1;r(3+j,dark,side*.075,headY+.025,-.187,.025,.032,.022);b(16+j,'#493d37',side*.075,headY+.08,-.181,.073,.015,.025);}
  if(actorIndex%2)r(5,'#493d37',0,headY+.08,.19,.09,.10,.085);
 }
 function robot(){
  const shell=actorIndex%2?'#b3b8ac':'#9cb8b3',joint='#52666a',torsoY=actor.seated?.90:.97,headY=actor.seated?1.22:1.35;
  legs(actor.seated,joint,true);b(0,shell,0,torsoY,0,.49,.44,.34,motion.tilt);b(1,joint,0,actor.seated?.64:.70,0,.40,.16,.30);
  arms(torsoY+.16,shell,joint,true);b(10,shell,0,headY,0,.43,.33,.37,motion.head);
  b(11,dark,0,headY+.02,-.199,.35,.13,.035);b(12,wood,0,headY+.23,.02,.025,.13,.025);
  r(0,'#dabf78',0,headY+.32,.02,.045,.045,.045);b(13,motion.working?'#abd9b7':'#d0ad72',0,torsoY+.02,-.182,.28,.16,.035);
  b(14,wood,.35,torsoY-.28,-.27,.045,.29,.055,motion.rightArm);b(15,'#d6c597',.31,torsoY-.13,-.27,.065,.075,.075);b(16,'#d6c597',.39,torsoY-.13,-.27,.065,.075,.075);
  b(17,'#a6d9ce',0,headY-.09,-.20,.15,.025,.025);r(5,dark,-.12,torsoY+.04,-.20,.043,.043,.025);
  for(let side=-1;side<=1;side+=2)r(side<0?3:4,'#bfe6db',side*.095,headY+.025,-.224,.035,.027,.017);
 }
 function animal(){
  const fur=actor.id==='games-maquette'?'#aa784f':'#bc8658',bodyY=actor.seated?.87:.68,headY=actor.seated?1.22:1.07;
  b(0,fur,0,bodyY,0,.43,.45,.34,motion.tilt);b(1,fur,0,headY-.20,-.03,.28,.22,.26);r(0,fur,0,headY,-.02,.23,.21,.20,motion.head);
  for(let side=-1;side<=1;side+=2){const j=side<0?0:1;
   b(2+j,fur,side*.13,actor.seated?.55:.25,actor.seated?-.17:.05,.13,actor.seated?.18:.43,actor.seated?.30:.15);
   b(4+j,fur,side*.24,bodyY-.03,-.15,.09,.29,.10,side<0?motion.leftArm:motion.rightArm);
   b(7+j,fur,side*.15,headY+.23,.0,.115,.25,.12,0,0,side*.26);
   r(2+j,dark,side*.09,headY+.025,-.19,.025,.032,.021);r(4+j,cream,side*.24,bodyY-.16,-.23,.065,.055,.065);
  }
  b(6,fur,0,bodyY-.03,.45,.15,.14,.69,-.45+motion.head*.1);r(1,cream,0,headY-.07,-.22,.155,.11,.14);b(9,dark,0,headY-.04,-.35,.07,.06,.055);
  b(10,cream,0,bodyY-.04,-.18,.28,.30,.025);b(11,'#6a8b76',0,bodyY+.13,-.18,.40,.12,.035);
  b(12,wood,.28,bodyY+.13,-.28,.035,.22,.035,.18+motion.tool);b(13,'#bed8d1',.28,bodyY+.29,-.29,.15,.15,.028);
  b(14,cream,0,bodyY-.02,.71,.15,.14,.25,-.45);
 }
 function bird(){
  const base=actor.seated?.52:0,bodyY=base+.45,headY=base+.76,tint=actor.id==='sky-agents'?'#8d99bf':'#b3a0bb';
  r(1,tint,0,bodyY,0,.205,.28,.245);r(0,tint,0,headY,-.10,.16,.18,.16,motion.head);
  for(let side=-1;side<=1;side+=2){const j=side<0?0:1;
   b(1+j,tint,side*.205,bodyY+.02,.025,.10,.38,.27,0,0,side*(.20+motion.wing));
   b(4+j,wood,side*.075,base+.16,-.01,.035,.24,.035);r(4+j,wood,side*.075,base+.045,-.05,.065,.028,.10);
   r(2+j,dark,side*.055,headY+.02,-.247,.022,.028,.015);
  }
  b(3,tint,0,bodyY-.10,.27,.24,.055,.37,-.25);b(6,'#d6ae63',0,headY-.045,-.31,.09,.075,.19);
  b(7,'#ddc798',0,headY+.20,-.08,.035,.15,.08,0,0,motion.head);b(8,wood,0,base+.005,0,.49,.065,.15);
  b(9,cream,0,bodyY-.02,-.235,.18,.26,.025);b(10,'#8a9e87',0,base+.10,-.30,.32,.045,.24,.12);
 }
 function label(entry,process,journey,hosting){
  const state=journey?.active?journey.caption:hosting?hosting.recorded?hosting.sourceCount?'Ícaro · '+hosting.sourceCount+' referencias':'Ícaro · sin nuevas fuentes':'Ícaro · consultando':process.workVerified?(PHASE_LABELS[process.phase]||'Trabajo')+' · en curso':process.displayState||STATE_LABELS[process.state];
  const caption=entry.resident.name+'|'+state;if(entry.caption===caption)return;entry.caption=caption;
  const ctx=entry.context;ctx.clearRect(0,0,512,128);ctx.fillStyle='#183338ec';ctx.beginPath();ctx.roundRect(4,4,504,120,18);ctx.fill();ctx.strokeStyle=statusColours[process.state];ctx.lineWidth=2;ctx.stroke();
  ctx.textAlign='center';ctx.fillStyle='#f4ead6';ctx.font='600 32px system-ui';ctx.fillText(entry.resident.name,256,48,470);
  ctx.fillStyle=statusColours[process.state];ctx.font='29px system-ui';ctx.fillText(state,256,94,470);entry.map.needsUpdate=true;
 }
 function fitLabels(camera,viewportHeight){
  if(!camera?.isPerspectiveCamera||!Number.isFinite(viewportHeight)||viewportHeight<=0){for(const {sprite} of labels)sprite.visible=false;return;}
  camera.updateMatrixWorld();const overview=camera.position.y>6,room=roomAt(camera.position.x,camera.position.z),projection=viewportHeight/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2));
  for(const entry of labels){const {sprite,resident}=entry,depth=-cameraPoint.copy(sprite.position).applyMatrix4(camera.matrixWorldInverse).z;
   sprite.visible=!overview&&roomAt(sprite.position.x,sprite.position.z)===room&&depth>camera.near&&camera.position.distanceTo(sprite.position)<8;
   if(!sprite.visible)continue;
   const factor=Math.min(1,LABEL_MAX_PX*depth/(LABEL_WIDTH*projection));sprite.scale.set(LABEL_WIDTH*factor,LABEL_HEIGHT*factor,1);sprite.material.opacity=Math.max(.55,Math.min(.97,1.25-depth*.08));
  }
 }
 return {
  setPeopleBudget:value=>advanced.setBudget(value),setPeopleDetail:value=>advanced.setEnabled(value),peopleStatus:()=>advanced.status(),dispose:()=>advanced.dispose(),
  setLivingState:value=>presentations.setState(value),
  setState(value,at=performance.now()){telemetry=normalizeProcessState(value);receivedAt=Number.isFinite(at)?at:-Infinity;sourceAge=telemetry.at?now()-Date.parse(telemetry.at):Infinity;journeys.setState(value?.icarus,{connected:telemetry.connected,sourceAgeMs:sourceAge,receivedAtMs:receivedAt});courier.setState(value?.houseWork,{connected:telemetry.connected,sourceAgeMs:sourceAge,receivedAtMs:receivedAt});},
  positionForResident(id){return renderedPositions.get(id)||courier.positionForResident(id)||journeys.positionForResident(id)||residentById(id)?.position.slice()||null;},
  update(time,camera,viewportHeight){
   const elapsed=time*1000-receivedAt,ageMs=sourceAge<0||elapsed<0||elapsed>75000?Infinity:sourceAge+elapsed,accepted=measuredChanges(telemetry,{now:now()}),work=[];
   const courierTrip=courier.sample('language-symbol',time*1000),trips=new Map(RESIDENTS.map(resident=>[resident.id,resident.id==='language-symbol'&&courierTrip?.active?courierTrip:journeys.sample(resident.id,time*1000)])),hosting=[...trips.values()].find(trip=>trip?.fresh&&trip.active&&trip.stage==='meeting');
   const frames=RESIDENTS.map((resident,index)=>{const journey=trips.get(resident.id),process=processForResident(telemetry,resident,{ageMs}),recentWork=courier.workForResident(resident.id,time*1000),delivery=courierTrip?.active&&courierTrip.fresh&&courierTrip.stage==='delivering'&&courierTrip.recipientId===resident.id,presentation=!journey?.active&&!process.workVerified&&!recentWork&&!delivery?presentations.sample(resident.id,time):null;return{resident,index,journey,process,presentation,recentWork,delivery};});
   advanced.prepare(camera,frames.map(({resident,journey,presentation})=>({...resident,seated:journey?.active||presentation?.position?false:resident.seated,position:journey?.active?journey.position:presentation?.position||resident.position})));
   for(const frame of frames){
    const {resident,index,journey,process,presentation,recentWork,delivery}=frame;actor=journey?.active?{...resident,seated:false}:resident;actorIndex=index;actorOrigin.fromArray(journey?.position||actor.position);motion=processMotion(process,time,index*.73);yawRotation.setFromAxisAngle(axis,-(journey?.active?journey.yaw:actor.yaw));
    if(journey?.active){motion.travel=0;if(journey.moving&&journey.fresh){motion.limb=Math.sin(time*7)*.35;motion.leftArm=-Math.sin(time*7)*.22;motion.rightArm=Math.sin(time*7)*.22;motion.bob=Math.abs(Math.sin(time*7))*.025;}else{motion.limb=0;motion.bob=0;motion.leftArm=0;motion.rightArm=0;}}
    if(presentation){process.displayState='Presentación programada';if(presentation.position){actor={...resident,seated:false};actorOrigin.fromArray(presentation.position);yawRotation.setFromAxisAngle(axis,-presentation.yaw);}if(presentation.moving){motion.limb=Math.sin(time*7)*.32;motion.leftArm=-Math.sin(time*7)*.22;motion.rightArm=Math.sin(time*7)*.22;motion.bob=Math.abs(Math.sin(time*7))*.02;}else motion.rightArm=.4+Math.sin(time)*.15;}
    if(!journey?.active&&!process.workVerified&&(recentWork||delivery)){process.displayState=delivery?'Recibe resultado registrado':recentWork.displayState;if(!reducedMotion&&(delivery||recentWork.gesture)){motion.head=Math.sin(time*1.4)*.12;motion.rightArm=.28+Math.sin(time*2)*.12;motion.leftArm=-.14;motion.tool=Math.max(0,Math.sin(time*2))*.08;}}
    if(actor.id==='sky-agents'&&hosting){motion.wing=Math.sin(time*2)*.16;motion.head=Math.sin(time)*.12;}
    if(reducedMotion){motion.travel=0;motion.bob=0;motion.limb=0;motion.head=0;motion.leftArm=process.workVerified?.18:0;motion.rightArm=process.workVerified?.28:0;motion.wing=0;motion.tilt=0;motion.tool=0;}
    for(let part=0;part<BOX_PARTS;part++)hide(bodies,index*BOX_PARTS+part);for(let part=0;part<ROUND_PARTS;part++)hide(rounds,index*ROUND_PARTS+part);
    const detailed=advanced.update(actor,{position:actorOrigin.toArray(),yaw:journey?.active?journey.yaw:presentation?.position?presentation.yaw:actor.yaw,moving:journey?.active?journey.moving&&journey.fresh:!!presentation?.moving,working:process.workVerified,time});
    if(actor.archetype==='human'){if(!detailed)human();}else if(actor.archetype==='robot')robot();else if(actor.archetype==='animal')animal();else bird();
    renderedPositions.set(resident.id,actorOrigin.toArray());
    work.push({houseWork:recentWork?{eventId:recentWork.eventId,status:recentWork.status,scripted:true}:delivery?{eventId:courierTrip.eventId,delivery:true,scripted:true}:null,presentation:presentation?{artifactId:presentation.artifactId,scripted:true}:null,detailed,id:actor.id,processId:process.id,state:process.state,workVerified:process.workVerified,phase:process.phase||null,...(journey?{journey:{id:journey.eventId,stage:journey.stage,recorded:journey.recorded,fresh:journey.fresh}}:{})});
    const entry=labels.find(label=>label.resident.id===actor.id);if(entry){const height=actor.archetype==='animal'?1.70:actor.archetype==='bird'?1.93:actor.seated?1.94:2.02;entry.sprite.position.set(actorOrigin.x,actorOrigin.y+height,actorOrigin.z);label(entry,process,journey,actor.id==='sky-agents'?hosting:null);}
   }
   bodies.userData.work=work;group.userData.workingResidents=work.filter(item=>item.workVerified).map(item=>item.id);
   const visible=accepted===null?0:Math.min(3,accepted);marks.visible=visible>0;marks.userData.acceptedChanges=accepted;
   for(let index=0;index<3;index++){dummy.position.set(visible>index?-4.6:0,visible>index?.13+index*.21:-30,-13.1);dummy.scale.set(visible>index?.26:.00001,visible>index?.18:.00001,visible>index?.26:.00001);dummy.rotation.set(0,index*.2,0);dummy.updateMatrix();marks.setMatrixAt(index,dummy.matrix);}
   for(const mesh of [bodies,rounds,marks]){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
   bodySurfaces.needsUpdate=true;roundSurfaces.needsUpdate=true;
   fitLabels(camera,viewportHeight);
  }
 };
}
