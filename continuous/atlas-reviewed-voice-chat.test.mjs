import {test} from 'node:test';
import assert from 'node:assert/strict';
import {answerAtlasReviewedVoice} from './atlas-reviewed-voice-chat.mjs';
const transcription={status:'completed',local:true,transcript:'Hola Atlas'};
test('requires exact reviewed text before local inference',async()=>{
 let called=false;
 const fetchImpl=async()=>{called=true;return {ok:true,text:async()=>JSON.stringify({
  choices:[{message:{content:'Hola humano'}}]})};};
 await assert.rejects(answerAtlasReviewedVoice({transcription,approvedText:'other',fetchImpl}));
 assert.equal(called,false);
 const r=await answerAtlasReviewedVoice({transcription,approvedText:'Hola Atlas',fetchImpl});
 assert.equal(r.answer,'Hola humano');
 assert.equal(r.remote,false);
 assert.equal(called,true);
});
