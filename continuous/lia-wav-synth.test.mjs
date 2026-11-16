import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLiaArrangement} from './lia-music-arrangement.mjs';
import {renderLiaArrangementWav} from './lia-wav-synth.mjs';
test('render real deterministic PCM WAV with audio samples',()=>{
 const a=compileLiaArrangement({id:'theme',title:'Theme',bpm:120,tracks:[
  {id:'lead',program:0,notes:[{pitch:69,startBeat:0,durationBeats:1,velocity:100}]}]});
 const wav=renderLiaArrangementWav(a);
 assert.equal(wav.toString('ascii',0,4),'RIFF');
 assert.equal(wav.toString('ascii',8,12),'WAVE');
 assert.equal(wav.readUInt32LE(24),22050);
 assert.equal(wav.length,44+22050);
 assert.deepEqual(renderLiaArrangementWav(a),wav);
 assert.ok(wav.subarray(44).some(x=>x!==0));
});
test('reject unbounded audio and bad rates',()=>{
 const a=compileLiaArrangement({id:'theme',title:'Theme',bpm:30,tracks:[
  {id:'lead',program:0,notes:[{pitch:60,startBeat:0,durationBeats:100,velocity:90}]}]});
 assert.throws(()=>renderLiaArrangementWav(a));
 assert.throws(()=>renderLiaArrangementWav(a,{sampleRate:100}));
});
