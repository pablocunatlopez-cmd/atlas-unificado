import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {RESIDENTS} from '../../public/house/residents.js';
import {residentAppearance} from '../../public/house/resident-appearance.js';
import {roomAt} from '../../public/house/layout.js';
import {capturePortrait4k,portraitScreenFov,portraitView} from '../../public/house/resident-portrait.js';
import {buildHouse} from '../../public/house/scene.js';

test('every human workstation admits face and torso portraits with a clear line through the furnished house',t=>{
 const previousDocument=globalThis.document;
 const ctx=new Proxy({},{get:()=>()=>{},set:()=>true});
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
 t.after(()=>{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;});
 const house=buildHouse();t.after(()=>house.dispose());
 for(const actor of RESIDENTS.filter(actor=>actor.archetype==='human')){
  const resident={...actor,height:residentAppearance(actor.id).height};
  const [x,,z]=actor.position,obstacles=house.portraitObstacles;
  const face=portraitView(resident,actor.position,{obstacles}),torso=portraitView(resident,actor.position,{framing:'torso',obstacles});
  for(const [framing,view] of [['face',face],['torso',torso]]){
   assert.ok(view,`${actor.id} ${framing}`);
   assert.equal(roomAt(view.camera[0],view.camera[2]),roomAt(x,z),actor.id);
   const forward=(view.camera[0]-x)*Math.sin(actor.yaw)-(view.camera[2]-z)*Math.cos(actor.yaw);
   assert.ok(forward>.4,actor.id);
  }
  assert.ok(face.target[1]-torso.target[1]>.1,actor.id);
 }
});

test('the capture encodes a UHD frame and restores the screen on success and failure',async()=>{
 const camera={aspect:.66,fov:portraitScreenFov(.66),updateProjectionMatrix(){}},sizes=[];
 const screenFov=camera.fov;
 assert.ok(screenFov>44);
 let width=501,height=759,ratio=1.35,limit=false,encodingFailed=false;
 const context={MAX_VIEWPORT_DIMS:0,getParameter:()=>[4096,4096],get drawingBufferWidth(){return limit?2048:Math.floor(width*ratio);},get drawingBufferHeight(){return Math.floor(height*ratio);}};
 const canvas={toBlob(complete,type){assert.equal(type,'image/png');assert.deepEqual([width,height,ratio],[3840,2160,1]);queueMicrotask(()=>complete(encodingFailed?null:new Blob(['png'],{type})));}};
 const renderer={capabilities:{maxTextureSize:4096},getContext:()=>context,getSize:target=>target.set(width,height),getPixelRatio:()=>ratio,setPixelRatio:value=>{ratio=value;},setSize(w,h){width=w;height=h;},render(){sizes.push([width,height,ratio,camera.aspect,camera.fov]);}};
 const pending=capturePortrait4k(renderer,{},camera,canvas);
 assert.deepEqual(sizes,[[3840,2160,1,16/9,35],[501,759,1.35,.66,screenFov]]);
 assert.equal((await pending).type,'image/png');
 encodingFailed=true;
 await assert.rejects(capturePortrait4k(renderer,{},camera,canvas),/exportar el PNG/);
 limit=true;
 assert.throws(()=>capturePortrait4k(renderer,{},camera,canvas),/reducido la resolución/);
 assert.deepEqual([width,height,ratio,camera.aspect,camera.fov],[501,759,1.35,.66,screenFov]);
});

test('all four supplied skin maps are 4096-square and match their provenance',async()=>{
 const dir=new URL('../../public/house/assets/models/ultra/',import.meta.url);
 const provenance=JSON.parse(await readFile(new URL('provenance.json',dir),'utf8'));
 for(const sex of ['female','male'])for(const channel of ['skin','normal']){
  const name=`${sex}-${channel}.webp`,bytes=await readFile(new URL(name,dir));
  assert.equal(bytes.toString('ascii',12,16),'VP8 ');
  assert.equal(bytes.readUInt16LE(26)&0x3fff,4096);
  assert.equal(bytes.readUInt16LE(28)&0x3fff,4096);
  assert.ok(JSON.stringify(provenance).includes(createHash('sha256').update(bytes).digest('hex')),name);
 }
});
