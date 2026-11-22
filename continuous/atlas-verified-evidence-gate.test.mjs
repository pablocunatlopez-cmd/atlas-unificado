import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAtlasVerifiedChange} from './atlas-verified-evidence-gate.mjs';
const commitSha='a'.repeat(40);
const base={proposalId:'change-1',commitSha,actions:[{kind:'write',target:'src/main.mjs'}]};
test('does not trust unverified booleans or unverified evidence',async()=>{
 const evidence=['syntax','unit','security','approval'].map(kind=>({kind,verified:true}));
 const result=await evaluateAtlasVerifiedChange({...base,evidence,verifyEvidence:async()=>false});
 assert.equal(result.readyForHumanReview,false);
 assert.deepEqual(result.missingEvidence,['syntax','unit','security','approval']);
 assert.equal(result.executionAuthorized,false);
});
test('requires exact commit-bound trusted verification',async()=>{
 const evidence=['syntax','unit','security','approval'].map(kind=>({kind,commitSha}));
 const verifyEvidence=async(item,context)=>item.commitSha===context.commitSha;
 const result=await evaluateAtlasVerifiedChange({...base,evidence,verifyEvidence});
 assert.equal(result.readyForHumanReview,true);
 assert.equal(result.executionAuthorized,false);
 const wrong=await evaluateAtlasVerifiedChange({...base,evidence:evidence.map(x=>({...x,commitSha:'b'.repeat(40)})),verifyEvidence});
 assert.equal(wrong.readyForHumanReview,false);
});
test('requires verifier and valid commit',async()=>{
 await assert.rejects(evaluateAtlasVerifiedChange({...base,verifyEvidence:null}));
 await assert.rejects(evaluateAtlasVerifiedChange({...base,commitSha:'invalid',verifyEvidence:async()=>true}));
});
