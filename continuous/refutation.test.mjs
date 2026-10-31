import test from 'node:test';
import assert from 'node:assert/strict';
import {makeClaim} from './refutation.mjs';
test('respuestas y fuentes no se convierten en verdad ni datos de entrenamiento',()=>{
 const c=makeClaim({claim:'Un agente dice que mejora',status:'verified',eligibleForTraining:true,evidence:[{direction:'support',text:'Lo afirma una IA',source:'https://example.org'}]});
 assert.equal(c.status,'pending');assert.equal(c.eligibleForTraining,false);assert.equal(c.evidence[0].verification,'unverified');
});
test('contradicciones quedan abiertas, no se resuelven por votación',()=>{
 const c=makeClaim({claim:'Hipótesis',evidence:[{direction:'support',text:'A'},{direction:'against',text:'B'}]});
 assert.equal(c.status,'disputed');assert.equal(c.eligibleForTraining,false);
});
test('rechaza fuentes ejecutables y tamaños excesivos',()=>{
 assert.throws(()=>makeClaim({claim:'x',evidence:[{direction:'support',text:'x',source:'javascript:alert(1)'}]}));
 assert.throws(()=>makeClaim({claim:'x'.repeat(4001)}));
});
