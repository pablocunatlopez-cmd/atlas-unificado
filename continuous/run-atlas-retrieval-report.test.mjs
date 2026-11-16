import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runAtlasRetrievalReport} from './run-atlas-retrieval-report.mjs';
const fixture={
 documents:[{id:'doc1',title:'Q594 Órbita',text:'El motor Órbita impulsa Q594.'},{id:'doc2',title:'Memoria',text:'La memoria conserva decisiones.'}],
 cases:[{id:'case1',question:'Q594 Órbita',relevantIds:['doc1']},{id:'case2',question:'memoria decisiones',relevantIds:['doc2']}],
 citationLabels:{case1:{'atlas-lexical':true,fts5:true},case2:{'atlas-lexical':true,fts5:true}}
};
test('offline pipeline produces a reproducible report without leaking fixture content',async()=>{
 const a=await runAtlasRetrievalReport(fixture,{warmupRounds:0,measurementRounds:2});
 assert.equal(a.schema,'atlas-retrieval-report-v1');
 assert.equal(a.baseline.queries,2);
 assert.equal(a.recommendation,'collect-more-evidence');
 assert.equal(a.gate.promote,false);
 assert.equal(JSON.stringify(a).includes('El motor Órbita'),false);
 assert.equal(JSON.stringify(a).includes('case1'),false);
});
test('invalid fixtures fail before running the experiment',async()=>{
 await assert.rejects(()=>runAtlasRetrievalReport({documents:[],cases:[]}));
 await assert.rejects(()=>runAtlasRetrievalReport({...fixture,citationLabels:{}}),/Independent citation labels/);
});
