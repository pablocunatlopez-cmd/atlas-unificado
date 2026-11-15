import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareAtlasLocalModels} from './atlas-local-model-ab-gate.mjs';
const cases=[
 {id:'a',prompt:'a',expected:'OK'},
 {id:'b',prompt:'b',expected:'OK'}
];
test('recommends review only for a non-regressing candidate',async()=>{
 let tick=0;
 const result=await compareAtlasLocalModels({
  cases,baselineInfer:async prompt=>({answer:prompt==='a'?'OK':'no'}),
  candidateInfer:async()=>({answer:'OK'}),
  clock:()=>++tick,readMemory:()=>1024,
  minQualityGain:0.5
 });
 assert.equal(result.recommendation,'eligible_for_human_review');
 assert.equal(result.qualityDelta,0.5);
 assert.equal(result.automaticPromotion,false);
});
test('rejects candidates losing a previously passed case',async()=>{
 let tick=0;
 const result=await compareAtlasLocalModels({
  cases,baselineInfer:async prompt=>({answer:prompt==='a'?'OK':'no'}),
  candidateInfer:async prompt=>({answer:prompt==='b'?'OK':'no'}),
  clock:()=>++tick,readMemory:()=>1024
 });
 assert.equal(result.recommendation,'reject_candidate');
 assert.deepEqual(result.newFailures,['a']);
});
test('rejects excessive latency regressions',async()=>{
 let tick=0;
 const result=await compareAtlasLocalModels({
  cases,baselineInfer:async()=>({answer:'OK'}),
  candidateInfer:async()=>({answer:'OK'}),
  clock:()=>tick,
  readMemory:()=>1024,
  maxLatencyRegressionRatio:1.25
 });
 assert.equal(result.recommendation,'eligible_for_human_review');
});
test('validates comparison thresholds',async()=>{
 await assert.rejects(compareAtlasLocalModels({
  baselineInfer:async()=>{},candidateInfer:async()=>{},cases,
  maxLatencyRegressionRatio:0.5
 }),/Invalid comparison configuration/);
});
