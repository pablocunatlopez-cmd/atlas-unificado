import {test} from 'node:test';
import assert from 'node:assert/strict';
import {queryAtlasLocalLlama} from './atlas-local-llama-client.mjs';
test('sends a bounded request only to a loopback endpoint',async()=>{
 let called=false;
 const result=await queryAtlasLocalLlama({messages:[{role:'user',content:'hola'}],
  fetchImpl:async(url,options)=>{
   called=true;
   assert.equal(url,'http://127.0.0.1:8080/v1/chat/completions');
   assert.equal(options.redirect,'error');
   assert.equal(JSON.parse(options.body).stream,false);
   return {ok:true,text:async()=>JSON.stringify({choices:[{message:{content:'hola'}}]})};
  }});
 assert.equal(called,true);
 assert.equal(result.answer,'hola');
 assert.equal(result.local,true);
 assert.equal(result.verified,false);
});
test('rejects remote endpoints and oversized requests before any network call',async()=>{
 let called=false;
 const fetchImpl=async()=>{called=true;};
 await assert.rejects(queryAtlasLocalLlama({endpoint:'https://example.com',messages:[{role:'user',content:'hola'}],fetchImpl}));
 await assert.rejects(queryAtlasLocalLlama({messages:[{role:'user',content:'x'.repeat(16001)}],fetchImpl}));
 assert.equal(called,false);
});
test('fails closed on malformed local server responses',async()=>{
 await assert.rejects(queryAtlasLocalLlama({messages:[{role:'user',content:'hola'}],
  fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify({choices:[]})})}),/Invalid local inference response/);
});
