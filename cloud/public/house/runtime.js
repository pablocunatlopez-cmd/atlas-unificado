import * as THREE from './vendor/three.module.js';
import {createRenderEngine} from './render-engine.js';
import {CircularJoystick,showTouchControls} from './mobile-input.js';
import {ROOMS,roomById,roomAt,movePlayer,navigationVector,blocked} from './layout.js';
import {WORKSTATIONS,residentById} from './residents.js';
import {buildHouse} from './scene.js';
import {normalizeProcessState,processForRoom,processCaption} from './process-state.js';
import {atlasErasManifestToSceneGraph} from './eras-manifest-adapter.js';

const $=id=>document.getElementById(id),canvas=$('scene'),callbacks=[],urls=new Set();
const send=(event,data={})=>parent.postMessage({type:'atlas:house:'+event,...data},location.origin);
let renderer,house,frame=0,disposed=false,paused=false,overview=true,recording=null,currentRoom='salon',ready=false;
let erasScene=null,erasMode=false;
let player={x:roomById('salon').spawn[0],z:roomById('salon').spawn[1]},yaw=roomById('salon').yaw,pitch=.02,orbit=.58,elevation=.68,last=0,frames=0,elapsed=0,lowFrames=0;
let joystick,stick={x:0,y:0},drag=null,transition=null,recordStart=0,captureAngle=0;
let processState=normalizeProcessState(null),processReceivedAt=-Infinity,creativeState=null,creativeSource='coordinator',inspection=false;
const keys=new Set(),camera=new THREE.PerspectiveCamera(52,1,.08,190),target=new THREE.Vector3(),raycaster=new THREE.Raycaster();
const coarse=matchMedia('(pointer:coarse)').matches,touch=showTouchControls('auto',{touchPoints:navigator.maxTouchPoints,coarse,width:innerWidth});
document.body.classList.add(touch?'touch':'desktop','overview');
if(new URLSearchParams(location.search).get('embedded')==='1')document.body.classList.add('embedded');
const listen=(el,type,fn,options)=>{el.addEventListener(type,fn,options);callbacks.push(()=>el.removeEventListener(type,fn,options));};
function fail(message){$('failure').hidden=false;$('failure').querySelector('p').textContent=message;$('boot').hidden=true;send('error',{message});}
function updateRoom(id,force=false){
 if(!roomById(id))return;const changed=currentRoom!==id;if(!changed&&!force)return;currentRoom=id;const room=roomById(id);
 $('room-title').textContent=room.title;$('room-subtitle').textContent=room.kind+' · Un espacio para construir contigo';$('interact-title').textContent=room.kind;
 document.querySelectorAll('[data-room]').forEach(button=>{button.classList.toggle('active',button.dataset.room===id);button.setAttribute('aria-pressed',String(button.dataset.room===id));});
 if(changed)send('room',{room:id});
 updateProcessLegend();
}
function updateProcessLegend(){const legend=$('process-legend');if(!legend)return;const sourceAge=processState.at?Date.now()-Date.parse(processState.at):Infinity;const process=processForRoom(processState,currentRoom,{ageMs:sourceAge<0?sourceAge:Math.max(performance.now()-processReceivedAt,sourceAge)});legend.textContent=processCaption(process)+' · Gestos = trabajo comunicado; adornos ≠ aprendizaje.';}
function setOverview(value){
 overview=value;inspection=false;drag=null;keys.clear();joystick?.reset();transition=null;
 document.body.classList.toggle('overview',value);document.body.classList.toggle('walking',!value);$('walk').classList.toggle('selected',!value);$('overview').classList.toggle('selected',value);$('walk').querySelector('span').textContent=value?'Entrar en casa':'Explorando';$('interact').hidden=value;
 if(house)house.ceilings.visible=!value;
 if(value){$('room-title').textContent='Una casa para tus ideas';$('room-subtitle').textContent='Elige una sala o entra a explorar.';}else updateRoom(currentRoom,true);
}
function teleport(id){const room=roomById(id);if(!room)return;const from=camera.position.clone(),previous=currentRoom;setOverview(false);player={x:room.spawn[0],z:room.spawn[1]};const resident=WORKSTATIONS.find(item=>item.room===id);yaw=resident?Math.atan2(resident.position[0]-player.x,-(resident.position[2]-player.z)):room.yaw;pitch=resident?Math.atan2((resident.seated?1.22:1.35)-1.64,Math.hypot(resident.position[0]-player.x,resident.position[2]-player.z)):.01;transition={from,at:performance.now()};updateRoom(id);if(previous===id)send('room',{room:id});}
function reportReady(){
 send('ready',{backend:'WebGL2',rooms:ROOMS.map(room=>room.id),recordingSupported:typeof canvas.captureStream==='function'&&typeof MediaRecorder!=='undefined'});
 const value=house?.creativeStatus();if(value?.applied)send('creative',{value:{...value,source:creativeSource}});
}
function focusResident(id){
 const resident=residentById(id);if(!resident)return;
 const room=roomById(resident.room),[x,,z]=resident.position,side=[Math.cos(resident.yaw)*2.1,Math.sin(resident.yaw)*2.1],front=[Math.sin(resident.yaw)*1.3,-Math.cos(resident.yaw)*1.3];
 const spots=[[x+side[0]+front[0],z+side[1]+front[1]],[x-side[0]+front[0],z-side[1]+front[1]],[x+side[0],z+side[1]],room.spawn];
 const point=spots.find(([px,pz])=>roomAt(px,pz)===room.id&&!blocked(px,pz,.25,house.solids)&&Math.hypot(px-x,pz-z)>1.5)||room.spawn;
 const from=camera.position.clone();setOverview(false);player={x:point[0],z:point[1]};yaw=Math.atan2(x-player.x,-(z-player.z));pitch=Math.atan2((resident.archetype==='animal'?.85:resident.seated?1.20:1.40)-1.64,Math.hypot(x-player.x,z-player.z));transition={from,at:performance.now()};updateRoom(room.id);resize();send('resident',{id:resident.id,room:room.id});
}
function focusEvolution(){setOverview(true);inspection=true;orbit=.58;elevation=.58;updateRoom('games');resize();}
function applyCreative(value,source='coordinator'){
 if(!house)return;const result=house.setCreativeState(value);
 if(result.accepted){creativeState=value;creativeSource=source;}
 send('creative',{value:{...result,source:creativeSource}});
}
function interact(){if(!overview)send('interact',{room:currentRoom});}
function resize(){if(!renderer)return;const width=innerWidth,height=innerHeight;camera.aspect=width/height;camera.fov=overview?46:(width<height?67:58);camera.updateProjectionMatrix();renderer.setSize(width,height,false);}
function cameraFrame(time){
 const p=camera.position;
 if(overview){const distance=erasMode?Math.max(16,18/camera.aspect):inspection?Math.max(11,8/camera.aspect):Math.max(42,31/camera.aspect),angle=recording?captureAngle+(time-recordStart)*.00013:orbit;const y=Math.sin(elevation)*distance,z=Math.cos(elevation)*distance;target.set(erasMode?0:inspection?7.8:0,erasMode?0:inspection?1.05:.3,erasMode?0:inspection?10.35:-3.6);p.set(target.x+Math.sin(angle)*z,target.y+y,target.z+Math.cos(angle)*z);}
 else{const desired=new THREE.Vector3(player.x,1.64,player.z);if(transition){const progress=Math.min(1,(time-transition.at)/600),smooth=progress*progress*(3-2*progress);p.lerpVectors(transition.from,desired,smooth);if(progress===1)transition=null;}else p.copy(desired);const lookYaw=yaw+(recording?Math.sin((time-recordStart)*.0004)*.16:0);target.set(p.x+Math.sin(lookYaw)*Math.cos(pitch),p.y+Math.sin(pitch),p.z-Math.cos(lookYaw)*Math.cos(pitch));}
 camera.lookAt(target);
}
function renderNow(time){if(!renderer||!house)return;cameraFrame(time);house.update(time/1000,camera,innerHeight);renderer.render(house.scene,camera);}
function clearErasScene(){
 if(!erasScene)return;
 erasScene.traverse(object=>{
  object.geometry?.dispose?.();
  if(Array.isArray(object.material))object.material.forEach(material=>material.dispose?.());
  else object.material?.dispose?.();
 });
 erasScene.parent?.remove(erasScene);erasScene=null;
}
function setErasManifest(manifest){
 const graph=atlasErasManifestToSceneGraph(manifest);
 const objects=new Map(),root=new THREE.Group();
 root.add(new THREE.AmbientLight(0xffffff,.85));
 const light=new THREE.DirectionalLight(0xffffff,1.5);light.position.set(6,12,8);root.add(light);
 objects.set('eras-root',root);
 for(const node of graph.nodes.slice(1)){
  const object=node.type==='group'?new THREE.Group():new THREE.Mesh(
   node.primitive==='tree'?new THREE.ConeGeometry(.45,1.8,7):new THREE.DodecahedronGeometry(.55,0),
   new THREE.MeshStandardMaterial({color:node.primitive==='tree'?0x568b62:0x858b8a,roughness:.9})
  );
  object.position.set(...node.position);object.rotation.set(...node.rotation);object.scale.set(...node.scale);
  const parent=objects.get(node.parent);if(!parent)throw Error('Missing ERAS scene parent');
  parent.add(object);objects.set(node.id,object);
 }
 clearErasScene();
 erasScene=root;house.scene.add(root);
 for(const child of house.scene.children)if(child!==erasScene)child.visible=false;
 erasMode=true;
 return graph.nodes.length;
}
function restoreHouseScene(){
 if(!erasMode)return;
 for(const child of house.scene.children)if(child!==erasScene)child.visible=true;
 clearErasScene();erasMode=false;
}
function screenshot(){renderNow(performance.now());return canvas.toDataURL('image/png');}
async function record(seconds=8){
 if(recording)throw Error('Ya hay una grabación en curso.');
 if(typeof canvas.captureStream!=='function'||typeof MediaRecorder==='undefined')throw Error('Este navegador no permite grabar el lienzo. Puedes exportar una imagen PNG.');
 const mime=['video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));if(!mime)throw Error('No hay un formato de vídeo compatible en este navegador.');
 const stream=canvas.captureStream(24),recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2500000}),chunks=[];
 recordStart=performance.now();captureAngle=orbit;recording=recorder;$('record-state').hidden=false;
 return new Promise((resolve,reject)=>{
  let timer;const cleanup=()=>{clearTimeout(timer);stream.getTracks().forEach(track=>track.stop());recording=null;$('record-state').hidden=true;};
  recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
  recorder.onerror=()=>{cleanup();reject(Error('El dispositivo no pudo completar la grabación.'));};
  recorder.onstop=()=>{cleanup();const blob=new Blob(chunks,{type:mime});if(!blob.size){reject(Error('No se capturaron fotogramas.'));return;}const url=URL.createObjectURL(blob);urls.add(url);resolve({url,mime,filename:'atlas-casa-3d.'+(mime.startsWith('video/mp4')?'mp4':'webm'),bytes:blob.size,method:'Captura del entorno 3D renderizado; no vídeo neuronal.'});};
  recorder.start(250);timer=setTimeout(()=>{if(recorder.state!=='inactive')recorder.stop();},Math.max(2,Math.min(16,Number(seconds)||8))*1000);
 });
}
function tick(now){
 if(disposed)return;frame=requestAnimationFrame(tick);
 const rawDelta=last?Math.max(0,(now-last)/1000):0,delta=Math.min(.045,rawDelta);last=now;
 if(document.hidden||(paused&&!recording))return;
 if(!overview&&!recording){
  const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0)-stick.y;
  const side=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+stick.x;
  if(forward||side){transition=null;const {dx,dz}=navigationVector(yaw,forward,side,(keys.has('shift')?4.2:2.7)*delta);player=movePlayer(player,dx,dz,{walls:house.solids});const id=roomAt(player.x,player.z);if(id)updateRoom(id);}
 }
 renderNow(now);frames++;elapsed+=rawDelta;
 if(elapsed>=1.2)updateProcessLegend();
 if(elapsed>=1.2){const fps=frames/elapsed;$('fps').textContent=Math.round(fps)+' FPS';canvas.dataset.frames=String(Number(canvas.dataset.frames||0)+frames);send('performance',{fps:Math.round(fps),frames:Number(canvas.dataset.frames),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,backend:'WebGL2'});if(fps<24){lowFrames++;if(lowFrames>=3&&renderer.getPixelRatio()>.85){renderer.setPixelRatio(Math.max(.85,renderer.getPixelRatio()*.85));resize();lowFrames=0;}}else lowFrames=0;frames=0;elapsed=0;}
 if(!ready){ready=true;$('boot').hidden=true;canvas.dataset.ready='true';reportReady();}
}
function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);if(recording?.state!=='inactive')recording?.stop();joystick?.destroy();callbacks.forEach(remove=>remove());clearErasScene();house?.dispose();renderer?.dispose();renderer?.forceContextLoss();for(const url of urls)URL.revokeObjectURL(url);urls.clear();}
for(const room of ROOMS){const button=document.createElement('button');button.type='button';button.dataset.room=room.id;button.textContent=room.short;button.setAttribute('aria-label','Ir a '+room.title);button.setAttribute('aria-pressed','false');listen(button,'click',()=>teleport(room.id));$('roomnav').append(button);}
listen($('overview'),'click',()=>{setOverview(true);resize();});listen($('walk'),'click',()=>{teleport(currentRoom);resize();});listen($('interact'),'click',interact);listen($('retry'),'click',()=>location.reload());
listen(window,'resize',resize);
listen(canvas,'pointerdown',event=>{if(drag||event.button>0)return;canvas.focus();canvas.setPointerCapture(event.pointerId);drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false};});
listen(canvas,'pointermove',event=>{if(!drag||drag.id!==event.pointerId||paused)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>6)drag.moved=true;drag.x=event.clientX;drag.y=event.clientY;if(overview){orbit-=dx*.006;elevation=Math.max(.4,Math.min(1.1,elevation+dy*.004));}else{yaw-=dx*.005;pitch=Math.max(-.9,Math.min(.9,pitch-dy*.004));}transition=null;});
listen(canvas,'pointerup',event=>{if(!drag||drag.id!==event.pointerId)return;const clicked=!drag.moved;drag=null;if(clicked&&house&&!paused){raycaster.setFromCamera(new THREE.Vector2(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1),camera);const hit=raycaster.intersectObjects(house.interactive,false)[0];if(hit){const id=hit.object.userData.room;if(!overview&&currentRoom===id)interact();else{teleport(id);resize();}}}});
for(const type of ['pointercancel','lostpointercapture'])listen(canvas,type,()=>drag=null);
listen(document,'keydown',event=>{const key=event.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))event.preventDefault();if(paused)return;if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)&&overview){teleport(currentRoom);resize();}keys.add(key);if(key==='e'&&!event.repeat)interact();if(key==='h'&&!event.repeat){setOverview(!overview);resize();}});
listen(document,'keyup',event=>keys.delete(event.key.toLowerCase()));listen(window,'blur',()=>{keys.clear();joystick?.reset();drag=null;});listen(document,'visibilitychange',()=>{last=0;keys.clear();joystick?.reset();drag=null;});
listen(canvas,'webglcontextlost',event=>{event.preventDefault();paused=true;fail('El contexto gráfico se ha perdido. Recarga el entorno para continuar; tus herramientas siguen disponibles.');});
listen(window,'message',async event=>{
 if(event.source!==parent||event.origin!==location.origin||!event.data||typeof event.data!=='object')return;
 const message=event.data;
 if(message.type==='atlas:house:hello'&&ready){reportReady();}
 if(message.type==='atlas:house:teleport'){teleport(message.room);resize();}
 if(message.type==='atlas:house:resident'){focusResident(message.id);}
 if(message.type==='atlas:house:evolution'){focusEvolution();}
 if(message.type==='atlas:house:creative'){applyCreative(message.value);}
 if(message.type==='atlas:house:overview'){setOverview(true);resize();}
 if(message.type==='atlas:house:eras-scene'){
  try{const nodes=setErasManifest(message.manifest);send('eras-scene',{status:'applied',nodes});}
  catch(error){send('eras-scene',{status:'rejected',message:error instanceof Error?error.message:'Invalid ERAS scene'});}
 }
 if(message.type==='atlas:house:house-scene'){restoreHouseScene();send('eras-scene',{status:'house_restored'});}
 if(message.type==='atlas:house:pause'){paused=message.value===true;keys.clear();joystick?.reset();drag=null;last=0;}
 if(message.type==='atlas:house:processes'){processState=normalizeProcessState(message.value);processReceivedAt=performance.now();house?.setProcessState(processState);updateProcessLegend();}
 if(message.type==='atlas:house:revoke'&&urls.has(message.url)){URL.revokeObjectURL(message.url);urls.delete(message.url);}
 if(message.type==='atlas:house:destroy'){dispose();}
 if(message.type==='atlas:house:capture'||message.type==='atlas:house:record'){
  if(!ready){send('result',{requestId:message.requestId,error:'El entorno todavía no está listo.'});return;}
  try{const result=message.type==='atlas:house:capture'?screenshot():await record(message.seconds);send('result',{requestId:message.requestId,result});}catch(error){send('result',{requestId:message.requestId,error:error.message||'No se pudo exportar.'});}
 }
});
listen(window,'pagehide',dispose);
try{
 const engine=await createRenderEngine(canvas,{gpu:null});renderer=engine.renderer;renderer.setPixelRatio(Math.min(devicePixelRatio||1,touch?1.35:1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 house=buildHouse();house.setProcessState(processState);
 void fetch('./initial-creative.json',{cache:'no-cache'}).then(response=>response.ok?response.json():null).then(value=>applyCreative(value,'retained')).catch(()=>{});
setOverview(true);resize();joystick=new CircularJoystick($('joystick'),{enabled:()=>!paused&&!overview,onChange:value=>{stick=value;$('joystick').setAttribute('aria-valuenow',String(Math.round(value.strength*100)));}});frame=requestAnimationFrame(tick);
}catch(error){fail('No ha sido posible iniciar WebGL 2 en este navegador. Abre Atlas en Safari o Chrome y vuelve a intentarlo.');console.error('Atlas house renderer:',error);}
