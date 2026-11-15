// Run: node --experimental-vm-modules tests/atlas-eras-runtime.test.mjs
// Real scene validation, Three meshes and lighting; only browser/GPU boundaries
// are replaced. These tests do not establish visual quality or GPU compatibility.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as THREE from '../public/eras-engine/vendor/three.module.js';
import {qualityProfile,skyMaterial} from '../public/eras-engine/graphics.js';
import * as cinematography from '../public/eras-engine/cinematography.js';
import * as adapter from '../public/eras-engine/scene-adapter.js';
import * as contract from '../public/eras-engine/scene-document.js';

const origin='https://atlas.test';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function scene(title='Escena A'){return{brief:{title,mode:'3d',lighting:'sunset'},materials:[{color:[.7,.4,.2],roughness:.25,metalness:.65,emission:0}],objects:[{type:'cylinder',position:[1,2,0],size:[1,2,.5],material:0,yaw:.2,name:'Columna'}],camera:[12,8,14],target:[3,1,0],sky:[.6,.35,.2],sun:[-.8,.2,.3],fog:.002,exposure:1.1};}
class Target{
 listeners=new Map();
 addEventListener(name,callback){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(callback);}
 removeEventListener(name,callback){this.listeners.get(name)?.delete(callback);}
 dispatch(name,event={}){for(const callback of this.listeners.get(name)||[])callback(event);}
}
async function fixture({backend='WebGL2',initialFailure=false,delayedInitialization=false}={}){
 assert.equal(typeof vm.SourceTextModule,'function','Use --experimental-vm-modules for runtime integration.');
 const canvas=Object.assign(new Target(),{clientWidth:640,clientHeight:360,dataset:{},focus(){},setPointerCapture(){},toDataURL:()=> 'data:image/png;base64,test-capture'});
 const elements={scene:canvas,status:{textContent:'',className:''},backend:{textContent:'',title:''},title:{textContent:''}},document=Object.assign(new Target(),{hidden:false,getElementById:id=>elements[id]});
 const messages=[],parent={postMessage:(value,targetOrigin)=>messages.push({value,targetOrigin})},window=Object.assign(new Target(),{parent});
 const calls={draws:[],prepared:[],pipelines:[],pmrems:[],builds:0,released:0,rendererDisposals:0,ratios:[],failNextDraw:false},frames=new Map();let frameId=0,ratio=1;
 let releaseInitialization;const initializedGate=delayedInitialization?new Promise(resolve=>releaseInitialization=resolve):Promise.resolve();
 const renderer={shadowMap:{},setPixelRatio:value=>{ratio=value;calls.ratios.push(value);},getPixelRatio:()=>ratio,setSize(){},dispose:()=>calls.rendererDisposals++};
 class Pipeline{
  constructor(){this.material={uniforms:{warmth:{value:0},aerialDensity:{value:0},aerialColor:{value:new THREE.Color()}}};calls.pipelines.push(this);}
  resize(w,h){this.size=[w,h];}
  setQuality(profile){this.profile=profile;}
  render(scene,camera){if(calls.failNextDraw){calls.failNextDraw=false;throw Error('GPU boundary failure');}calls.draws.push({scene,camera,position:camera.position.toArray()});}
  dispose(){calls.released++;}
 }
 class PMREM{
  constructor(){calls.pmrems.push(this);}
  fromScene(){return{texture:new THREE.Texture(),dispose(){}};}
  dispose(){}
 }
 const engine={renderer,backend,reason:backend==='WebGL2'?'Modo compatible':'',PMREMGenerator:PMREM,prepare:s=>calls.prepared.push(s),createPipeline:()=>new Pipeline()};
 const context=vm.createContext({document,window,parent,location:{origin},matchMedia:()=>({matches:false}),innerWidth:1000,devicePixelRatio:3,console,performance,requestAnimationFrame:callback=>{const id=++frameId;frames.set(id,callback);return id;},cancelAnimationFrame:id=>frames.delete(id)});
 const dependencies={
  './vendor/three.module.js':THREE,
  './render-engine.js':{createRenderEngine:async()=>{await initializedGate;if(initialFailure)throw Error('No GPU context');return engine;}},
  './graphics.js':{FilmPipeline:Pipeline,qualityProfile,skyMaterial},
  './cinematography.js':cinematography,'./scene-adapter.js':{...adapter,buildErasScene:raw=>{calls.builds++;return adapter.buildErasScene(raw);}},'./scene-document.js':contract
 };
 const source=await readFile(new URL('../public/eras-engine/runtime.js',import.meta.url),'utf8'),module=new vm.SourceTextModule(source,{context,identifier:'eras-runtime'});
 await module.link(async specifier=>{const exports=dependencies[specifier];assert.ok(exports,'Unknown dependency '+specifier);const keys=Object.keys(exports);return new vm.SyntheticModule(keys,function(){for(const key of keys)this.setExport(key,exports[key]);},{context});});
 await module.evaluate();await tick();
 const send=async(data,overrides={})=>{window.dispatch('message',{source:parent,origin,data,...overrides});await tick();};
 const output=type=>messages.filter(m=>m.value.type===type).map(m=>m.value);
 const cleanup=()=>window.dispatch('pagehide');
 return{canvas,elements,document,window,parent,calls,messages,send,output,cleanup,frames,renderer,releaseInitialization:async()=>{releaseInitialization?.();await tick();}};
}

test('same-origin parent loads real physical scene and sees the actual renderer backend',async t=>{
 const f=await fixture();t.after(f.cleanup);assert.equal(f.output('ready').length,1);assert.equal(f.output('ready')[0].backend,'WebGL2');assert.ok(f.messages.every(m=>m.targetOrigin===origin));
 await f.send({type:'atlas:eras:load',requestId:'load-a',scene:scene()});const loaded=f.output('loaded')[0];assert.equal(loaded.requestId,'load-a');assert.equal(loaded.backend,'WebGL2');assert.equal(loaded.objects,1);assert.ok(loaded.triangles>0);
 const draw=f.calls.draws.at(-1),mesh=draw.scene.getObjectByName('Columna');assert.equal(mesh.material.type,'MeshStandardMaterial');assert.equal(mesh.material.metalness,.65);assert.deepEqual(mesh.position.toArray(),[1,2,0]);assert.ok(f.calls.ratios.every(value=>value<=1.5));assert.equal(draw.camera.aspect,640/360);
});
test('wrong source and origin cannot load or snapshot the scene',async t=>{
 const f=await fixture();t.after(f.cleanup);await f.send({type:'atlas:eras:load',requestId:'foreign',scene:scene()},{source:{}});await f.send({type:'atlas:eras:snapshot',requestId:'foreign-snapshot'},{origin:'https://other.test'});assert.equal(f.output('loaded').length,0);assert.equal(f.output('snapshot').length,0);assert.equal(f.calls.draws.length,0);
});
test('invalid replacement preserves the prior scene and still allows a snapshot',async t=>{
 const f=await fixture();t.after(f.cleanup);await f.send({type:'atlas:eras:load',requestId:'a',scene:scene()});const original=f.calls.draws.at(-1).scene,mesh=original.getObjectByName('Columna');let disposed=false;mesh.geometry.addEventListener('dispose',()=>disposed=true);
 const bad=scene('Inválida');bad.objects[0].size[1]=Infinity;await f.send({type:'atlas:eras:load',requestId:'bad',scene:bad});assert.equal(f.output('error').at(-1).requestId,'bad');assert.equal(f.output('loaded').length,1);assert.equal(disposed,false);
 await f.send({type:'atlas:eras:snapshot',requestId:'image-a'});assert.equal(f.output('snapshot').at(-1).requestId,'image-a');assert.equal(f.output('snapshot').at(-1).data,'data:image/png;base64,test-capture');assert.equal(f.calls.draws.at(-1).scene,original);
});
test('render failure during replacement restores the prior scene and camera before releasing the candidate',async t=>{
 const f=await fixture();t.after(f.cleanup);await f.send({type:'atlas:eras:load',requestId:'a',scene:scene()});const original=f.calls.draws.at(-1),originalPosition=[...original.position];let disposed=false;original.scene.getObjectByName('Columna').geometry.addEventListener('dispose',()=>disposed=true);
 const next=scene('Escena fallida');next.camera=[-20,4,8];f.calls.failNextDraw=true;await f.send({type:'atlas:eras:load',requestId:'failed-render',scene:next});assert.match(f.output('error').at(-1).message,/GPU boundary failure/);assert.equal(f.output('loaded').length,1);assert.equal(disposed,false);assert.ok(f.calls.released>=1);
 await f.send({type:'atlas:eras:snapshot',requestId:'still-a'});const restored=f.calls.draws.at(-1);assert.equal(restored.scene,original.scene);assert.deepEqual(restored.position.map(n=>Math.round(n*1e8)),originalPosition.map(n=>Math.round(n*1e8)));assert.equal(f.output('snapshot').at(-1).requestId,'still-a');
});
test('pause suppresses frame rendering, reset restores the view, and disposal removes handlers',async()=>{
 const f=await fixture();await f.send({type:'atlas:eras:load',requestId:'a',scene:scene()});await f.send({type:'atlas:eras:pause',value:true});const before=f.calls.draws.length;const callback=[...f.frames.values()].at(-1);callback(1000);assert.equal(f.calls.draws.length,before);
 await f.send({type:'atlas:eras:reset'});await f.send({type:'atlas:eras:dispose'});assert.equal(f.calls.rendererDisposals,1);assert.equal(f.window.listeners.get('message')?.size,0);assert.equal(f.canvas.listeners.get('pointermove')?.size,0);const messages=f.messages.length;await f.send({type:'atlas:eras:load',requestId:'after-dispose',scene:scene()});assert.equal(f.messages.length,messages);
});
test('renderer initialization failure reports an error and never advertises a backend as ready',async t=>{
 const f=await fixture({initialFailure:true});t.after(f.cleanup);assert.equal(f.output('ready').length,0);assert.equal(f.output('error').length,1);assert.equal(f.output('error')[0].backend,null);assert.match(f.output('error')[0].message,/No GPU context/);
 await f.send({type:'atlas:eras:load',requestId:'without-engine',scene:scene()});assert.equal(f.output('loaded').length,0);assert.equal(f.output('error').at(-1).requestId,'without-engine');assert.equal(f.calls.draws.length,0);
});


test('completed load retries replay the receipt without rebuilding, drawing or releasing the active scene',async t=>{
 const f=await fixture();t.after(f.cleanup);const data={type:'atlas:eras:load',requestId:'stable-revision',scene:scene()};await f.send(data);const first=f.output('loaded')[0],before={builds:f.calls.builds,draws:f.calls.draws.length,pipelines:f.calls.pipelines.length,released:f.calls.released};
 await f.send(structuredClone(data));await f.send(structuredClone(data));assert.equal(f.output('loaded').length,3);assert.deepEqual(f.output('loaded').at(-1),first);assert.deepEqual({builds:f.calls.builds,draws:f.calls.draws.length,pipelines:f.calls.pipelines.length,released:f.calls.released},before);
});
test('a request ID cannot replace its completed scene with different scene data',async t=>{
 const f=await fixture();t.after(f.cleanup);await f.send({type:'atlas:eras:load',requestId:'same-id',scene:scene()});const original=f.calls.draws.at(-1).scene,before={builds:f.calls.builds,pipelines:f.calls.pipelines.length,released:f.calls.released};
 const changed=scene();changed.objects[0].position[0]=9;await f.send({type:'atlas:eras:load',requestId:'same-id',scene:changed});assert.equal(f.output('loaded').length,1);assert.equal(f.output('error').at(-1).requestId,'same-id');assert.match(f.output('error').at(-1).message,/identificador|solicitud|request|conflict/i);assert.deepEqual({builds:f.calls.builds,pipelines:f.calls.pipelines.length,released:f.calls.released},before);
 await f.send({type:'atlas:eras:snapshot',requestId:'after-conflict'});assert.equal(f.calls.draws.at(-1).scene,original);
});
test('pending retries during slow initialization build and load the canonical scene only once',async t=>{
 const f=await fixture({delayedInitialization:true});t.after(f.cleanup);assert.equal(f.output('ready').length,0);const data={type:'atlas:eras:load',requestId:'slow-revision',scene:scene()};await f.send(data);await f.send(structuredClone(data));await f.send(structuredClone(data));assert.ok(f.calls.builds<=1);assert.equal(f.calls.pipelines.length,0);assert.equal(f.output('loaded').length,0);
 await f.releaseInitialization();assert.equal(f.output('ready').length,1);assert.equal(f.calls.builds,1);assert.equal(f.calls.pipelines.length,1);assert.equal(f.calls.draws.length,1);assert.equal(f.calls.released,0);assert.equal(f.output('loaded').length,1);assert.equal(f.output('loaded')[0].requestId,'slow-revision');
 await f.send(structuredClone(data));assert.equal(f.calls.builds,1);assert.equal(f.calls.pipelines.length,1);assert.equal(f.calls.draws.length,1);assert.equal(f.output('loaded').length,2);
});
