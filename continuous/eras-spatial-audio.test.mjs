import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planErasSpatialAudio} from './eras-spatial-audio.mjs';
test('nearby audio is louder than distant audio',()=>{
 const p=planErasSpatialAudio({listener:[0,0,0],emitters:[
  {id:'near',position:[1,0,0],gain:1},
  {id:'far',position:[100,0,0],gain:1}]});
 assert.ok(p.sounds[0].effectiveGain>p.sounds[1].effectiveGain);
 assert.equal(p.gpuRequired,false);
 assert.equal(p.rendered,false);
});
test('rejects duplicate IDs and invalid positions',()=>{
 assert.throws(()=>planErasSpatialAudio({listener:[0,0,0],emitters:[
  {id:'x',position:[0,0,0],gain:1},{id:'x',position:[1,0,0],gain:1}]}));
 assert.throws(()=>planErasSpatialAudio({listener:[NaN,0,0]}));
});
