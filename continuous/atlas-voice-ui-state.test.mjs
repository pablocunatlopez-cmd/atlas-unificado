import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reduceAtlasVoiceUi} from './atlas-voice-ui-state.mjs';
test('voice UI requires review before submission',()=>{
 let s=reduceAtlasVoiceUi(undefined,{type:'START'});
 assert.equal(s.phase,'recording');
 s=reduceAtlasVoiceUi(s,{type:'TRANSCRIBED',text:' Hola '});
 assert.equal(s.phase,'review');
 assert.throws(()=>reduceAtlasVoiceUi(s,{type:'ANSWERED',answer:'x'}));
 s=reduceAtlasVoiceUi(s,{type:'CONFIRM'});
 assert.equal(s.phase,'submitting');
 s=reduceAtlasVoiceUi(s,{type:'ANSWERED',answer:'Hola'});
 assert.equal(s.answer,'Hola');
});
test('rejects empty transcript and supports reset',()=>{
 const recording=reduceAtlasVoiceUi(undefined,{type:'START'});
 assert.throws(()=>reduceAtlasVoiceUi(recording,{type:'TRANSCRIBED',text:'   '}));
 assert.equal(reduceAtlasVoiceUi(recording,{type:'RESET'}).phase,'idle');
});
