import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runAtlasRetrievalReport} from './run-atlas-retrieval-report.mjs';

// Synthetic benchmark only: 100 distinct labels and matching documents.
// It is NOT evidence about Atlas's real memory, factual accuracy or Qwen.
const count=100;
const documents=Array.from({length:count},(_,i)=>({
 id:'entry'+i,title:'Token'+i,text:'Synthetic reference for Token'+i+' and benchmark entry '+i+'.'
}));
const cases=Array.from({length:count},(_,i)=>({
 id:'case'+i,question:'Token'+i,relevantIds:['entry'+i]
}));
const citationLabels=Object.fromEntries(cases.map(c=>[c.id,{'atlas-lexical':true,fts5:true}]));
test('100-case synthetic pipeline measures both actual search engines without automatic promotion',async()=>{
 const report=await runAtlasRetrievalReport({documents,cases,citationLabels},{
  minimumQueries:100,warmupRounds:1,measurementRounds:2
 });
 assert.equal(report.baseline.queries,100);
 assert.equal(report.candidate.queries,100);
 assert.equal(report.perQuery.length,100);
 assert.equal(report.gate.promote,false);
 assert.equal(report.requiresHumanApproval,true);
 assert.equal(report.independentCitationVerification,false);
 assert.match(report.reportHash,/^sha256:[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(report).includes('Synthetic reference'),false);
});
