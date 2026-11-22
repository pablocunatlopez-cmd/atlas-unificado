import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLiaArrangement} from './lia-music-arrangement.mjs';
test('Lía represents editable multi-track composition without claiming audio',()=>{
 const x=compileLiaArrangement({id:'song',title:'Lía Theme',bpm:97,tracks:[
  {id:'piano',program:0,notes:[{pitch:60,startBeat:0,durationBeats:1,velocity:90}]},
  {id:'bass',program:32,notes:[{pitch:36,startBeat:0,durationBeats:2,velocity:80}]}]});
 assert.equal(x.tracks.length,2);
 assert.equal(x.bpm,97);
 assert.equal(x.wavRendered,false);
 assert.equal(x.midiExportReady,false);
});
test('bad notes and duplicate tracks are rejected',()=>{
 const track={id:'piano',program:0,notes:[]};
 assert.throws(()=>compileLiaArrangement({id:'song',title:'T',tracks:[track,track]}));
 assert.throws(()=>compileLiaArrangement({id:'song',title:'T',tracks:[{...track,notes:[{pitch:128,startBeat:0,durationBeats:1,velocity:90}]}]}));
});
