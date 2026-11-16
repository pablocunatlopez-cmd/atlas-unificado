import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRetrievalLab} from './retrieval-lab.mjs';
import {compareRetrievalLabStrategies} from './atlas-retrieval-lab-comparison.mjs';
const docs=[{id:'orbit',title:'Q594 Órbita',text:'El prototipo Q594 utiliza el motor Órbita.'},{id:'memory',title:'Memoria',text:'La memoria conserva decisiones.'}];
const cases=[{id:'q1',question:'Q594 Órbita',relevantIds:['orbit']},{id:'q2',question:'memoria decisiones',relevantIds:['memory']}];
const labels={q1:{'atlas-lexical':true,fts5:true},q2:{'atlas-lexical':true,fts5:true}};
test('paired lab actually queries both in-memory engines and keeps review-only verdict',t=>{
 const lab=createRetrievalLab(docs);t.after(()=>lab.close());
 const r=compareRetrievalLabStrategies(lab,cases,{citationLabels:labels});
 assert.equal(r.baseline.queries,2);assert.equal(r.candidate.queries,2);
 assert.equal(r.baseline.corpusHash,r.candidate.corpusHash);
 assert.equal(r.gate.verdict,'insufficient-evidence');
 assert.equal(r.autoPromote,false);assert.equal(r.modelDownloads,0);
 assert.match(r.measurementScope,/excludes generation/);
});
test('missing independent citation labels fail closed',t=>{
 const lab=createRetrievalLab(docs);t.after(()=>lab.close());
 assert.throws(()=>compareRetrievalLabStrategies(lab,cases,{citationLabels:{q1:labels.q1}}),/Independent citation labels/);
 assert.throws(()=>compareRetrievalLabStrategies(lab,cases,{citationLabels:labels,limit:3}));
});
test('same method is deterministic in retrieved results but never claims deterministic timings',t=>{
 const lab=createRetrievalLab(docs);t.after(()=>lab.close());
 const r=compareRetrievalLabStrategies(lab,cases,{baselineMethod:'fts5',candidateMethod:'fts5',citationLabels:labels});
 assert.equal(r.baseline.recallAt5,r.candidate.recallAt5);
 assert.equal(r.baseline.ndcgAt5,r.candidate.ndcgAt5);
 assert.equal(r.gate.promote,false);
});

test('benchmark fingerprints differ if documents change with identical questions and labels',t=>{
 const first=createRetrievalLab(docs);const altered=createRetrievalLab([{...docs[0],text:'Texto distinto sobre Q594 Órbita'},docs[1]]);
 t.after(()=>{first.close();altered.close();});
 const a=compareRetrievalLabStrategies(first,cases,{citationLabels:labels});
 const b=compareRetrievalLabStrategies(altered,cases,{citationLabels:labels});
 assert.notEqual(a.documentCorpusHash,b.documentCorpusHash);
 assert.notEqual(a.baseline.corpusHash,b.baseline.corpusHash);
 assert.equal(a.labelsHash,b.labelsHash);
});

test('alternating AB/BA order is balanced and warmup is excluded',()=>{
 const calls=[];
 const lab={corpusHash:'a'.repeat(64),search(question,{method})=>{
  calls.push(method+':'+question);
  return [{id:question==='one'?'doc1':'doc2'}];
 }};
 const sample=[{id:'one',question:'one',relevantIds:['doc1']},{id:'two',question:'two',relevantIds:['doc2']}];
 const external={one:{'atlas-lexical':true,fts5:true},two:{'atlas-lexical':true,fts5:true}};
 const result=compareRetrievalLabStrategies(lab,sample,{citationLabels:external,warmupRounds:1,measurementRounds:2});
 assert.equal(calls.length,12);
 assert.deepEqual(calls.slice(0,4),['atlas-lexical:one','fts5:one','fts5:two','atlas-lexical:two']);
 assert.equal(result.measurementProtocol.measurementRounds,2);
 assert.equal(result.baseline.queries,2);
 assert.equal(result.gate.verdict,'insufficient-evidence');
});
test('inconsistent retrieval across repeated rounds fails closed',()=>{
 let count=0;
 const lab={corpusHash:'a'.repeat(64),search(){return [{id:++count%2?'doc1':'doc2'}]}};
 assert.throws(()=>compareRetrievalLabStrategies(lab,[{id:'one',question:'one',relevantIds:['doc1']}],{
  citationLabels:{one:{'atlas-lexical':true,fts5:true}},warmupRounds:0,measurementRounds:3
 }),/changed across measurement rounds/);
});
