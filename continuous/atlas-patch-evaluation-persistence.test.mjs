import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {persistAtlasPatchEvaluation} from './atlas-patch-evaluation-persistence.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const revision='a'.repeat(40);
const evidence={baseRevision:revision,manifestHash:'b'.repeat(64),
 changes:[],testStatus:'passed',exitCode:0,timedOut:false,
 outputTruncated:false,sandboxAttested:false};
const patchReport={status:'tests_reported_passed',readyToMerge:false,
 originalRepositoryModified:false,evidence:{...evidence,evidenceHash:hash(evidence)}};
const abReport={status:'completed',recommendation:'eligible_for_human_review',
 qualityDelta:0.1,baselineLatencyMs:10,candidateLatencyMs:10,
 newFailures:[],latencyWithinLimit:true};
const args={filePath:'/tmp/atlas-test-history.json',patchReport,abReport,
 baselineId:'base',candidateId:'candidate',timestamp:123,revision,
 config:{mode:'local'}};
test('verifies Git revision and records history without automatic restore',async()=>{
 let written=null;
 const result=await persistAtlasPatchEvaluation({...args,
  lookupCommit:async sha=>({sha}),
  readHistory:async()=>({entries:[],exists:false}),
  writeHistory:async data=>{
   written=data;return {headHash:data.entries.at(-1).hash,count:data.entries.length};
  }
 });
 assert.equal(result.persisted,true);
 assert.equal(result.executesRestore,false);
 assert.equal(result.trustedHistoryAnchorVerified,false);
 assert.equal(written.expectedHeadHash,null);
 assert.equal(result.restorePoint.historyHeadHash,result.headHash);
});
test('refuses unknown revision before any write',async()=>{
 let writes=0;
 const result=await persistAtlasPatchEvaluation({...args,
  lookupCommit:async()=>null,
  readHistory:async()=>{throw Error('should not read');},
  writeHistory:async()=>{writes++;}});
 assert.equal(result.status,'blocked_unverified_revision');
 assert.equal(writes,0);
});
test('rejects persistence adapter mismatch',async()=>{
 await assert.rejects(persistAtlasPatchEvaluation({...args,
  lookupCommit:async sha=>({sha}),
  readHistory:async()=>({entries:[]}),
  writeHistory:async()=>({headHash:'incorrect',count:1})
 }),/Persistence result does not match/);
});
