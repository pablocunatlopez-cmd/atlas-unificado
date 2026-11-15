import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasErasAudioRuntime} from './atlas-eras-audio-runtime.mjs';
test('synchronizes ERAS emitters with Web Audio and cleans up',()=>{
 const make=()=>({connect(){},disconnect(){}});
 const ctx={destination:{},createGain:()=>({...make(),gain:{value:0}}),
  createPanner:()=>({...make(),positionX:{value:0},positionY:{value:0},positionZ:{value:0}})};
 const runtime=createAtlasErasAudioRuntime({audioContext:ctx});
 assert.equal(runtime.sync({listener:[0,0,0],emitters:[{id:'wind',position:[3,0,0],gain:1}]}).activeEmitters,1);
 assert.equal(runtime.getEmitterInput('wind').positionX.value,3);
 runtime.dispose();
 assert.throws(()=>runtime.sync({listener:[0,0,0],emitters:[]}),/disposed/);
});
