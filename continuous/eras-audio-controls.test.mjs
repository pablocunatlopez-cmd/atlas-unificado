import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createErasAudioControls} from './eras-audio-controls.mjs';
test('sound remains disabled until explicit enable',async()=>{
 let resumed=0,suspended=0,synced=0;
 const c=createErasAudioControls({audioContext:{
  resume:async()=>{resumed++;},suspend:async()=>{suspended++;}},
  audioRuntime:{syncScene:()=>{synced++;return {activeEmitters:1};}}});
 assert.equal(c.syncScene({}).skipped,true);
 assert.equal(synced,0);
 await c.enable();
 assert.equal(resumed,1);
 assert.equal(c.syncScene({}).activeEmitters,1);
 await c.disable();
 assert.equal(suspended,1);
 assert.equal(c.syncScene({}).skipped,true);
 c.dispose();
 await assert.rejects(c.enable());
});
