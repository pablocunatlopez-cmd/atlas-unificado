import {test} from 'node:test';
import assert from 'node:assert/strict';
import {proposeAtlasRetrievalRoute} from './atlas-retrieval-router.mjs';
test('exact identifiers choose the exact-search candidate',()=>{
 const r=proposeAtlasRetrievalRoute('Find RFC 9110 and Q594',{baseline:'atlas-lexical'});
 assert.equal(r.route,'exact-identifier');assert.equal(r.method,'fts5');
 assert.equal(r.autoSwitch,false);assert.equal(r.semanticExecuted,false);
});
test('conceptual questions do not execute unvalidated semantic models',()=>{
 const r=proposeAtlasRetrievalRoute('¿Por qué cambia la memoria?',{semanticAvailable:true,semanticReviewed:false});
 assert.equal(r.route,'conceptual');assert.equal(r.method,'atlas-lexical');
 assert.equal(r.suggestedExperiment,null);
 const reviewed=proposeAtlasRetrievalRoute('Explain the relationship',{semanticAvailable:true,semanticReviewed:true});
 assert.equal(reviewed.suggestedExperiment,'semantic-candidate-review');
 assert.equal(reviewed.method,'atlas-lexical');
});
test('ambiguous requests fall back to baseline, not guessed semantics',()=>{
 const r=proposeAtlasRetrievalRoute('memoria',{baseline:'fts5'});
 assert.equal(r.route,'ambiguous');assert.equal(r.method,'fts5');
 assert.equal(r.requiresReview,true);
});
test('invalid inputs are rejected',()=>{
 assert.throws(()=>proposeAtlasRetrievalRoute(''));
 assert.throws(()=>proposeAtlasRetrievalRoute('hello',{baseline:'unknown'}));
 assert.throws(()=>proposeAtlasRetrievalRoute('hello',{semanticAvailable:'yes'}));
});

test('multilingual accented questions are classified without ASCII word-boundary bias',()=>{
 for(const q of ['¿Cómo funciona la memoria?','¿Qué significa relación?','Explain the difference','por qué recordamos']){
  assert.equal(proposeAtlasRetrievalRoute(q).route,'conceptual',q);
 }
});
test('mixed conceptual and exact identifiers prioritize grounded exact matching',()=>{
 const r=proposeAtlasRetrievalRoute('Explain why Q594 changed');
 assert.equal(r.route,'exact-identifier');
 assert.equal(r.method,'fts5');
 assert.equal(r.semanticExecuted,false);
});
test('partial keywords and uncertain typos do not trigger a guessed semantic engine',()=>{
 for(const q of ['comparativa','conceptualizar','memoriaa','reIacion']){
  const r=proposeAtlasRetrievalRoute(q);
  assert.equal(r.method,'atlas-lexical');
  assert.equal(r.autoSwitch,false);
 }
});
