import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createErasWebAudioBridge} from './eras-web-audio-bridge.mjs';
import {planErasSpatialAudio} from './eras-spatial-audio.mjs';
test('creates, updates and disposes Web Audio spatial emitters',()=>{
 let disconnected=0;
 const make=()=>({connect(){},disconnect(){disconnected++;}});
 const ctx={destination:{},createGain:()=>({...make(),gain:{value:0}}),
  createPanner:()=>({...make(),positionX:{value:0},positionY:{value:0},positionZ:{value:0}})};
 const bridge=createErasWebAudioBridge({audioContext:ctx});
 const scene=planErasSpatialAudio({listener:[0,0,0],emitters:[
  {id:'water',position:[2,1,0],gain:0.8}]});
 assert.equal(bridge.sync(scene).activeEmitters,1);
 assert.equal(bridge.getInput('water').positionX.value,2);
 assert.equal(bridge.sync(planErasSpatialAudio({listener:[0,0,0]})).activeEmitters,0);
 assert.equal(bridge.getInput('water'),null);
 assert.equal(disconnected,2);
 bridge.dispose();
});
test('rejects invalid scene without creating audio nodes',()=>{
 let created=0;
 const ctx={destination:{},createGain:()=>{created++;return {};},createPanner:()=>({})};
 const bridge=createErasWebAudioBridge({audioContext:ctx});
 assert.throws(()=>bridge.sync({engine:'web-audio',sounds:[{id:'x',position:[NaN,0,0],effectiveGain:1}]}));
 assert.equal(created,0);
});
