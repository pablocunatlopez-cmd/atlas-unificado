import * as THREE from './vendor/three.module.js';
import {ROOMS} from './layout.js';
import {normalizeProcessState,processForRoom,processCaption,processMotion} from './process-state.js';

const stations={salon:[2.7,2.9],music:[-5.6,2],lab:[-5.5,-5.6],games:[5.6,2],cinema:[5.25,-1.6],constellation:[0,-1.45],mind:[-10.4,-12.5],body:[-5.4,-12.5],refutation:[3.3,-12.4],language:[10.6,-12.5]};
const colours={idle:'#a6b6b7',running:'#91e0c3',passed:'#a3d6a6',failed:'#ed9a8c',waiting:'#c5b591'};
const bugs=new Set(['lab','mind','language']);

// Ten small agents share two instanced meshes. Walking/working poses follow
// received process state; the scene does not create learning or success events.
export function createProcessCreatures(scene,textures){
 const bodies=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.5,metalness:.25}),ROOMS.length*7);
 const heads=new THREE.InstancedMesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshStandardMaterial({color:'#e4ece6',roughness:.5,metalness:.18}),ROOMS.length);
 bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);bodies.frustumCulled=false;heads.frustumCulled=false;scene.add(bodies,heads);
 let telemetry=normalizeProcessState(null),receivedAt=-Infinity,sourceAge=0;
 const dummy=new THREE.Object3D(),colour=new THREE.Color(),labels=ROOMS.map(room=>{
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=180;const context=canvas.getContext('2d'),map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;textures.push(map);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false}));const[x,z]=stations[room.id];sprite.position.set(x,1.85,z);sprite.scale.set(2.8,.66,1);scene.add(sprite);return {room,canvas,context,map,sprite,caption:''};
 });
 function put(mesh,index,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);}
 function label(entry,process){
  const caption=processCaption(process),key=process.state+'|'+caption;if(entry.caption===key)return;entry.caption=key;
  const ctx=entry.context;ctx.clearRect(0,0,768,180);ctx.fillStyle='#10272eea';ctx.beginPath();ctx.roundRect(6,6,756,168,26);ctx.fill();ctx.strokeStyle=colours[process.state];ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle=colours[process.state];ctx.font='600 29px system-ui';ctx.textAlign='center';ctx.fillText(entry.room.short+' · proceso',384,52);
  ctx.fillStyle='#e9eee8';ctx.font='24px system-ui';const parts=caption.split(' · ');ctx.fillText(parts.slice(0,2).join(' · ').slice(0,54),384,95);ctx.fillStyle='#bbcfca';ctx.font='20px system-ui';ctx.fillText(parts.slice(2).join(' · ').slice(0,68)||'La actividad necesita evidencia del motor',384,135);entry.map.needsUpdate=true;
 }
 return {
  setState(value,at=performance.now()){telemetry=normalizeProcessState(value);receivedAt=at;sourceAge=telemetry.at?Math.max(0,Date.now()-Date.parse(telemetry.at)):0;},
  update(time){
   for(let i=0;i<ROOMS.length;i++){
    const room=ROOMS[i],process=processForRoom(telemetry,room.id,{ageMs:sourceAge+time*1000-receivedAt}),motion=processMotion(process,time,i*.73),base=stations[room.id],x=base[0]+motion.travel,z=base[1],bob=motion.bob,k=i*7,isBug=bugs.has(room.id);
    colour.set(colours[process.state]);for(let j=0;j<7;j++)bodies.setColorAt(k+j,colour);heads.setColorAt(i,colour);
    if(isBug){
     put(bodies,k,x,.36+bob,z,.4,.22,.55);put(heads,i,x,.59+bob,z-.15,.31,.22,.28,motion.head);
     for(let j=0;j<4;j++){const side=j%2?1:-1,front=j<2?-1:1;put(bodies,k+1+j,x+side*.29,.2+bob,z+front*.18,.10,.32,.10,front*motion.limb*.7,0,side*.6);}
     put(bodies,k+5,x,.61+bob,z-.4,.3,.055,.04);put(bodies,k+6,x,.91+bob,z-.12,.035,.24,.035,0,0,motion.head);
    }else{
     put(bodies,k,x,.64+bob,z,.4,.48,.28);put(heads,i,x,1.04+bob,z,.26,.24,.23,motion.head);
     for(let j=0;j<2;j++){const side=j?1:-1;put(bodies,k+1+j,x+side*.29,.64+bob,z,.1,.4,.12,side*motion.limb,0,side*.12);put(bodies,k+3+j,x+side*.12,.24+bob,z,.13,.4,.15,-side*motion.limb);}
     put(bodies,k+5,x,1.07+bob,z-.225,.3,.055,.035);put(bodies,k+6,x,1.36+bob,z,.035,.22,.035,0,0,motion.head);
    }
    bodies.setColorAt(k+5,colour.set('#153c3d'));
    label(labels[i],process);
   }
   bodies.instanceMatrix.needsUpdate=true;heads.instanceMatrix.needsUpdate=true;if(bodies.instanceColor)bodies.instanceColor.needsUpdate=true;if(heads.instanceColor)heads.instanceColor.needsUpdate=true;
  },
 };
}
