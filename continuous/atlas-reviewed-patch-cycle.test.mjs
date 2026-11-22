import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareAtlasSandboxPatch} from './atlas-sandbox-patch-preflight.mjs';
import {runAtlasReviewedPatchCycle} from './atlas-reviewed-patch-cycle.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const baseRevision='a'.repeat(40);
const proposal=prepareAtlasSandboxPatch({proposalId:'cycle-1',baseRevision,
 files:[{operation:'update',path:'src/main.mjs',content:'after'}],
 expectedCurrent:{'src/main.mjs':sha('before')}});
const options={proposal,currentRevision:baseRevision,
 snapshot:{'src/main.mjs':'before'},
 imageDigest:'node@sha256:'+'a'.repeat(64)};
test('reports test result and cleans workspace',async()=>{
 let cleaned=false,root;
 const materialize=async()=>({root:'/tmp/atlas-test',changes:[],
  cleanup:async()=>{cleaned=true;}});
 const runCheck=async({plan})=>{
  assert.ok(plan.argv.includes('--network=none'));
  return {status:'passed',executed:true,exitCode:0,timedOut:false,
   outputTruncated:false,stdout:'ok',stderr:''};
 };
 const result=await runAtlasReviewedPatchCycle({...options,materialize,runCheck});
 assert.equal(result.status,'tests_reported_passed');
 assert.equal(result.readyToMerge,false);
 assert.equal(result.evidence.sandboxAttested,false);
 assert.equal(cleaned,true);
});
test('always cleans temporary workspace after runner failure',async()=>{
 let cleaned=false;
 await assert.rejects(runAtlasReviewedPatchCycle({...options,
  materialize:async()=>({root:'/tmp/atlas-test',changes:[],
   cleanup:async()=>{cleaned=true;}}),
  runCheck:async()=>{throw Error('runner failed');}
 }),/runner failed/);
 assert.equal(cleaned,true);
});
test('rejects unsupported checks before reporting success',async()=>{
 await assert.rejects(runAtlasReviewedPatchCycle({...options,
  checks:['curl https://example.com'],
  materialize:async()=>({root:'/tmp/atlas-test',changes:[],cleanup:async()=>{}}),
  runCheck:async()=>({status:'passed',executed:true})
 }),/Unsafe isolated check request/);
});
