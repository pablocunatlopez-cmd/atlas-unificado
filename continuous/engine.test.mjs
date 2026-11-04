import test from 'node:test';
import assert from 'node:assert/strict';
import {experiment,extractText,hash,discoverLinks,replayIndices,searchDocuments} from './engine.mjs';
import {TinyLanguageModel,validateSnapshot} from '../public/core/language-model.mjs';
const docs=[
 {url:'https://example.org/train',role:'train',text:'La evidencia permite contrastar afirmaciones y registrar errores. '.repeat(20),hash:'a'},
 {url:'https://example.org/val',role:'validation',text:'Una observacion independiente sirve para evaluar una hipotesis. '.repeat(20),hash:'b'}
];
test('rechaza contaminación entre documentos',async()=>{
 await assert.rejects(experiment(null,[docs[0],{...docs[1],hash:'a'}],100),/Contaminación/);
 await assert.rejects(experiment(null,[docs[0],{...docs[1],url:docs[0].url}],100),/Contaminación/);
});
test('cancelación no cambia los pesos de entrada',async()=>{
 const snapshot=new TinyLanguageModel().snapshot(),digest=hash(JSON.stringify(snapshot));
 await assert.rejects(experiment(snapshot,docs,100,()=>true),/pausado/);
 assert.equal(hash(JSON.stringify(snapshot)),digest);
});
test('entrena en CPU, produce un checkpoint restaurable y preserva el anterior',async()=>{
 const snapshot=new TinyLanguageModel().snapshot(),digest=hash(JSON.stringify(snapshot));
 const r=await experiment(snapshot,docs,100);
 assert.equal(r.candidate.steps,100);assert.ok(validateSnapshot(r.candidate));
 assert.ok(Number.isFinite(r.metrics.after));assert.equal(hash(JSON.stringify(snapshot)),digest);
 assert.deepEqual(new TinyLanguageModel(r.candidate).snapshot(),r.candidate);
});
test('excluye scripts y navegación del texto',()=>{
 assert.equal(extractText('<main><nav>menu</nav><script>bad()</script><p>Texto &amp; datos</p></main>'),'Texto & datos');
});
test('decodifica entidades HTML hexadecimales y tipográficas en extractos',()=>{
 assert.equal(extractText('<main>Part&#xED;cula&#x27;s &mdash; &hellip;</main>'),"Partícula's — …");
});
test('descubrimiento limitado a documentación pública, sin destinos locales ni duplicados',()=>{
 const html='<a href="/es/docs/Web/API/Canvas_API#x">a</a><a href="/es/docs/Web/API/Canvas_API">b</a><a href="http://127.0.0.1/">c</a><a href="https://evil.test/">d</a><a href="https://user@developer.mozilla.org/es/docs/Web/API">e</a>';
 assert.deepEqual(discoverLinks(html,'https://developer.mozilla.org/es/docs/Web/'),['https://developer.mozilla.org/es/docs/Web/API/Canvas_API']);
});
test('el documento más reciente entra en entrenamiento incluso con 300 documentos',()=>{
 const indices=replayIndices(300,3000,27);
 assert.equal(indices.filter(i=>i===299).length,15);
 assert.ok(indices.includes(27));assert.ok(indices.every(i=>i>=0&&i<300));
});
test('la memoria devuelve extractos de fuentes y nunca documentos de validación',()=>{
 const results=searchDocuments(docs,'evidencia');
 assert.equal(results.length,1);assert.equal(results[0].url,docs[0].url);
 assert.ok(results[0].excerpt.includes('evidencia'));
 assert.deepEqual(searchDocuments(docs,'hipotesis'),[]);
 assert.deepEqual(searchDocuments(docs,'zzzzzzzzz'),[]);
});

test('referencias públicas requieren opt-in explícito y nunca habilitan roles privados o desconocidos',()=>{
 const documents=[
  {url:'https://example.org/train-scope',role:'train',text:'La evidencia local explica el método de contraste.',fetchedAt:'2026-11-04T12:00:00Z'},
  {url:'https://example.org/reference-scope',role:'reference',text:'La referencia pública describe interferometria y evidencia.',fetchedAt:'2026-11-04T12:01:00Z'},
  ...['validation','private','system','unknown',undefined].map((role,index)=>({url:'https://example.org/excluded-'+index,role,text:'Interferometria evidencia reservada.'}))
 ];
 assert.deepEqual(searchDocuments(documents,'interferometria'),[]);
 assert.deepEqual(searchDocuments(documents,'interferometria',5,{includeReferences:false}),[]);
 const included=searchDocuments(documents,'interferometria',5,{includeReferences:true});
 assert.deepEqual(included.map(result=>result.url),['https://example.org/reference-scope']);assert.equal(included[0].fetchedAt,documents[1].fetchedAt);
 assert.deepEqual(searchDocuments(documents,'evidencia',5,{includeReferences:true}).map(result=>result.url).sort(),documents.slice(0,2).map(document=>document.url).sort());
});

test('la caché mantiene separados los ámbitos de recuperación en ambos órdenes de consulta',()=>{
 for(const referenceFirst of [false,true]){
  const documents=[{url:'https://example.org/train',role:'train',text:'evidencia contraste repetible'},{url:'https://example.org/reference',role:'reference',text:'evidencia fotonica repetible'}];
  const include=()=>searchDocuments(documents,'evidencia',5,{includeReferences:true}),exclude=()=>searchDocuments(documents,'evidencia');
  if(referenceFirst)include();else exclude();
  assert.equal(include().length,2);assert.deepEqual(exclude().map(result=>result.url),['https://example.org/train']);assert.deepEqual(searchDocuments(documents,'evidencia',5,{includeReferences:false}),exclude());
 }
});

test('opt-in conserva límites y puntuación léxica sin inventar vectores ni verificación',()=>{
 const documents=Array.from({length:4},(_,index)=>({url:'https://example.org/reference-'+index,role:'reference',text:('evidencia fotonica '+index+' ').repeat(150)}));
 const results=searchDocuments(documents,'evidencia fotonica',2,{includeReferences:true});assert.equal(results.length,2);
 for(const result of results){assert.ok(Number.isFinite(result.score)&&result.score>=0&&result.score<=1);assert.ok(result.excerpt.length<=850);assert.deepEqual(result.matchedTerms,['evidencia','fotonica']);assert.equal(Object.hasOwn(result,'embedding'),false);assert.equal(Object.hasOwn(result,'verified'),false);}
 for(const options of [null,[],true,{includeReferences:'true'},{includeReferences:null},{allowedRoles:['private']}])assert.throws(()=>searchDocuments(documents,'evidencia',5,options),/Opciones|booleano/);
});

test('recuperar referencias no las incorpora al entrenamiento del laboratorio',async()=>{
 const reference={url:'https://example.org/reference-only',role:'reference',text:'Marcador publico del ensayo fotonico. '.repeat(40),hash:'reference'};
 assert.equal(searchDocuments([reference],'fotonico',5,{includeReferences:true}).length,1);
 await assert.rejects(experiment(null,[reference,docs[1]],100),/Faltan documentos separados/);
});
