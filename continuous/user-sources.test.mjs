import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceDescriptor,extractUserSourceUrls,fetchUserReference,trainingDocuments} from './user-sources.mjs';
test('repositorios y fuentes públicas se conservan como referencias sin convertirlas en datos de entrenamiento',()=>{
 assert.equal(sourceDescriptor('https://github.com/ggml-org/llama.cpp?tab=readme#x').url,'https://github.com/ggml-org/llama.cpp?tab=readme');
 assert.equal(sourceDescriptor('https://github.com/ggml-org/llama.cpp').role,'reference');
 assert.equal(sourceDescriptor('https://docs.python.org/3/tutorial/index.html').role,'train');
 assert.deepEqual(trainingDocuments([{role:'reference'},{role:'train'},{role:'validation'}]).map(d=>d.role),['train','validation']);
});
test('rechaza direcciones privadas y credenciales y deduplica enlaces',()=>{
 for(const url of ['http://github.com/a/b','https://localhost/','https://127.0.0.1/','https://[::1]/','https://localhost./','https://user:pass@example.com/'])assert.throws(()=>sourceDescriptor(url));
 assert.deepEqual(extractUserSourceUrls('Lee https://github.com/a/b. Y https://github.com/a/b#intro'),['https://github.com/a/b']);
});
test('ingiere texto con hash y procedencia sin seguir los enlaces de la página',async()=>{
 let calls=0;const source=await fetchUserReference({url:'https://github.com/a/b'},{get:async url=>{calls++;return {url,text:'<main>'+('Referencia de prueba. '.repeat(50))+'<a href="https://example.com">Enlace</a></main>'};}});
 assert.equal(calls,1);assert.equal(source.role,'reference');assert.equal(source.hash.length,64);assert.ok(source.text.length>100);
});
test('una página vacía y una cancelación no se registran como aprendizaje',async()=>{
 await assert.rejects(fetchUserReference({url:'https://example.com/'},{get:async()=>({text:'vacía',url:'https://example.com/'})}),/suficiente/);
 const signal=AbortSignal.abort(Error('Pausa'));
 await assert.rejects(fetchUserReference({url:'https://example.com/'},{signal,get:async()=>{throw Error('No invocar');}}),/Pausa/);
});
