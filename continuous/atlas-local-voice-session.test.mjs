import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasLocalVoiceSession} from './atlas-local-voice-session.mjs';
test('end-to-end reviewed voice turn uses local model only after confirmation',async()=>{
 const calls=[];
 const session=createAtlasLocalVoiceSession({
  startRecording:async()=>{calls.push('start');},
  stopAndTranscribe:async()=>{calls.push('transcribe');return {
   status:'completed',local:true,transcript:'Hola Atlas'};},
  fetchImpl:async(url)=>{
   calls.push('infer');
   assert.equal(url,'http://127.0.0.1:8080/v1/chat/completions');
   return {ok:true,text:async()=>JSON.stringify({choices:[{message:{content:'Hola'}}]})};
  }
 });
 await session.dispatch('voice-start');
 await session.dispatch('voice-stop');
 assert.deepEqual(calls,['start','transcribe']);
 assert.equal(session.ui.state.phase,'review');
 await session.dispatch('voice-confirm');
 assert.deepEqual(calls,['start','transcribe','infer']);
 assert.equal(session.ui.state.phase,'answered');
});
test('failed transcription cannot reach model',async()=>{
 let inferred=false;
 const session=createAtlasLocalVoiceSession({
  startRecording:async()=>{},
  stopAndTranscribe:async()=>({status:'failed',local:true,transcript:'bad'}),
  fetchImpl:async()=>{inferred=true;}
 });
 await session.dispatch('voice-start');
 await session.dispatch('voice-stop');
 assert.equal(session.ui.state.phase,'error');
 assert.equal(inferred,false);
});
