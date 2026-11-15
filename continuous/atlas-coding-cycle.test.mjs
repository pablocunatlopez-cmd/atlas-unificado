import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planAtlasCodingCycle,reviewAtlasCodingCycle} from './atlas-coding-cycle.mjs';
const base={
 proposalId:'atlas-task-1',
 repositoryFiles:[
  {path:'src/main.mjs',content:"import './dep.mjs';"},
  {path:'src/dep.mjs',content:'export const x=1;'}
 ],
 targets:['src/main.mjs'],
 changes:[{operation:'update',path:'src/main.mjs',content:"import './dep.mjs'; export const y=2;"}]
};
test('connects context selection and patch plan without execution',()=>{
 const result=planAtlasCodingCycle(base);
 assert.equal(result.status,'planned_not_executed');
 assert.deepEqual(result.context.files.map(f=>f.path),['src/main.mjs','src/dep.mjs']);
 assert.equal(result.patch.changes.length,1);
 assert.equal(result.nextStep,'verify_commit_bound_evidence');
});
test('requires verified approval and all declared checks for review',()=>{
 const result=planAtlasCodingCycle({...base,checks:{syntax:true,unit:true,security:true},
 approval:{verifiedByHost:true,principal:'reviewer',proposalId:'atlas-task-1'}});
 assert.equal(result.review.readyForReview,true);
 assert.equal(result.nextStep,'verify_commit_bound_evidence');
 assert.equal(result.verifiedReady,false);
 assert.equal(result.status,'planned_not_executed');
});
test('rejects unsafe patch targets',()=>{
 assert.throws(()=>planAtlasCodingCycle({...base,changes:[{operation:'delete',path:'../secret'}]}));
});

test('blocks updates to files absent from repository snapshot',()=>{
 const result=planAtlasCodingCycle({...base,changes:[{operation:'update',path:'src/missing.mjs',content:'x'}]});
 assert.equal(result.nextStep,'resolve_missing_or_conflicting_files');
 assert.deepEqual(result.unresolved,['src/missing.mjs']);
});
test('blocks create when file already exists',()=>{
 const result=planAtlasCodingCycle({...base,changes:[{operation:'create',path:'src/main.mjs',content:'x'}]});
 assert.equal(result.nextStep,'resolve_missing_or_conflicting_files');
});
test('reports affected reverse dependencies for regression targeting',()=>{
 const result=planAtlasCodingCycle({...base,changes:[{operation:'update',path:'src/dep.mjs',content:'export const x=2;'}]});
 assert.deepEqual(result.impact.affected,['src/dep.mjs','src/main.mjs']);
});
test('links a planned proposal and its actions to trusted commit-bound evidence',async()=>{
 const commitSha='a'.repeat(40);
 const evidence=['syntax','unit','security','approval'].map(kind=>({kind,proposalId:base.proposalId,commitSha}));
 const contexts=[];
 const result=await reviewAtlasCodingCycle({...base,commitSha,evidence,verifyEvidence:async(item,context)=>{
  contexts.push(context);
  return item.proposalId===context.proposalId&&item.commitSha===context.commitSha;
 }});
 assert.equal(result.plan.proposalId,base.proposalId);
 assert.equal(result.evidenceReview.proposalId,base.proposalId);
 assert.equal(result.evidenceReview.commitSha,commitSha);
 assert.equal(result.evidenceReview.readyForHumanReview,true);
 assert.equal(result.executionAuthorized,false);
 assert.deepEqual(contexts[0].actions,[{kind:'write',target:'src/main.mjs'}]);
 assert.equal(Object.isFrozen(contexts[0].actions),true);
 assert.equal(Object.isFrozen(contexts[0].actions[0]),true);
});
test('rejects mismatched evidence and ignores legacy approval flags',async()=>{
 const commitSha='a'.repeat(40);
 const evidence=['syntax','unit','security','approval'].map(kind=>({kind,commitSha:'b'.repeat(40)}));
 const result=await reviewAtlasCodingCycle({...base,commitSha,evidence,
  checks:{syntax:true,unit:true,security:true},
  approval:{verifiedByHost:true,principal:'reviewer',proposalId:base.proposalId},
  verifyEvidence:async(item,context)=>item.commitSha===context.commitSha});
 assert.equal(result.evidenceReview.readyForHumanReview,false);
 assert.deepEqual(result.evidenceReview.missingEvidence,['syntax','unit','security','approval']);
 assert.equal(result.executionAuthorized,false);
});
test('blocks unresolved plans and propagates verifier failures',async()=>{
 let called=false;
 await assert.rejects(reviewAtlasCodingCycle({...base,changes:[{operation:'delete',path:'missing.mjs'}],
  commitSha:'a'.repeat(40),verifyEvidence:async()=>{called=true;return true;}}),/Resolve missing/);
 assert.equal(called,false);
 await assert.rejects(reviewAtlasCodingCycle({...base,commitSha:'a'.repeat(40),evidence:[{kind:'unit'}],
  verifyEvidence:async()=>{throw Error('verifier unavailable');}}),/verifier unavailable/);
});
