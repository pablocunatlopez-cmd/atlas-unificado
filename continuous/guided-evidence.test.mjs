import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuidedEvidence} from './guided-evidence.mjs';

const source=url=>({sources:[{url,excerpt:'Observed reference text.',method:'Page read'}],errors:[]});
test('Claude public references are read without sending a question or attempting model authentication',async()=>{
 for(const [name,url] of [['Claude Agent SDK','https://raw.githubusercontent.com/anthropics/claude-agent-sdk-python/main/README.md'],['skills de Claude','https://raw.githubusercontent.com/anthropics/skills/main/README.md']]){
  const calls=[],lookup=createGuidedEvidence({read:async(target,options)=>{calls.push({target,options});return source(target);}});
  const result=await lookup(name+' para mi proyecto privado, never-send-this');
  assert.equal(calls.length,1);assert.equal(calls[0].target,url);assert.deepEqual(Object.keys(calls[0].options),['signal']);
  assert.doesNotMatch(JSON.stringify(calls),/never-send-this|authorization|api_key/);assert.equal(result.sources[0].epistemicStatus,'unverified-source');
 }
});

test('a specific rendering term selects Three.js docs without transmitting the private question',async()=>{
 const calls=[],lookup=createGuidedEvidence({read:async(url,options)=>{calls.push({url,options});return source(url);}});
 const result=await lookup('InstancedMesh para mi casa privada, clave=never-send-this');
 assert.deepEqual(calls.map(item=>item.url),['https://threejs.org/docs/pages/InstancedMesh.html']);
 assert.equal(Object.keys(calls[0].options).join(','),'signal');
 assert.equal(result.sources.length,1);assert.match(result.sources[0].method,/Lectura directa/);assert.match(result.sources[0].method,/no búsqueda global/);assert.equal(result.sources[0].epistemicStatus,'unverified-source');
 assert.doesNotMatch(JSON.stringify(calls),/privada|never-send/);
});

test('generic words, arbitrary URLs and substrings do not trigger reads',async()=>{
 let reads=0;const lookup=createGuidedEvidence({read:async()=>{reads++;return source('https://threejs.org/docs/');}});
 for(const question of ['mejora la casa con agentes y modelos','https://example.org/custom','quiero three personas','aiderish software','Llama 3 es un modelo','assets nuevos'])assert.deepEqual((await lookup(question)).sources,[]);
 assert.equal(reads,0);
});

test('docs are preferred and a failed docs read can fall back to its known repository',async()=>{
 const calls=[],lookup=createGuidedEvidence({read:async url=>{calls.push(url);if(calls.length===1)throw Error('private provider token is not copied');return source(url);}});
 const result=await lookup('Three.js optimización');
 assert.deepEqual(calls,['https://threejs.org/docs/','https://github.com/mrdoob/three.js']);assert.equal(result.sources.length,1);assert.equal(result.errors.length,1);assert.doesNotMatch(JSON.stringify(result),/private provider token/);
});

test('a source-free read also falls back, and all selected resources share a two-read limit',async()=>{
 const calls=[],lookup=createGuidedEvidence({read:async url=>{calls.push(url);return {sources:[],errors:['search unavailable']};}});
 const result=await lookup('InstancedMesh, Aider, smolagents, glTF');
 assert.equal(calls.length,2);assert.equal(result.sources.length,0);assert.equal(result.errors.length,2);
});

test('two different matching references can be read sequentially without following arbitrary response links',async()=>{
 let active=0,maximum=0;const calls=[];
 const lookup=createGuidedEvidence({read:async url=>{active++;maximum=Math.max(maximum,active);calls.push(url);await Promise.resolve();active--;return source(url);}});
 const result=await lookup('Aider y smolagents');assert.equal(calls.length,2);assert.equal(maximum,1);assert.equal(result.sources.length,2);
});

test('cancellation propagates before reading and after an in-flight failure without fallback',async()=>{
 const controller=new AbortController();let reads=0;
 const lookup=createGuidedEvidence({read:async()=>{reads++;controller.abort(Error('stop requested'));throw Error('reader failure');}});
 await assert.rejects(lookup('InstancedMesh',{signal:controller.signal}),/stop requested/);assert.equal(reads,1);
 await assert.rejects(lookup('InstancedMesh',{signal:controller.signal}),/stop requested/);assert.equal(reads,1);
});

test('only the requested source or an identified public HTTPS redirect with real text is accepted',async()=>{
 const url='https://threejs.org/docs/';let count=0;
 const lookup=createGuidedEvidence({read:async requested=>{count++;if(count>1)return {sources:[]};return {sources:[null,{url:'http://example.org/a',requestedUrl:requested,excerpt:'HTTP'},{url:'https://127.0.0.1/private',requestedUrl:requested,excerpt:'Private'},{url:'https://evil.example/other',excerpt:'Unrelated'},{url,excerpt:42},{url:'https://threejs.org/manual/',requestedUrl:requested,excerpt:'Redirected text',fetchedAt:'2026-11-02T07:00:00Z'},{url:'https://user:secret@example.org/',requestedUrl:requested,excerpt:'Credentials'}]};}});
 const result=await lookup('threejs');assert.equal(result.sources.length,1);assert.equal(result.sources[0].url,'https://threejs.org/manual/');assert.equal(result.sources[0].requestedUrl,url);assert.equal(result.sources[0].fetchedAt,'2026-11-02T07:00:00.000Z');
});

test('unusable custom reference URLs never reach the reader and malformed replies are harmless',async()=>{
 let calls=0;const resources=[{id:'specific-engine',name:'Specific Engine',url:'http://example.org/'},{id:'other-engine',name:'Other Engine',url:'https://localhost/'},{id:'query-engine',name:'Query Engine',url:'https://example.org/?token=private'}];
 const lookup=createGuidedEvidence({resources,read:async()=>{calls++;return undefined;}});
 assert.deepEqual((await lookup('Specific Engine, Other Engine, Query Engine')).sources,[]);assert.equal(calls,0);
 const malformed=createGuidedEvidence({read:async()=>undefined});assert.deepEqual((await malformed('threejs')).sources,[]);
});

test('distinctive known tools and course names route to their curated references',async()=>{
 for(const [question,url] of [['llama.cpp server','https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md'],['EvalPlus casos','https://github.com/evalplus/evalplus'],['lm-evaluation-harness','https://github.com/EleutherAI/lm-evaluation-harness/blob/main/docs/API_guide.md'],['MIT 6.006 algorithms','https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/']]){
  const calls=[],lookup=createGuidedEvidence({read:async current=>{calls.push(current);return source(current);}});await lookup(question);assert.equal(calls[0],url);
 }
});

test('Spanish spatial geometry questions reach the fixed readable bounds reference without naming a library',async()=>{
 for(const question of ['¿Cómo contrastar la geometría 3D y sus semiejes?','Quiero comprobar las colisiones de las mallas de mi casa privada, clave=never-send','Envolventes de la maqueta de la terraza','AABB y Box3: comprobar límites']){
  const calls=[],lookup=createGuidedEvidence({read:async(url,options)=>{calls.push({url,options});return source(url);}});
  const result=await lookup(question);
  assert.equal(calls.length,1);assert.equal(calls[0].url,'https://threejs.org/docs/pages/Box3.html');assert.equal(result.sources[0].requestedUrl,calls[0].url);
  assert.deepEqual(Object.keys(calls[0].options),['signal']);assert.doesNotMatch(JSON.stringify(calls),/privada|never-send|clave/);
 }
 let calls=0;const lookup=createGuidedEvidence({read:async()=>{calls++;return source('https://threejs.org/docs/');}});
 for(const question of ['Mejora mi casa','Explora una mejora 3D','Mejora mi geometría lógica','Geometría de mi argumento sobre Dios'])assert.deepEqual((await lookup(question)).sources,[]);
 assert.equal(calls,0);
});

test('a static class read can use the known repository once and a custom resource cannot acquire reviewed URLs by id',async()=>{
 const calls=[],lookup=createGuidedEvidence({read:async url=>{calls.push(url);return calls.length===1?{sources:[]}:source(url);}});
 const result=await lookup('Colisiones de la geometría 3D');
 assert.deepEqual(calls,['https://threejs.org/docs/pages/Box3.html','https://github.com/mrdoob/three.js']);assert.equal(result.sources.length,1);
 const customCalls=[],custom=createGuidedEvidence({resources:[{id:'three',name:'Three.js',url:'https://example.org/engine',docs:'https://example.org/docs/'}],read:async url=>{customCalls.push(url);return source(url);}});
 await custom('Geometría 3D');assert.deepEqual(customCalls,[]);
 await custom('Three.js');assert.deepEqual(customCalls,['https://example.org/docs/']);
});
