import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planAtlasCodingCycle,claimAtlasCodingCycleReview} from './atlas-coding-cycle.mjs';
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

test('signed review phase requires independently supplied expected commit and digest',async()=>{
 const cycle=planAtlasCodingCycle(base);
 await assert.rejects(()=>claimAtlasCodingCycleReview({cycle,claim:{proposalId:cycle.proposalId}}),
  /complete unresolved-free planned coding cycle/);
});
test('signed review phase blocks a proposal mismatch before consuming evidence',async()=>{
 const cycle=planAtlasCodingCycle(base);
 const result=await claimAtlasCodingCycleReview({cycle,claim:{proposalId:'different'},
  expected:{proposalId:cycle.proposalId,baseCommit:'a'.repeat(40),diffDigest:'b'.repeat(64)}});
 assert.equal(result.status,'blocked');
 assert.equal(result.authorizationGranted,false);
});

test('content changes alter the cryptographic patch digest',()=>{
 const a=planAtlasCodingCycle(base);
 const b=planAtlasCodingCycle({...base,changes:[{...base.changes[0],content:'different source'}]});
 assert.match(a.diffDigest,/^[a-f0-9]{64}$/);
 assert.notEqual(a.diffDigest,b.diffDigest);
});
test('host expected digest must match the actual planned content before claiming',async()=>{
 const cycle=planAtlasCodingCycle(base);
 const result=await claimAtlasCodingCycleReview({cycle,claim:{proposalId:cycle.proposalId},
  expected:{proposalId:cycle.proposalId,baseCommit:'a'.repeat(40),diffDigest:'b'.repeat(64)}});
 assert.equal(result.reason,'patch_digest_mismatch');
 assert.equal(result.authorizationGranted,false);
});
