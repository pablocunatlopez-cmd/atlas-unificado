import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAtlasLocalModel} from './atlas-local-model-evaluator.mjs';
test('evaluates exact matches and records failures',async()=>{
 let now=0;
 const result=await evaluateAtlasLocalModel({
  cases:[
   {id:'one',prompt:'A',expected:'OK'},
   {id:'two',prompt:'B',expected:'OK'},
   {id:'three',prompt:'C',expected:'OK'}
  ],
  infer:async prompt=>{
   if(prompt==='C')throw Error('offline');
   return {answer:prompt==='A'?'OK':'incorrect'};
  },
  clock:()=>{now+=5;return now;},readMemory:()=>1024
 });
 assert.equal(result.total,3);
 assert.equal(result.passed,1);
 assert.equal(result.failed,2);
 assert.equal(result.exactMatchRate,1/3);
 assert.equal(result.cases[2].status,'failed');
 assert.equal(result.generalReasoningVerified,false);
});
test('rejects duplicate case IDs and oversized test batches',async()=>{
 const infer=async()=>({answer:'OK'});
 await assert.rejects(evaluateAtlasLocalModel({infer,cases:[
  {id:'same',prompt:'A',expected:'OK'},
  {id:'same',prompt:'B',expected:'OK'}
 ]}),/Invalid evaluation case/);
 await assert.rejects(evaluateAtlasLocalModel({infer,cases:[]}),/Invalid local evaluation/);
});
