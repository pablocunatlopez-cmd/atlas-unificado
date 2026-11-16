import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasOllamaDebate} from './atlas-self-improvement-ollama-debate.mjs';
function mockReply(content){
 const bytes=new TextEncoder().encode(JSON.stringify({message:{content:JSON.stringify(content)}}));
 return {ok:true,headers:{get:()=>null},body:new ReadableStream({
  start(c){c.enqueue(bytes);c.close();}
 })};
}
test('sequential proponent and adversary produce unresolved objections',async()=>{
 const calls=[];
 const fetchImpl=async(_url,options)=>{
  const request=JSON.parse(options.body);calls.push(request);
  return calls.length===1?
   mockReply({thesis:'Improve evidence review',evidenceReference:'docs/roadmap.md:1',responses:[]}):
   mockReply({counterargument:'Evidence may be stale',
    evidenceReference:'docs/roadmap.md:2',
    objections:[{id:'O1',claim:'Stale source',evidenceReference:'docs/roadmap.md:2'}]});
 };
 const result=await createAtlasOllamaDebate({fetchImpl}).debate({
  proposal:{id:'SELF_012',problem:'Unverified claims'}});
 assert.equal(calls.length,2);assert.equal(result.modelCalls,2);
 assert.equal(result.verdict,'unresolved_objections');
 assert.equal(result.modelArgumentsVerified,false);
 assert.equal(result.authorizationGranted,false);
 assert.equal(calls[1].messages[0].content.includes('adversary'),true);
});
test('malformed model output fails closed',async()=>{
 const bad=async()=>mockReply({thesis:'Missing adversary schema'});
 await assert.rejects(()=>createAtlasOllamaDebate({fetchImpl:bad}).debate({
  proposal:{id:'SELF_012'}}));
});
