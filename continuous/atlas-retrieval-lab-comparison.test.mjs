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
