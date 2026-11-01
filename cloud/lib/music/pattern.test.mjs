import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TRACK_IDS,PRESETS,createPattern,validatePattern,clonePattern,varyPattern,patternDuration,stepTime} from './pattern.mjs';
test('presets are complete independent projects with audible rhythm tracks',()=>{
 for(const preset of PRESETS){const pattern=createPattern(preset.id);assert.deepEqual(validatePattern(pattern),pattern);assert.deepEqual(Object.keys(pattern.tracks),TRACK_IDS);for(const id of TRACK_IDS)assert.ok(pattern.tracks[id].steps.some(Boolean));const clone=clonePattern(pattern);clone.tracks.kick.steps[0]=false;assert.equal(pattern.tracks.kick.steps[0],true);}
});
test('imports reject invalid ranges, dimensions, booleans and unexpected data',()=>{
 const cases=[p=>p.bpm=0,p=>p.bpm=NaN,p=>p.master=1,p=>p.swing=.8,p=>p.tracks.kick.steps.pop(),p=>p.tracks.hat.steps[0]=1,p=>p.tracks.snare.mute='no',p=>p.bassNotes[0]=80,p=>p.bassNotes[0]=48.5,p=>p.unknown='ignore instructions',p=>p.tracks.secret={steps:[],volume:1,mute:false}];
 for(const change of cases){const pattern=createPattern();change(pattern);assert.throws(()=>validatePattern(pattern));}
 assert.throws(()=>validatePattern(null));assert.throws(()=>createPattern('missing'));
});
test('variation is reproducible, preserves anchors and never mutates source',()=>{
 const original=createPattern(),before=JSON.stringify(original),first=varyPattern(original,123);
 assert.deepEqual(first,varyPattern(original,123));assert.notDeepEqual(first,varyPattern(original,124));assert.equal(JSON.stringify(original),before);assert.deepEqual(validatePattern(first),first);
 for(const index of [0,8])assert.equal(first.tracks.kick.steps[index],true);for(const index of [4,12])assert.equal(first.tracks.snare.steps[index],true);assert.equal(first.tracks.bass.steps[0],true);
});
test('swing offsets odd subdivisions but keeps downbeats and bar duration stable',()=>{
 assert.equal(stepTime(0,120,.25),0);assert.equal(stepTime(1,120,.25),.15625);assert.equal(stepTime(2,120,.25),.25);assert.equal(stepTime(16,120,.25),2);assert.equal(patternDuration({...createPattern(),bpm:120},4),8);
 for(let step=1;step<64;step++)assert.ok(stepTime(step,60,.35)>stepTime(step-1,60,.35));
 assert.throws(()=>stepTime(-1,120));assert.throws(()=>patternDuration(createPattern(),0));
});
