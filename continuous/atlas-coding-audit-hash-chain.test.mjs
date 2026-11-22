import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildAtlasAuditHashChain,verifyAtlasAuditHashChain} from './atlas-coding-audit-hash-chain.mjs';
const events=[{atMs:10,status:'intent_recorded',source:'planner'},
 {atMs:20,status:'outcome_unknown',source:'host'}];
test('deterministic chain validates but is not anchored or authorized',()=>{
 const chain=buildAtlasAuditHashChain({transactionId:'tx',observations:events});
 assert.deepEqual(chain,buildAtlasAuditHashChain({transactionId:'tx',observations:events}));
 const result=verifyAtlasAuditHashChain(chain);
 assert.equal(result.valid,true);assert.equal(result.anchored,false);
 assert.equal(result.authorizationGranted,false);
});
test('tampered entry or deletion fails integrity validation',()=>{
 const chain=buildAtlasAuditHashChain({transactionId:'tx',observations:events});
 assert.equal(verifyAtlasAuditHashChain({...chain,entries:[{...chain.entries[0],status:'review_blocked'},chain.entries[1]]}).valid,false);
 assert.equal(verifyAtlasAuditHashChain({...chain,entries:[chain.entries[0]]}).valid,false);
});
test('trusted externally pinned hash permits anchored comparison only',()=>{
 const chain=buildAtlasAuditHashChain({transactionId:'tx',observations:events});
 assert.equal(verifyAtlasAuditHashChain(chain,{trustedFinalHash:chain.finalHash}).anchored,true);
 assert.equal(verifyAtlasAuditHashChain(chain,{trustedFinalHash:'f'.repeat(64)}).anchored,false);
});
test('invalid events fail closed',()=>{
 assert.throws(()=>buildAtlasAuditHashChain({transactionId:'tx',observations:[{atMs:-1,status:'intent_recorded',source:'planner'}]}));
});
