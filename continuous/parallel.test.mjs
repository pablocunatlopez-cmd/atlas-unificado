import test from 'node:test';
import assert from 'node:assert/strict';
import {compareCandidates,workerBudget} from './parallel.mjs';
import {spiralRecord} from './spiral.mjs';
import {TinyLanguageModel} from '../public/core/language-model.mjs';
const docs=[
 {url:'https://example.org/train',role:'train',hash:'a',text:'La evidencia permite comparar resultados y registrar los errores. '.repeat(10)},
 {url:'https://example.org/validation',role:'validation',hash:'b',text:'Toda hipotesis exige una evaluacion independiente y reproducible. '.repeat(10)}
];
test('candidatos paralelos comparables y conservación de la base',async()=>{
 const initial=new TinyLanguageModel().snapshot(),serialized=JSON.stringify(initial);
 const r=await compareCandidates(initial,docs,100,2);
 assert.equal(r.metrics.candidateCount,workerBudget(2));
 assert.equal(JSON.stringify(initial),serialized);
 assert.equal(r.metrics.after,Math.min(...r.metrics.candidates.filter(c=>!c.error).map(c=>c.after)));
 assert.equal(r.metrics.attemptedStepsTotal,100*r.metrics.candidates.filter(c=>!c.error).length);
});
test('cancelación termina los trabajadores',async()=>{
 await assert.rejects(compareCandidates(null,docs,10000,2,()=>true),/pausado/);
});
test('el registro Espiral nunca resuelve Q594 por pérdida local',()=>{
 const record=spiralRecord({signature:'test',documents:docs,mandateHash:'x',result:{metrics:{before:3,after:4,steps:100,accepted:false}}});
 assert.equal(record.stages.length,6);assert.equal(record.Q594Resolved,false);
 assert.ok(record.negativeLesson);assert.equal(record.sourceHashes.length,2);
});
