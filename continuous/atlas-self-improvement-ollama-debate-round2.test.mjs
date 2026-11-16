import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasOllamaDebateRoundTwo} from './atlas-self-improvement-ollama-debate-round2.mjs';
const answers=[
 {thesis:'Require evidence',evidenceReference:'docs/roadmap.md:1',responses:[]},
 {counterargument:'Evidence may be stale',evidenceReference:'docs/roadmap.md:2',
  objections:[{id:'O1',claim:'Stale data',evidenceReference:'docs/roadmap.md:2'}]},
 {responses:[{objectionId:'O1',reply:'Add revision ID',evidenceReference:'docs/roadmap.md:3'}]},
 {assessment:'The reply needs external verification',remainingObjectionIds:['O1']}
];
function mock(data){
 const bytes=new TextEncoder().encode(JSON.stringify({message:{content:JSON.stringify(data)}}));
 return {ok:true,headers:{get:()=>null},body:new ReadableStream({
  start(c){c.enqueue(bytes);c.close();}
 })};
}
test('four turns retain all objections even when a reply is supplied',async()=>{
 let count=0;
 const session=createAtlasOllamaDebateRoundTwo({fetchImpl:async()=>mock(answers[count++])});
 const result=await session.debate({proposal:{id:'SELF_013',problem:'Missing evidence'}});
 assert.equal(count,4);assert.equal(result.modelCalls,4);
 assert.deepEqual(result.allObjectionIds,['O1']);
 assert.deepEqual(result.adversaryRemainingObjectionIds,['O1']);
 assert.equal(result.verdict,'human_evidence_review_required');
 assert.equal(result.argumentsVerified,false);assert.equal(result.codeExecuted,false);
});
test('invalid final assessment fails closed',async()=>{
 let count=0;
 const session=createAtlasOllamaDebateRoundTwo({fetchImpl:async()=>mock(
  count++===3?{assessment:'Everything is solved',remainingObjectionIds:['UNKNOWN']}:
   answers[count-1])});
 await assert.rejects(()=>session.debate({proposal:{id:'SELF_013'}}));
});
