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

test('more than one hundred historical cases execute in bounded batches without dropping a late refutation',async()=>{
 const regressionTests=Array.from({length:103},(_,i)=>({input:i+10,expected:(i+10)*2}));
 const record={...base,regressionTests},result=await checkToolContract(record);
 assert.equal(result.complete,true);assert.equal(result.passed,true);assert.equal(result.coverage.evaluated,104);assert.equal(result.coverage.batches,4);
 const late=await checkToolContract({...record,source:'function transform(x){return x===112?0:x*2}'});
 assert.equal(late.complete,true);assert.equal(late.passed,false);assert.equal(late.contractResults.at(-1).passed,false);assert.equal(record.regressionTests.length,103);
});

test('exhausted preparation or execution budgets reject incomplete checks and cancellation remains observable',async()=>{
 const record={...base,regressionTests:Array.from({length:40},(_,i)=>({input:i+10,expected:(i+10)*2}))};
 let clock=0;const prepared=await checkToolContract(record,{now:()=>clock++,maxDurationMs:1});
 assert.equal(prepared.passed,false);assert.equal(prepared.complete,false);assert.equal(prepared.reason,'contract_preparation_budget_exhausted');assert.deepEqual(prepared.contractResults,[]);
 clock=0;const partial=await checkToolContract(record,{now:()=>clock++<43?0:100,maxDurationMs:50});
 assert.equal(partial.passed,false);assert.equal(partial.complete,false);assert.ok(partial.coverage.evaluated<partial.coverage.total);assert.equal(record.regressionTests.length,40);
 const controller=new AbortController();controller.abort(Error('cancel contracts'));await assert.rejects(checkToolContract(record,{signal:controller.signal}),/cancel contracts/);
});

test('exact duplicates are measured once while different JSON key order remains a separate input',async()=>{
 const a={input:{a:1,b:2},expected:['a','b']},b={input:{b:2,a:1},expected:['b','a']};
 const result=await checkToolContract({name:'keys',source:'function transform(x){return Object.keys(x)}',tests:[a],acceptanceTests:[a],regressionTests:[a,b]});
 assert.equal(result.passed,true);assert.equal(result.coverage.duplicateCases,1);assert.equal(result.contractResults.length,2);
});
