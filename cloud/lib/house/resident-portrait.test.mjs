import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {RESIDENTS} from '../../public/house/residents.js';
import {residentAppearance} from '../../public/house/resident-appearance.js';
import {roomAt} from '../../public/house/layout.js';
import {capturePortrait4k,portraitView} from '../../public/house/resident-portrait.js';

test('every human workstation admits a front-facing portrait in its own room',()=>{
 for(const actor of RESIDENTS.filter(actor=>actor.archetype==='human')){
  const view=portraitView({...actor,height:residentAppearance(actor.id).height},actor.position);
  assert.ok(view,actor.id);
  assert.equal(roomAt(view.camera[0],view.camera[2]),roomAt(actor.position[0],actor.position[2]),actor.id);
  const [x,,z]=actor.position;
  const forward=(view.camera[0]-x)*Math.sin(actor.yaw)-(view.camera[2]-z)*Math.cos(actor.yaw);
  assert.ok(forward>.4,actor.id);
 }
});

test('the capture encodes a UHD frame and restores the screen on success and failure',()=>{
 const camera={aspect:.66,updateProjectionMatrix(){}},sizes=[];
 let width=501,height=759,ratio=1.35,limit=false;
 const context={MAX_VIEWPORT_DIMS:0,getParameter:()=>[4096,4096],get drawingBufferWidth(){return limit?2048:Math.floor(width*ratio);},get drawingBufferHeight(){return Math.floor(height*ratio);}};
 const canvas={toDataURL(type){assert.equal(type,'image/png');assert.deepEqual([width,height,ratio],[3840,2160,1]);return 'data:image/png;base64,iVBORw0KGgo=';}};
 const renderer={capabilities:{maxTextureSize:4096},getContext:()=>context,getSize:target=>target.set(width,height),getPixelRatio:()=>ratio,setPixelRatio:value=>{ratio=value;},setSize(w,h){width=w;height=h;},render(){sizes.push([width,height,ratio,camera.aspect]);}};
 assert.match(capturePortrait4k(renderer,{},camera,canvas),/^data:image\/png/);
 assert.deepEqual(sizes,[[3840,2160,1,16/9],[501,759,1.35,.66]]);
 limit=true;
 assert.throws(()=>capturePortrait4k(renderer,{},camera,canvas),/reducido la resolución/);
 assert.deepEqual([width,height,ratio,camera.aspect],[501,759,1.35,.66]);
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
