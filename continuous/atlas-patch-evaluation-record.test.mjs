import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {recordAtlasPatchEvaluation} from './atlas-patch-evaluation-record.mjs';
import {verifyAtlasEvaluationHistory} from './atlas-evaluation-history.mjs';
import {verifyAtlasRestorePoint} from './atlas-restore-point.mjs';
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
const args={patchReport,abReport,baselineId:'base',candidateId:'candidate',
 timestamp:123,revision,config:{mode:'local'}};
test('records A/B patch evidence and creates anchored-by-hash restore proposal',()=>{
 const first=recordAtlasPatchEvaluation(args);
 assert.equal(first.status,'eligible_for_human_review');
 assert.equal(first.entries.length,1);
 assert.equal(verifyAtlasEvaluationHistory(first.entries).headHash,first.headHash);
 assert.equal(verifyAtlasRestorePoint(first.restorePoint).valid,true);
 assert.equal(first.restorePoint.historyHeadHash,first.headHash);
 assert.equal(first.trustedAnchorVerified,false);
 const second=recordAtlasPatchEvaluation({...args,entries:first.entries,timestamp:124});
 assert.equal(second.entries.length,2);
 assert.equal(second.previousHeadHash,first.headHash);
 assert.equal(second.entries[1].previousHash,first.headHash);
});
test('rejects mismatched revision and tampered evidence',()=>{
 assert.throws(()=>recordAtlasPatchEvaluation({...args,revision:'c'.repeat(40)}));
 assert.throws(()=>recordAtlasPatchEvaluation({...args,
  patchReport:{...patchReport,evidence:{...patchReport.evidence,exitCode:1}}
 }));
});
