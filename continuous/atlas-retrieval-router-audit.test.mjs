import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAtlasRetrievalRouter} from './atlas-retrieval-router-audit.mjs';
test('labeled routing audit measures false positives and negatives without switching engines',()=>{
 const cases=[
  {id:'a',question:'Find Q594',expected:'exact-identifier'},
  {id:'b',question:'¿Cómo funciona?',expected:'conceptual'},
  {id:'c',question:'memoria',expected:'ambiguous'},
  {id:'d',question:'Explain the relationship',expected:'ambiguous'}
 ];
 const result=evaluateAtlasRetrievalRouter(cases);
 assert.equal(result.cases,4);
 assert.equal(result.accuracy,.75);
 assert.equal(result.confusionMatrix.ambiguous.conceptual,1);
 assert.equal(result.perClass.conceptual.falsePositives,1);
 assert.equal(result.perClass.ambiguous.falseNegatives,1);
 assert.equal(result.adequateSample,false);
 assert.equal(result.autoSwitch,false);
});
test('duplicate labels and invalid expected classes fail closed',()=>{
 assert.throws(()=>evaluateAtlasRetrievalRouter([{id:'x',question:'hello',expected:'unknown'}]));
 assert.throws(()=>evaluateAtlasRetrievalRouter([{id:'x',question:'hi',expected:'ambiguous'},{id:'x',question:'hi',expected:'ambiguous'}]));
});
