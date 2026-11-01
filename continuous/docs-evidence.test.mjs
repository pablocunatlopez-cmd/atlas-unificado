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
