import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {createLivingGeometry} from './living-geometry.js';
import {ROOMS} from './layout.js';
import {validateLivingState} from './living-contract.js';
export function createLivingInstallation(scene){
 const root=new THREE.Group();root.name='atlas-living-world';scene.add(root);const entries=new Map();let disposed=false,lastTime=0,interactionCount=0,lastInteraction=null;
 // Three.js Sprites share a library-owned quad; disposing one room must not
 // dispose geometry still used by labels in other rooms.
 function remove(entry){entry.group.traverse(o=>{if(!o.isSprite)o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});entry.group.removeFromParent();}
 function environment(group,room,p,x,z){
  const env=p.environment||{style:'gallery',floor:'grid',intensity:.45},width=room.bounds[2]-room.bounds[0]-.8,depth=room.bounds[3]-room.bounds[1]-.8,vertices=[];
  const line=(ax,az,bx,bz)=>vertices.push(ax,0,az,bx,0,bz);
  if(env.floor==='rings')for(const fraction of [.3,.55,.8]){const radius=Math.min(width,depth)*.5*fraction;for(let i=0;i<48;i++){const a=i*Math.PI/24,b=(i+1)*Math.PI/24;line(Math.cos(a)*radius,Math.sin(a)*radius,Math.cos(b)*radius,Math.sin(b)*radius);}}
  else if(env.floor==='tiles'){const columns=6,rows=6;for(let i=0;i<columns;i++)for(let j=0;j<rows;j++)if((i+j)%2===0){const ax=-width/2+i*width/columns,az=-depth/2+j*depth/rows,bx=ax+width/columns,bz=az+depth/rows;line(ax,az,bx,bz);line(ax,bz,bx,az);}}
  else{for(let i=0;i<=8;i++){line(-width/2,-depth/2+i*depth/8,width/2,-depth/2+i*depth/8);line(-width/2+i*width/8,-depth/2,-width/2+i*width/8,depth/2);}}
  const patternGeometry=new THREE.BufferGeometry();patternGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));const pattern=new THREE.LineSegments(patternGeometry,new THREE.LineBasicMaterial({color:p.colors[1],transparent:true,opacity:.2+env.intensity*.45,depthWrite:false}));pattern.name='living-floor-pattern';pattern.position.set(x,.056,z);pattern.userData={environment:true,floor:env.floor};group.add(pattern);
  const parts=[],short=Math.min(width,depth);
  if(env.style==='observatory'){
   for(const radius of [short*.16,short*.28,short*.39])parts.push(new THREE.TorusGeometry(radius,.025,5,48).rotateX(Math.PI/2));
   for(let i=0;i<8;i++){const a=i*Math.PI/4;parts.push(new THREE.OctahedronGeometry(.065,0).translate(Math.cos(a)*short*.39,0,Math.sin(a)*short*.39));}
  }else if(env.style==='garden'){
   for(let i=0;i<12;i++){const a=i*Math.PI/6,r=short*.32,leaf=new THREE.SphereGeometry(1,8,4).scale(.2,.025,.44).rotateY(-a).translate(Math.cos(a)*r,0,Math.sin(a)*r);parts.push(leaf);}
   parts.push(new THREE.TorusGeometry(short*.32,.022,4,48).rotateX(Math.PI/2));
  }else if(env.style==='arcade'){
   for(let i=-2;i<=2;i++){parts.push(new THREE.BoxGeometry(width*.65,.035,.035).rotateY(.32).translate(0,0,i*depth*.13));parts.push(new THREE.BoxGeometry(.035,.035,depth*.65).rotateY(.32).translate(i*width*.13,0,0));}
  }else{
   for(const side of [-1,1]){parts.push(new THREE.BoxGeometry(width*.6,.025,.12).translate(0,0,side*depth*.26));parts.push(new THREE.BoxGeometry(.12,.025,depth*.52).translate(side*width*.3,0,0));}
  }
  const sources=parts.map(part=>part.index?part.toNonIndexed():part),geometry=mergeGeometries(sources,false);for(const part of new Set([...parts,...sources]))part.dispose();
  const kit=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:p.colors[2],emissive:p.colors[2],emissiveIntensity:env.intensity,metalness:.4,roughness:.35}));kit.name='living-environment-kit';kit.position.set(x,2.89,z);kit.userData={environment:true,style:env.style,intensity:env.intensity};group.add(kit);
  return{pattern,kit};
 }
 function build(room,artifact){
  const p=artifact.proposal,group=new THREE.Group(),objects=[],x=(room.bounds[0]+room.bounds[2])/2,z=(room.bounds[1]+room.bounds[3])/2;group.name='living-'+room.id;group.userData={artifactId:artifact.id,actorId:artifact.actorId,title:p.title};
  // The structural floor's upper surface is y=.04; keep this overlay above it.
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(room.bounds[2]-room.bounds[0]-.3,room.bounds[3]-room.bounds[1]-.3),new THREE.MeshStandardMaterial({color:p.colors[0],transparent:true,opacity:.3,roughness:.4,metalness:.25,depthWrite:false}));floor.name='living-floor';floor.rotation.x=-Math.PI/2;floor.position.set(x,.052,z);group.add(floor);
  // Palette-authored architectural framing: two merged meshes per room, no
  // extra lights, shadows, collision obstacles or work/learning counters.
  const width=room.bounds[2]-room.bounds[0]-.6,depth=room.bounds[3]-room.bounds[1]-.6;
  function frame(name,height,thickness,tint){
   const parts=[new THREE.BoxGeometry(width,thickness,.075).translate(0,0,-depth/2),new THREE.BoxGeometry(width,thickness,.075).translate(0,0,depth/2),new THREE.BoxGeometry(.075,thickness,depth-.075).translate(-width/2,0,0),new THREE.BoxGeometry(.075,thickness,depth-.075).translate(width/2,0,0)],geometry=mergeGeometries(parts,false);for(const part of parts)part.dispose();
   const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:tint,emissive:tint,emissiveIntensity:.65,roughness:.25,metalness:.45}));mesh.name=name;mesh.position.set(x,height,z);mesh.userData.architecture=true;group.add(mesh);
  }
  frame('living-floor-frame',.065,.018,p.colors[1]);frame('living-cornice',2.98,.045,p.colors[2]);
  const decor=environment(group,room,p,x,z);
  for(const [i,o] of p.objects.entries()){
   const geometry=createLivingGeometry(o.shape);
   const material=new THREE.MeshStandardMaterial({color:p.colors[o.color],roughness:.28,metalness:.5,emissive:p.colors[o.color],emissiveIntensity:.15,side:o.shape==='wave'?THREE.DoubleSide:THREE.FrontSide,flatShading:o.shape==='crystal'}),mesh=new THREE.Mesh(geometry,material);mesh.name='living-object-'+i;mesh.position.set(x+o.x,2.32+o.y*.32,z+o.z);mesh.scale.setScalar(o.size);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={baseY:mesh.position.y,size:o.size};group.add(mesh);objects.push(mesh);
  }
  if(typeof document!=='undefined'){
   const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#071e2be8';ctx.fillRect(0,0,768,160);ctx.fillStyle=p.colors[1];ctx.font='bold 34px system-ui';ctx.textAlign='center';ctx.fillText(p.title,384,60,740);ctx.fillStyle='#eef9fb';ctx.font='25px system-ui';ctx.fillText('Creado por '+artifact.actorName,384,112,740);const map=new THREE.CanvasTexture(canvas),label=new THREE.Sprite(new THREE.SpriteMaterial({map,depthWrite:false}));label.position.set(x,2.76,room.bounds[3]-1.2);label.scale.set(3.6,.75,1);group.add(label);}
  }
  return{group,objects,artifact,decor,activatedAt:-Infinity};
 }
 return{
  setState(value){if(disposed)return;const state=validateLivingState(value);for(const room of ROOMS){const artifact=state.artifacts[room.id];if(!artifact||entries.get(room.id)?.artifact.id===artifact.id)continue;let next;try{next=build(room,artifact);}catch{continue;}root.add(next.group);const old=entries.get(room.id);entries.set(room.id,next);if(old)remove(old);}root.userData.artifacts=[...entries.values()].map(e=>({id:e.artifact.id,room:e.artifact.room,actorId:e.artifact.actorId}));},
  activate(room,time=lastTime){const entry=entries.get(room);if(disposed||!entry||!Number.isFinite(time))return{activated:false};entry.activatedAt=time;interactionCount++;lastInteraction={room,artifactId:entry.artifact.id,at:time};return{activated:true,...lastInteraction};},
  interactionStatus(){return{count:interactionCount,last:lastInteraction,activeRooms:[...entries].filter(([,entry])=>lastTime-entry.activatedAt>=0&&lastTime-entry.activatedAt<2).map(([room])=>room)};},
  update(time){if(!Number.isFinite(time))return;lastTime=time;for(const entry of entries.values()){
   const age=time-entry.activatedAt,response=age>=0&&age<2?Math.sin(Math.PI*age/2):0;
   for(const mesh of entry.objects){mesh.position.y=mesh.userData.baseY;mesh.scale.setScalar(mesh.userData.size);mesh.rotation.y=0;mesh.material.emissiveIntensity=.15+response*.65;}
   for(const instruction of entry.artifact.proposal.program){const mesh=entry.objects[instruction.target];if(!mesh)continue;if(instruction.op==='rotate')mesh.rotation.y=time*instruction.speed;if(instruction.op==='float')mesh.position.y=mesh.userData.baseY+Math.sin(time*instruction.speed)*instruction.amount;if(instruction.op==='pulse')mesh.scale.setScalar(mesh.userData.size*(1+Math.sin(time*instruction.speed)*instruction.amount));}
   for(const mesh of entry.objects)mesh.rotation.y+=response*.18;
   entry.decor.kit.material.emissiveIntensity=entry.decor.kit.userData.intensity+response*.5;
  }},
  status(){return{rooms:entries.size,objects:[...entries.values()].reduce((n,e)=>n+e.objects.length,0)};},
  dispose(){if(disposed)return;disposed=true;for(const entry of entries.values())remove(entry);entries.clear();root.removeFromParent();}
 };
}
