import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasSelfReviewSession} from './atlas-self-review-session.mjs';
const observation={id:'SELF_007',area:'correctness',problem:'Missing evidence verification',
 evidence:'Roadmap milestone 7 remains open',principle:'Never claim unverified outcomes.',
 roadmapReference:'Milestone 7',candidates:[
 {description:'Require independent evidence',risk:'Manual review',acceptanceCriterion:'Reviewer checks source',estimatedBenefit:4,estimatedRisk:1},
 {description:'Trust model',risk:'Incorrect claims',acceptanceCriterion:'Independent checks',estimatedBenefit:2,estimatedRisk:4}]};
test('integrated session returns a proposal and LOR critique without applying code',async()=>{
 let calls=0;
 const fetchImpl=async(_url,request)=>{
  calls++;const payload=JSON.parse(request.body);
  assert.equal(payload.stream,false);assert.equal(payload.format,'json');
  const data=JSON.stringify({message:{content:JSON.stringify({observations:[observation]})}});
  const bytes=new TextEncoder().encode(data);
  return {ok:true,headers:{get:()=>null},body:new ReadableStream({
   start(controller){controller.enqueue(bytes);controller.close();}
  })};
 };
 const session=createAtlasSelfReviewSession({fetchImpl});
 const result=await session.run({constitution:'Never claim unverified outcomes.',
  roadmap:'Milestone 7 — measured autonomous improvement',
  repositoryContext:'docs/ATLAS_MASTER_ROADMAP.md: milestone 7 incomplete'});
 assert.equal(calls,1);assert.equal(result.mode,'dry_run');
 assert.equal(result.proposal.id,'SELF_007');
 assert.equal(result.review.proposalId,'SELF_007');
 assert.equal(result.codeExecuted,false);assert.equal(result.patchApplied,false);
 assert.equal(result.authorizationGranted,false);
});
test('integrated session refuses invalid model output',async()=>{
 const fetchImpl=async()=>{
  const bytes=new TextEncoder().encode(JSON.stringify({message:{content:'{}'}}));
  return {ok:true,headers:{get:()=>null},body:new ReadableStream({
   start(controller){controller.enqueue(bytes);controller.close();}
  })};
 };
 const session=createAtlasSelfReviewSession({fetchImpl});
 await assert.rejects(()=>session.run({constitution:'Never claim unverified outcomes.',
  roadmap:'Milestone 7',repositoryContext:'repo evidence'}));
});
