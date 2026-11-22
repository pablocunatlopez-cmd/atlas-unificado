import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePairedRetrieval} from './atlas-paired-retrieval-evaluation.mjs';
import {buildAtlasRetrievalReport} from './atlas-retrieval-report.mjs';
const cases=Array.from({length:100},(_,i)=>({id:'private-case-'+i,relevantIds:['doc'+i]}));
const runs=cases.map(c=>({id:c.id,retrievedIds:c.relevantIds,citationCorrect:true,latencyMs:5,memoryMb:100}));
test('report is reproducible, minimizes case identifiers, and forbids promotion',()=>{
 const result=evaluatePairedRetrieval(cases,runs,runs,{documentCorpusHash:'sha256:'+'a'.repeat(64)});
 const first=buildAtlasRetrievalReport(result,{baselineVersion:'lexical-v1',candidateVersion:'fts5-v1'});
 const second=buildAtlasRetrievalReport(result,{baselineVersion:'lexical-v1',candidateVersion:'fts5-v1'});
 assert.deepEqual(first,second);
 assert.equal(first.reportHash,second.reportHash);
 assert.equal(first.gate.promote,false);
 assert.equal(first.requiresHumanApproval,true);
 assert.equal(first.perQuery.length,100);
 assert.equal(JSON.stringify(first).includes('private-case-'),false);
 assert.equal(first.recommendation,'human-review');
});
test('report refuses mismatched protocols, tampered counts and invalid verdicts',()=>{
 const result=evaluatePairedRetrieval(cases,runs,runs);
 assert.throws(()=>buildAtlasRetrievalReport({...result,candidate:{...result.candidate,protocolHash:'different'}}));
 assert.throws(()=>buildAtlasRetrievalReport({...result,perQuery:[]}));
 assert.throws(()=>buildAtlasRetrievalReport({...result,gate:{verdict:'promote',promote:true}}));
});
