import test from 'node:test';
import assert from 'node:assert/strict';
import {createPattern,validatePattern,PRESETS} from '../lib/music/pattern.mjs';
import {transposePattern,canTranspose,transpositionRange} from '../lib/music/transposition.mjs';

// These exercise score data consumed by both playback and WAV rendering. They
// do not assert that Web Audio was rendered or heard in a browser.
test('transposition shifts every stored note exactly while preserving intervals and the rest of the score',()=>{
 for(const {id} of PRESETS){
  const input=createPattern(id),snapshot=structuredClone(input),range=transpositionRange(input);
  for(let semitones=range.min;semitones<=range.max;semitones++){
   const result=transposePattern(input,semitones);
   assert.deepEqual(validatePattern(result),result);
   assert.deepEqual(result.bassNotes,input.bassNotes.map(note=>note+semitones));
   for(let i=1;i<16;i++)assert.equal(result.bassNotes[i]-result.bassNotes[i-1],input.bassNotes[i]-input.bassNotes[i-1]);
   const {bassNotes:_,...other}=result,{bassNotes:__,...original}=input;
   assert.deepEqual(other,original);assert.deepEqual(transposePattern(result,-semitones),input);
   assert.notEqual(result,input);assert.notEqual(result.tracks,input.tracks);
   assert.notEqual(result.tracks.bass.steps,input.tracks.bass.steps);
  }
  assert.deepEqual(input,snapshot);
 }
});
test('MIDI edge notes reject the whole change instead of clipping notes or mutating the original',()=>{
 const input=createPattern(),snapshot=structuredClone(input);input.bassNotes[0]=36;input.bassNotes[15]=72;
 const before=structuredClone(input);assert.deepEqual(transpositionRange(input),{min:0,max:0});
 for(const shift of [-12,-1,1,12]){assert.equal(canTranspose(input,shift),false);assert.throws(()=>transposePattern(input,shift),/MIDI 36–72/);}
 assert.deepEqual(input,before);assert.deepEqual(transposePattern(input,0),input);assert.equal(snapshot.bassNotes[15],36);
});
test('silent steps remain part of the score and are transposed by the same offset',()=>{
 const input=createPattern();input.bassNotes.fill(48);input.tracks.bass.steps.fill(false);input.tracks.bass.steps[0]=true;input.bassNotes[1]=36;
 assert.equal(canTranspose(input,-1),false,'inactive notes cannot be silently clamped');
 const result=transposePattern(input,12);assert.deepEqual(result.bassNotes,[60,48,...Array(14).fill(60)]);assert.deepEqual(result.tracks,input.tracks);
});
test('only integer shifts within one octave and valid score data are accepted',()=>{
 const input=createPattern();for(const value of [-13,13,.5,NaN,Infinity,'2',null,undefined,[],{}]){assert.equal(canTranspose(input,value),false);assert.throws(()=>transposePattern(input,value),/número entero/);}
 assert.equal(canTranspose({...input,bassNotes:[48]},0),false);assert.throws(()=>transpositionRange({...input,bassNotes:[48]}),/16 notas/);
 assert.throws(()=>transposePattern({...input,bpm:0},2),/Tempo/);
});
