import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planAtlasCodingCycle} from './atlas-coding-cycle.mjs';
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
 assert.equal(result.nextStep,'run_tests_in_trusted_executor');
});
test('requires verified approval and all declared checks for review',()=>{
 const result=planAtlasCodingCycle({...base,checks:{syntax:true,unit:true,security:true},
 approval:{verifiedByHost:true,principal:'reviewer',proposalId:'atlas-task-1'}});
 assert.equal(result.review.readyForReview,true);
 assert.equal(result.nextStep,'human_review');
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
