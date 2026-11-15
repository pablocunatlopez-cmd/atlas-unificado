import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareAtlasSandboxPatch,verifyAtlasSandboxPatch} from './atlas-sandbox-patch-preflight.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const baseRevision='a'.repeat(40);
test('verifies unchanged base and content without execution',()=>{
 const proposal=prepareAtlasSandboxPatch({proposalId:'patch-1',baseRevision,
  files:[{operation:'update',path:'src/test.mjs',content:'new'}],
  expectedCurrent:{'src/test.mjs':sha('old')}});
 const result=verifyAtlasSandboxPatch({proposal,currentRevision:baseRevision,
  readCurrentFile:path=>path==='src/test.mjs'?'old':null});
 assert.equal(result.status,'ready_for_isolated_execution');
 assert.equal(result.executed,false);
});
test('rejects changed base or changed file',()=>{
 const proposal=prepareAtlasSandboxPatch({proposalId:'patch-1',baseRevision,
  files:[{operation:'update',path:'src/test.mjs',content:'new'}],
  expectedCurrent:{'src/test.mjs':sha('old')}});
 assert.throws(()=>verifyAtlasSandboxPatch({proposal,
  currentRevision:'b'.repeat(40),readCurrentFile:()=> 'old'}),/base revision mismatch/);
 assert.throws(()=>verifyAtlasSandboxPatch({proposal,
  currentRevision:baseRevision,readCurrentFile:()=> 'modified'}),/file drift/);
});
test('rejects tampered patch and unsafe traversal',()=>{
 const proposal=prepareAtlasSandboxPatch({proposalId:'patch-1',baseRevision,
  files:[{operation:'create',path:'src/new.mjs',content:'new'}]});
 const altered={...proposal,operations:[{...proposal.operations[0],content:'malicious'}]};
 assert.throws(()=>verifyAtlasSandboxPatch({proposal:altered,
  currentRevision:baseRevision,readCurrentFile:()=>null}),/content changed/);
 assert.throws(()=>prepareAtlasSandboxPatch({proposalId:'patch-2',baseRevision,
  files:[{operation:'create',path:'../escape',content:'x'}]}),/Invalid patch operation/);
});
