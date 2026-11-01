import test from 'node:test';import assert from 'node:assert/strict';import {requestsAtlasReview} from './atlas-intent.mjs';
test('explicit requests wake review while code questions, negations and quoted explanations stay conversational',()=>{
 for(const value of ['Mejórate y revisa tus capacidades','Sigue aprendiendo por ti mismo','Revisa tu núcleo','Empieza a mejorarte','Continúa mejorándote'])assert.equal(requestsAtlasReview(value),true,value);
 for(const value of ['No te mejores todavía','Mejora este código','Explica qué significa «mejórate»','Revisa mi casa 3D','¿Qué puedes hacer?','Pausa tu núcleo'])assert.equal(requestsAtlasReview(value),false,value);
});
