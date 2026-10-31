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
