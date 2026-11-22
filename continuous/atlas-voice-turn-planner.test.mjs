import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planAtlasVoiceTurn} from './atlas-voice-turn-planner.mjs';
test('local transcription is reviewable and not automatically submitted',()=>{
 const r=planAtlasVoiceTurn({transcription:{status:'completed',local:true,transcript:'  Hola Atlas  '}});
 assert.equal(r.content,'Hola Atlas');
 assert.equal(r.requiresUserReview,true);
 assert.equal(r.submitted,false);
});
test('rejects failed and untrusted transcription',()=>{
 assert.throws(()=>planAtlasVoiceTurn({transcription:{status:'failed',local:true,transcript:'x'}}));
 assert.throws(()=>planAtlasVoiceTurn({transcription:{status:'completed',local:false,transcript:'x'}}));
});
