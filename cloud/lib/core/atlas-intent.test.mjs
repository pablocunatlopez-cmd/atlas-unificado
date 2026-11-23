import test from 'node:test';import assert from 'node:assert/strict';import {requestsAtlasReview,resolveCloudRequestKind,creationIntent} from './atlas-intent.mjs';
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

test('a direct single commission selects exactly one creation tool',()=>{
 for(const [message,kind]of [['Crea una escena 3D con luz suave','world'],['Hazme un videojuego de exploración','game'],['Compón una canción tranquila sin voz','music'],['Quiero una partitura breve','music'],['Por favor, genera un guion de cine','film'],['Quiero que diseñes un entorno 3D','world'],['Crea una canción sobre alguien que no quiere salir','music']])assert.equal(creationIntent(message),kind,message);
});
test('creation questions, indirect descriptions, denials and ambiguous mixed requests do not execute tools',()=>{
 for(const message of ['¿Puedes crear una canción?','Quiero una explicación de cómo crear una canción','Haz un análisis de la escena 3D','Crea una lista de videojuegos','Quiero un resumen del guion','Crea un script para generar música','Crea una canción, pero no la generes todavía','Quiero una partitura; no hagas nada aún','Crea una escena 3D con música','Haz un vídeo de la escena 3D','Cuando puedas crea una canción','Crea una canción si puedes','"Crea una escena 3D" es solo un ejemplo'])assert.equal(creationIntent(message),null,message);
});
