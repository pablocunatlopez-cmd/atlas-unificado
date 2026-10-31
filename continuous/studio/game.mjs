import * as THREE from './vendor/three.module.js';
import {initial,step,walls,targets} from './logic.mjs';
const label=id=>document.getElementById(id);
try{
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#19252d');scene.fog=new THREE.Fog('#19252d',35,110);
const camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,180);
scene.add(new THREE.HemisphereLight(0xc4e3ff,0x705945,2.0));
const sun=new THREE.DirectionalLight(0xffd6a1,3.0);sun.position.set(-22,35,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-35,right:35,top:35,bottom:-35,far:100});sun.shadow.bias=-.0002;scene.add(sun);
const concrete=new THREE.MeshStandardMaterial({color:0x697778,roughness:.85}),gold=new THREE.MeshStandardMaterial({color:0xd6aa67,metalness:.75,roughness:.25}),dark=new THREE.MeshStandardMaterial({color:0x25333b,roughness:.65});
function box(x,y,z,w,h,d,material){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
box(0,-.5,0,52,1,52,concrete);
for(let x=-24;x<=24;x+=4)box(x,.015,0,.035,.025,48,dark);
for(let z=-24;z<=24;z+=4)box(0,.015,z,48,.025,.035,dark);
walls.forEach(w=>{box(w.x,2.5,w.z,w.w,5,w.d,concrete);box(w.x,5.02,w.z,w.w+.1,.12,w.d+.1,gold);});
for(let i=0;i<16;i++){const a=i*Math.PI/8;box(Math.cos(a)*39,5+(i%3)*2,Math.sin(a)*39,4,10+(i%3)*4,4,dark);}
const relics=targets.map(p=>{const m=new THREE.Mesh(new THREE.OctahedronGeometry(.7),new THREE.MeshStandardMaterial({color:0x86f5ff,emissive:0x2eaabb,emissiveIntensity:1.2,metalness:.6,roughness:.18}));m.position.set(p.x,1.5,p.z);scene.add(m);box(p.x,.3,p.z,1.8,.6,1.8,dark);return m;});
const portal=box(0,2.2,-22,3.5,4.4,.3,new THREE.MeshStandardMaterial({color:0x54717c,emissive:0x002028,emissiveIntensity:1}));box(-2,2.6,-22,.5,5.2,.7,gold);box(2,2.6,-22,.5,5.2,.7,gold);box(0,5.1,-22,4.5,.5,.7,gold);
const player=new THREE.Group();const body=new THREE.Mesh(new THREE.CapsuleGeometry(.4,.85,4,12),gold);body.position.y=1;body.castShadow=true;player.add(body);scene.add(player);
let state=initial(),keys={},last=performance.now(),frames=0;
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys[e.key.toLowerCase()]=true;if(e.key.toLowerCase()==='r')state=initial();});window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);window.addEventListener('blur',()=>keys={});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');label('device').textContent='WebGL · '+(debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'renderizador disponible');
function frame(now){const dt=(now-last)/1000;last=now;state=step(state,{up:keys.w||keys.arrowup,down:keys.s||keys.arrowdown,left:keys.a||keys.arrowleft,right:keys.d||keys.arrowright,sprint:keys.shift},dt);player.position.set(state.x,0,state.z);camera.position.lerp(new THREE.Vector3(state.x+10,15,state.z+15),.08);camera.lookAt(state.x,0,state.z-3);relics.forEach((m,i)=>{m.visible=!state.collected.includes(i);m.rotation.y=now*.001;m.position.y=1.5+Math.sin(now*.002+i)*.2;});portal.material.emissive.setHex(state.collected.length===5?0x32ffbb:0x002028);label('score').textContent=state.won?'Objetivo completado. R para reiniciar.':`Núcleos ${state.collected.length}/5 · ${Math.floor(state.time)} s`;renderer.render(scene,camera);frames++;renderer.domElement.dataset.frames=String(frames);renderer.domElement.dataset.playerX=state.x.toFixed(3);renderer.domElement.dataset.playerZ=state.z.toFixed(3);requestAnimationFrame(frame);}requestAnimationFrame(frame);
document.getElementById('test').onclick=async()=>{label('tests').textContent='Ejecutando…';try{const home=await(await fetch('/')).text();const token=home.match(/const token='([^']+)'/)[1];const r=await fetch('/tools/test-game',{method:'POST',headers:{'X-Atlas-Token':token}});const result=await r.json();label('tests').textContent=result.output||result.error;}catch(e){label('tests').textContent=e.message;}};
}catch(error){label('error').textContent='No se pudo inicializar el juego: '+error.message;}
