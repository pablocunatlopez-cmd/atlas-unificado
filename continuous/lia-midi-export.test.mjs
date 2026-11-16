import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLiaArrangement} from './lia-music-arrangement.mjs';
import {exportLiaMidi} from './lia-midi-export.mjs';
test('export a real MIDI type 1 buffer with tempo and notes',()=>{
 const a=compileLiaArrangement({id:'theme',title:'Theme',bpm:97,tracks:[
  {id:'piano',program:0,notes:[{pitch:60,startBeat:0,durationBeats:1,velocity:100}]},
  {id:'bass',program:32,notes:[{pitch:36,startBeat:0,durationBeats:2,velocity:90}]}]});
 const b=exportLiaMidi(a);
 assert.equal(b.subarray(0,4).toString('ascii'),'MThd');
 assert.equal(b.readUInt16BE(8),1);
 assert.equal(b.readUInt16BE(10),3);
 assert.equal(b.readUInt16BE(12),480);
 assert.equal(b.toString('latin1').includes('MTrk'),true);
 assert.deepEqual(exportLiaMidi(a),b);
});
test('reject invalid export inputs',()=>{
 assert.throws(()=>exportLiaMidi(null));
 const a=compileLiaArrangement({id:'theme',title:'Theme'});
 assert.throws(()=>exportLiaMidi(a,{ticksPerBeat:0}));
});
