import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePairedRetrieval} from './atlas-paired-retrieval-evaluation.mjs';
const cases=Array.from({length:100},(_,i)=>({id:'q'+i,relevantIds:['doc'+i]}));
const runs=(good=true)=>cases.map((c,i)=>({id:c.id,retrievedIds:[good?c.relevantIds[0]:'wrong'+i],citationCorrect:good,latencyMs:10,memoryMb:200}));
test('paired retrieval computes objective metrics and never automatically promotes',()=>{
 const result=evaluatePairedRetrieval(cases,runs(false),runs(true));
 assert.equal(result.baseline.recallAt5,0);
 assert.equal(result.candidate.recallAt5,1);
 assert.equal(result.candidate.ndcgAt5,1);
 assert.equal(result.candidate.citationAccuracy,1);
 assert.equal(result.gate.verdict,'review-required');
 assert.equal(result.gate.promote,false);
 assert.equal(result.autoPromote,false);
});
test('paired retrieval detects latency and citation regressions',()=>{
 const slower=runs(true).map(r=>({...r,latencyMs:20}));
 assert.equal(evaluatePairedRetrieval(cases,runs(true),slower).gate.verdict,'reject');
 assert.equal(evaluatePairedRetrieval(cases,runs(true),runs(false)).gate.verdict,'reject');
});
test('evaluation rejects missing, duplicate and untrusted metrics',()=>{
 assert.throws(()=>evaluatePairedRetrieval(cases,runs(true).slice(1),runs(true)));
 assert.throws(()=>evaluatePairedRetrieval(cases,runs(true),[...runs(true).slice(1),runs(true)[1]]));
 assert.throws(()=>evaluatePairedRetrieval(cases,runs(true),runs(true).map((r,i)=>i===0?{...r,citationCorrect:'yes'}:r)));
 assert.throws(()=>evaluatePairedRetrieval(cases,runs(true),runs(true).map((r,i)=>i===0?{...r,retrievedIds:['a','a']}:r)));
 assert.throws(()=>evaluatePairedRetrieval(cases,runs(true),runs(true),{minimumQueries:0}));
});
test('small test sets never satisfy the default 100-query gate',()=>{
 const result=evaluatePairedRetrieval(cases.slice(0,5),runs(true).slice(0,5),runs(true).slice(0,5));
 assert.equal(result.gate.verdict,'insufficient-evidence');
});
