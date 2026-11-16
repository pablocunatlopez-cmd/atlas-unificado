import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasOllamaLoopbackTransport} from './atlas-self-improvement-ollama-transport.mjs';
const req={model:'qwen2.5:7b',stream:false,format:'json',messages:[
 {role:'system',content:'No tools'},{role:'user',content:'Propose'}]};
function response(data){
 const bytes=new TextEncoder().encode(JSON.stringify(data));
 return {ok:true,headers:{get:()=>null},body:new ReadableStream({start(c){c.enqueue(bytes);c.close();}})};
}
test('local transport sends JSON request without executing model tools',async()=>{
 let called=0;
 const transport=createAtlasOllamaLoopbackTransport({fetchImpl:async(url,options)=>{
  called++;assert.equal(url,'http://127.0.0.1:11434/api/chat');
  assert.equal(options.redirect,'error');assert.equal(options.method,'POST');
  return response({message:{content:'{}'}});
 }});
 assert.equal((await transport(req)).message.content,'{}');assert.equal(called,1);
});
test('transport blocks remote endpoints and model tool declarations',async()=>{
 assert.throws(()=>createAtlasOllamaLoopbackTransport({fetchImpl:async()=>{},endpoint:'https://example.com/api/chat'}));
 const transport=createAtlasOllamaLoopbackTransport({fetchImpl:async()=>response({})});
 await assert.rejects(()=>transport({...req,tools:[]}));
});
test('transport caps response bytes',async()=>{
 const transport=createAtlasOllamaLoopbackTransport({fetchImpl:async()=>response({payload:'x'.repeat(2000)}),
  maxResponseBytes:1024});
 await assert.rejects(()=>transport(req),/exceeds limit/);
});
