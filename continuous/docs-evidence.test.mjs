import test from 'node:test';import assert from 'node:assert/strict';import {createAtlasEvidence,publicDocsQuery} from './docs-evidence.mjs';
test('MCP receives only a public topic vocabulary, with no prompt secrets or conversation data',async()=>{
 const question='Codex MCP authentication token=private-value me@example.test X:/private/file';let query;
 const read=createAtlasEvidence({publicDocs:{search:async text=>{query=text;return{results:[{url:'https://developers.openai.com/plugins/build/auth',title:'Authentication',snippet:'Public reference'}]};}},web:async()=>{throw Error('Unexpected fallback');}});
 const value=await read(question);assert.equal(query,'OpenAI Codex MCP authentication');assert.doesNotMatch(query,/private|example/);assert.match(value.sources[0].method,/fragmento/);assert.equal(publicDocsQuery('Blender materiales'),null);
});
test('an unavailable or irrelevant MCP falls back to public web and cancellation never silently continues',async()=>{
 let calls=0;const controller=new AbortController();
 const read=createAtlasEvidence({publicDocs:{search:async()=>{throw Error('offline');}},web:async()=>{calls++;return{sources:[],errors:[]};}});
 await read('Codex plugins');assert.equal(calls,1);await read('Godot 3D');assert.equal(calls,2);controller.abort(Error('stop'));await assert.rejects(read('Codex MCP',{signal:controller.signal}),/stop/);assert.equal(calls,2);
});

test('failed discovery can read curated documentation without replacing a successful search or ignoring cancellation',async()=>{
 let guidedCalls=0;const controller=new AbortController();
 const adapters={publicDocs:{search:async()=>({results:[]})},web:async()=>{throw Error('Google requires JavaScript');},guided:async(question)=>{guidedCalls++;assert.match(question,/InstancedMesh/);return{sources:[{url:'https://threejs.org/docs/',excerpt:'Direct public reference',method:'lectura directa'}],errors:[]};}};
 const lookup=createAtlasEvidence(adapters),result=await lookup('InstancedMesh geometry');assert.equal(guidedCalls,1);assert.equal(result.sources.length,1);assert.match(result.errors[0],/JavaScript/);
 const successful=createAtlasEvidence({...adapters,web:async()=>({sources:[{url:'https://example.org/',excerpt:'Search result'}],errors:[]})});await successful('InstancedMesh');assert.equal(guidedCalls,1);
 controller.abort(Error('stop'));await assert.rejects(lookup('InstancedMesh',{signal:controller.signal}),/stop/);assert.equal(guidedCalls,1);
});
