import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planAtlasCodingCycle,planAtlasVerifiedCodingCycle} from './atlas-coding-cycle.mjs';
const base={
 proposalId:'atlas-task-1',
 repositoryFiles:[
  {path:'src/main.mjs',content:"import './dep.mjs';"},
  {path:'src/dep.mjs',content:'export const x=1;'}
 ],
 targets:['src/main.mjs'],
 changes:[{operation:'update',path:'src/main.mjs',content:"import './dep.mjs'; export const y=2;"}]
};
const commitSha='a'.repeat(40);
const kinds=['syntax','unit','security','approval'];
const noEvidence={commitSha,verifyEvidence:async()=>false};
test('connects context selection and patch plan without execution',async()=>{
 const result=await planAtlasCodingCycle({...base,...noEvidence});
 assert.equal(result.status,'planned_not_executed');
 assert.deepEqual(result.context.files.map(f=>f.path),['src/main.mjs','src/dep.mjs']);
 assert.equal(result.patch.changes.length,1);
 assert.equal(result.nextStep,'verify_commit_bound_evidence');
});
test('legacy flags cannot make the main entry point ready for review',async()=>{
 const result=await planAtlasCodingCycle({...base,...noEvidence,checks:{syntax:true,unit:true,security:true},
 approval:{verifiedByHost:true,principal:'reviewer',proposalId:'atlas-task-1'}});
 assert.equal(result.review.readyForReview,false);
 assert.equal(result.review.readyForHumanReview,false);
 assert.equal(result.nextStep,'verify_commit_bound_evidence');
 assert.equal(result.verifiedReady,false);
 assert.equal(result.status,'planned_not_executed');
});
test('rejects unsafe patch targets',async()=>{
 await assert.rejects(planAtlasCodingCycle({...base,...noEvidence,changes:[{operation:'delete',path:'../secret'}]}));
});

test('blocks updates to files absent from repository snapshot',async()=>{
 const result=await planAtlasCodingCycle({...base,...noEvidence,changes:[{operation:'update',path:'src/missing.mjs',content:'x'}]});
 assert.equal(result.nextStep,'resolve_missing_or_conflicting_files');
 assert.deepEqual(result.unresolved,['src/missing.mjs']);
});
test('blocks create when file already exists',async()=>{
 const result=await planAtlasCodingCycle({...base,...noEvidence,changes:[{operation:'create',path:'src/main.mjs',content:'x'}]});
 assert.equal(result.nextStep,'resolve_missing_or_conflicting_files');
});
test('reports affected reverse dependencies for regression targeting',async()=>{
 const result=await planAtlasCodingCycle({...base,...noEvidence,changes:[{operation:'update',path:'src/dep.mjs',content:'export const x=2;'}]});
 assert.deepEqual(result.impact.affected,['src/dep.mjs','src/main.mjs']);
});

test('verified cycle binds exact content, actions and commit to the host verifier',async()=>{
 let expected;
 const evidence=kinds.map(kind=>({kind,commitSha}));
 const verifyEvidence=async(item,context)=>{
  assert.equal(context.proposalId,base.proposalId);
  assert.equal(context.commitSha,commitSha);
  assert.match(context.proposalDigest,/^[a-f0-9]{64}$/);
  assert.deepEqual(context.actions,[{kind:'write',target:'src/main.mjs'}]);
  assert.ok(Object.isFrozen(context.actions[0]));
  expected??=context.proposalDigest;
  return item.commitSha===context.commitSha&&context.proposalDigest===expected;
 };
 const result=await planAtlasCodingCycle({...base,commitSha,evidence,verifyEvidence});
 assert.equal(result.verifiedReady,true);
 assert.equal(result.review.readyForReview,true);
 assert.equal(result.verifiedReview.readyForHumanReview,true);
 assert.equal(result.proposalDigest,expected);
 assert.equal(result.nextStep,'human_review');
 assert.equal(result.executionAuthorized,false);
 assert.equal(result.status,'planned_not_executed');
 const changed=await planAtlasCodingCycle({...base,commitSha,evidence,verifyEvidence,
  changes:[{operation:'update',path:'src/main.mjs',content:'different'}]});
 assert.notEqual(changed.proposalDigest,expected);
 assert.equal(changed.verifiedReady,false);
 const wrongCommit=await planAtlasCodingCycle({...base,commitSha,evidence:evidence.map(x=>({...x,commitSha:'b'.repeat(40)})),verifyEvidence});
 assert.equal(wrongCommit.verifiedReady,false);
});
test('verified cycle fails closed despite legacy flags, missing files or conflicting creates',async()=>{
 const legacy={checks:{syntax:true,unit:true,security:true},
  approval:{verifiedByHost:true,principal:'reviewer',proposalId:base.proposalId}};
 const rejected=await planAtlasCodingCycle({...base,...legacy,commitSha,
  evidence:kinds.map(kind=>({kind,verified:true})),verifyEvidence:async()=>false});
 assert.equal(rejected.review.readyForReview,false);
 assert.equal(rejected.verifiedReady,false);
 assert.deepEqual(rejected.verifiedReview.missingEvidence,kinds);
 for(const changes of [
  [{operation:'update',path:'src/missing.mjs',content:'x'}],
  [{operation:'create',path:'src/main.mjs',content:'x'}]
 ]){
  const result=await planAtlasCodingCycle({...base,changes,commitSha,
   evidence:kinds.map(kind=>({kind})),verifyEvidence:async()=>true});
  assert.equal(result.verifiedReview.readyForHumanReview,true);
  assert.equal(result.verifiedReady,false);
  assert.equal(result.review.readyForHumanReview,false);
  assert.equal(result.review.readyForReview,false);
  assert.equal(result.nextStep,'resolve_missing_or_conflicting_files');
 }
});
test('verified cycle requires a valid verifier and preserves verifier failures',async()=>{
 await assert.rejects(planAtlasCodingCycle(base));
 await assert.rejects(planAtlasCodingCycle({...base,commitSha}));
 await assert.rejects(planAtlasCodingCycle({...base,commitSha:'bad',verifyEvidence:async()=>true}));
 await assert.rejects(planAtlasCodingCycle({...base,commitSha,evidence:[{kind:'unknown'}],
  verifyEvidence:async()=>true}));
 await assert.rejects(planAtlasCodingCycle({...base,commitSha,evidence:[{kind:'syntax'}],
  verifyEvidence:async()=>{throw Error('verification unavailable');}}),/verification unavailable/);
});
test('verified cycle requires all checks and approval, and accepts only literal true',async()=>{
 const result=await planAtlasCodingCycle({...base,commitSha,
  evidence:kinds.map(kind=>({kind})),
  verifyEvidence:async item=>item.kind==='approval'?{verified:true}:item.kind!=='security'});
 assert.deepEqual(result.verifiedReview.missingEvidence,['security','approval']);
 assert.equal(result.verifiedReady,false);
 assert.equal(result.nextStep,'verify_commit_bound_evidence');
 assert.equal(result.executionAuthorized,false);
});
test('verified cycle snapshots evidence and proposal before asynchronous verification',async()=>{
 const changes=[{operation:'delete',path:'src/dep.mjs'}];
 const evidence=kinds.map(kind=>({kind,commitSha}));
 let release;
 const waiting=new Promise(resolve=>{release=resolve;});
 let first=true;
 const pending=planAtlasCodingCycle({...base,changes,commitSha,evidence,verifyEvidence:async(item,context)=>{
  if(first){first=false;await waiting;}
  assert.deepEqual(context.actions,[{kind:'delete',target:'src/dep.mjs'}]);
  return item.commitSha===context.commitSha;
 }});
 changes[0].path='src/main.mjs';
 evidence.forEach(item=>{item.commitSha='b'.repeat(40);});
 release();
 const result=await pending;
 assert.equal(result.verifiedReady,true);
 assert.equal(result.patch.changes[0].path,'src/dep.mjs');
});
test('verified-cycle alias uses the same main entry point',()=>{
 assert.equal(planAtlasVerifiedCodingCycle,planAtlasCodingCycle);
});
