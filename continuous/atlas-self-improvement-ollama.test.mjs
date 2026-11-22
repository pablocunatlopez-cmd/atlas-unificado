import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasOllamaProposalAdapter} from './atlas-self-improvement-ollama.mjs';
const prompt={task:'Propose',constraints:['No execution'],constitution:'Safety',
 roadmap:'Milestone 7',repositoryContext:'src/index.mjs',rejectedHistory:[]};
test('adapter sends JSON-only no-tool request to injected transport',async()=>{
 let calls=0;
 const adapter=createAtlasOllamaProposalAdapter({requestModel:async request=>{
  calls++;assert.equal(request.stream,false);assert.equal(request.format,'json');
  assert.equal(request.messages[0].role,'system');
  assert.equal(request.messages[1].role,'user');
  return {message:{content:JSON.stringify({observations:[{id:'SELF_005'}]})}};
 }});
 const result=await adapter(prompt);
 assert.equal(calls,1);assert.equal(result.observations[0].id,'SELF_005');
});
test('adapter rejects invalid JSON and extra model fields',async()=>{
 await assert.rejects(()=>createAtlasOllamaProposalAdapter({requestModel:async()=>({
  message:{content:'not json'}})})(prompt));
 await assert.rejects(()=>createAtlasOllamaProposalAdapter({requestModel:async()=>({
  message:{content:JSON.stringify({observations:[{}],tool_calls:[{}]})}})})(prompt));
});
test('adapter refuses invalid model identifiers and absent transport',()=>{
 assert.throws(()=>createAtlasOllamaProposalAdapter({model:'x; rm -rf',requestModel:async()=>({})}));
 assert.throws(()=>createAtlasOllamaProposalAdapter());
});
