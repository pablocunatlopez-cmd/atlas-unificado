import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appendAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
import {createAtlasRestorePoint} from './atlas-restore-point.mjs';
import {selectAtlasApprovedRestore} from './atlas-approved-restore-selector.mjs';
const revision='a'.repeat(40),currentRevision='b'.repeat(40);
const record=(candidateId,recommendation)=>({
 baselineId:'old',candidateId,recommendation,qualityDelta:0.2,
 baselineLatencyMs:100,candidateLatencyMs:110,newFailures:[],
 latencyWithinLimit:true
});
test('selects most recent eligible and explicitly approved restore',()=>{
 let entries=appendAtlasEvaluationHistory({record:record('model-one','eligible_for_human_review'),timestamp:1});
 entries=appendAtlasEvaluationHistory({entries,record:record('model-two','reject_candidate'),timestamp:2});
 const point=createAtlasRestorePoint({revision,config:{modelId:'model-one'},
  historyHeadHash:entries[0].hash,createdAt:1});
 const result=selectAtlasApprovedRestore({entries,restorePoints:[point],
  approvals:[{historyHash:entries[0].hash,restoreChecksum:point.checksum,approved:true}],
  currentRevision});
 assert.equal(result.status,'candidate_for_manual_restore');
 assert.equal(result.candidateId,'model-one');
 assert.equal(result.plan.status,'approval_required');
 assert.equal(result.executesRestore,false);
});
test('never treats eligible recommendation as human approval',()=>{
 const entries=appendAtlasEvaluationHistory({
  record:record('model-one','eligible_for_human_review'),timestamp:1});
 const point=createAtlasRestorePoint({revision,config:{modelId:'model-one'},
  historyHeadHash:entries[0].hash,createdAt:1});
 const result=selectAtlasApprovedRestore({entries,restorePoints:[point],
  approvals:[],currentRevision});
 assert.equal(result.status,'no_eligible_approved_restore');
});
test('rejects approvals without explicit true',()=>{
 assert.throws(()=>selectAtlasApprovedRestore({
  entries:[],restorePoints:[],approvals:[{
   historyHash:'a'.repeat(64),restoreChecksum:'b'.repeat(64),approved:false
  }],currentRevision
 }),/Invalid approval evidence/);
});
