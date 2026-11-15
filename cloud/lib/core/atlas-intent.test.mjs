import test from 'node:test';import assert from 'node:assert/strict';import {requestsAtlasReview,resolveCloudRequestKind} from './atlas-intent.mjs';
test('explicit requests wake review while code questions, negations and quoted explanations stay conversational',()=>{
 for(const value of ['Mejórate y revisa tus capacidades','Sigue aprendiendo por ti mismo','Revisa tu núcleo','Empieza a mejorarte','Continúa mejorándote'])assert.equal(requestsAtlasReview(value),true,value);
 for(const value of ['No te mejores todavía','Mejora este código','Explica qué significa «mejórate»','Revisa mi casa 3D','¿Qué puedes hacer?','Pausa tu núcleo'])assert.equal(requestsAtlasReview(value),false,value);
});
test('multimodal requests and capability questions stay in chat unless the UI selects a tool',()=>{
 for(const message of ['Quiero que seas una IA conversacional y generadora de 3D, música y vídeo','¿Por qué no puedes crear vídeos mejores?','Crea una casa 3D con música','Analiza cómo mejorar tu programación y generación de vídeo'])assert.equal(resolveCloudRequestKind({message}),'chat',message);
 assert.equal(resolveCloudRequestKind({message:'Mejórate y revisa tus capacidades'}),'review');
 for(const kind of ['chat','world','game','video','lor'])assert.equal(resolveCloudRequestKind({kind,message:'Mejórate y crea un vídeo'}),kind);
 assert.equal(resolveCloudRequestKind({kind:null,message:'Hola'}),null,'invalid explicit kinds remain subject to queue validation');
});
