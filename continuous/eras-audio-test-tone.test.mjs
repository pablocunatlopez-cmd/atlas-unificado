import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createErasAudioTestTone} from './eras-audio-test-tone.mjs';
test('starts only on explicit call and stops oscillator',()=>{
 const calls=[];
 const oscillator={frequency:{value:0},connect:()=>calls.push('connect'),
  start:()=>calls.push('start'),stop:()=>calls.push('stop'),
  disconnect:()=>calls.push('disconnect')};
 const tone=createErasAudioTestTone({audioContext:{createOscillator:()=>oscillator},
  emitterInput:{connect(){}}});
 assert.deepEqual(calls,[]);
 assert.equal(tone.start().started,true);
 assert.deepEqual(calls,['connect','start']);
 tone.stop();
 assert.deepEqual(calls,['connect','start','stop','disconnect']);
 assert.throws(()=>tone.start());
});
