import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasErasFrameCoordinator} from './atlas-eras-frame-coordinator.mjs';
test('updates audio before rendering each frame',()=>{
 const order=[];
 const c=createAtlasErasFrameCoordinator({
  visualRuntime:{frame:()=>order.push('visual')},
  audioRuntime:{syncScene:s=>{order.push('audio');return {activeEmitters:s.entities.length};}}
 });
 const r=c.frame({entities:[{}]});
 assert.deepEqual(order,['audio','visual']);
 assert.equal(r.frameCount,1);
 assert.equal(r.audio.activeEmitters,1);
 c.dispose();
 assert.throws(()=>c.frame({entities:[]}),/disposed/);
});
test('does not claim frame completion when rendering fails',()=>{
 const c=createAtlasErasFrameCoordinator({
  visualRuntime:{frame:()=>{throw Error('renderer unavailable');}},
  audioRuntime:{syncScene:()=>({activeEmitters:0})}
 });
 assert.throws(()=>c.frame({entities:[]}),/renderer unavailable/);
});
