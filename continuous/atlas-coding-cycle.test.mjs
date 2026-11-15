import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planAtlasCodingCycle,verifyAtlasCodingCycleEvidence} from './atlas-coding-cycle.mjs';
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
test('legacy caller flags never mark the plan verified or ready to execute',()=>{
 const result=planAtlasCodingCycle({...base,checks:{syntax:true,unit:true,security:true},
 approval:{verifiedByHost:true,principal:'reviewer',proposalId:'atlas-task-1'}});
 assert.equal(result.review.readyForReview,false);
 assert.deepEqual(result.review.failedChecks,['syntax','unit','security']);
 assert.equal(result.nextStep,'verify_commit_bound_evidence');
 assert.equal(result.verifiedReady,false);
 assert.equal(result.status,'planned_not_executed');
});
test('binds trusted evidence review to the planned proposal, actions and commit',async()=>{
 const cycle=planAtlasCodingCycle(base),commitSha='a'.repeat(40);
 const evidence=['syntax','unit','security','approval'].map(kind=>({kind}));
 const contexts=[];
 const result=await verifyAtlasCodingCycleEvidence({
 cycle,commitSha,evidence,
 verifyEvidence:async(item,context)=>{contexts.push(context);return true;}
 });
 assert.equal(result.proposalId,cycle.proposalId);
 assert.equal(result.commitSha,commitSha);
 assert.equal(result.readyForHumanReview,true);
 assert.equal(result.executionAuthorized,false);
 assert.deepEqual(contexts[0].actions,[
 {kind:'write',target:'src/main.mjs'}
 ]);
});
test('does not verify a cycle with unresolved paths',async()=>{
 const cycle=planAtlasCodingCycle({...base,changes:[{operation:'update',path:'src/missing.mjs',content:'x'}]});
 await assert.rejects(verifyAtlasCodingCycleEvidence({
 cycle,commitSha:'a'.repeat(40),evidence:[],verifyEvidence:async()=>true
 }),/unresolved/);
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
