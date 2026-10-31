import test from 'node:test';
import assert from 'node:assert/strict';
import {checkToolContract,retainContract} from './tool-contract.mjs';
const base={name:'double',passed:true,source:'function transform(x){return x*2}',tests:[{input:1,expected:2}],acceptanceTests:[{input:-1,expected:-2}]};
test('periodic audit rejects passing model examples with failed acceptance',async()=>{
 const result=await checkToolContract({...base,source:'function transform(x){return 2}'});
 assert.equal(result.modelResults[0].passed,true);assert.equal(result.passed,false);
});
test('repair retains ancestral cases and rejects forgotten behavior',async()=>{
 const candidate={...base,source:'function transform(x){return 4}',tests:[{input:2,expected:4}],acceptanceTests:[]};
 await retainContract(candidate,base);
 assert.equal(candidate.passed,false);assert.equal(candidate.regressionTests.length,2);
});
test('inherited cases remain enforced in subsequent audits',async()=>{
 const candidate={...base,tests:[{input:2,expected:4}]};await retainContract(candidate,base);
 assert.equal(candidate.passed,true);
 const altered=await checkToolContract({...candidate,source:'function transform(x){return x===1?0:x*2}'});
 assert.equal(altered.passed,false);
});
