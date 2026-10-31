import test from 'node:test';
import assert from 'node:assert/strict';
import {readChatResponse} from './chat-response-stream.mjs';
const encoder=new TextEncoder();
function response(chunks){return new Response(new ReadableStream({start(controller){for(const chunk of chunks)controller.enqueue(typeof chunk==='string'?encoder.encode(chunk):chunk);controller.close();}}),{headers:{'content-type':'application/x-ndjson'}});}
test('NDJSON handles split UTF-8 while preserving provisional events separately from final result',async()=>{
 const bytes=encoder.encode(JSON.stringify({type:'stage',stage:'draft'})+'\n'+JSON.stringify({type:'delta',stage:'draft',text:'España 🙂'})+'\n'+JSON.stringify({type:'result',result:{answer:'Final corregido',reviewed:true}})+'\n');
 const chunks=[...bytes].map(byte=>new Uint8Array([byte]));const events=[];
 const result=await readChatResponse(response(chunks),{onEvent:e=>events.push(e)});
 assert.equal(result.answer,'Final corregido');assert.equal(events.length,2);assert.equal(events[1].text,'España 🙂');
});
test('review changes stage and only final server answer is returned',async()=>{
 const events=[];const result=await readChatResponse(response(['{"type":"delta","stage":"draft","text":"Borrador"}\n{"type":"stage","stage":"review"}\n{"type":"delta","stage":"review","text":"Revisado"}\n{"type":"result","result":{"answer":"Revisado final"}}']),{onEvent:e=>events.push(e)});
 assert.equal(events[1].stage,'review');assert.equal(result.answer,'Revisado final');
});
test('truncated or malformed stream rejects rather than promoting a draft',async()=>{
 await assert.rejects(readChatResponse(response(['{"type":"delta","stage":"draft","text":"Partial"}\n'])),/sin una respuesta final/);
 await assert.rejects(readChatResponse(response(['not JSON\n'])),/mensaje inválido/);
});
test('server error after a provisional answer is reported',async()=>{
 await assert.rejects(readChatResponse(response(['{"type":"delta","text":"Partial"}\n{"type":"error","error":"Motor no disponible"}\n'])),/Motor no disponible/);
});
test('legacy JSON still works and HTTP failures are rejected',async()=>{
 assert.equal((await readChatResponse(Response.json({answer:'Legacy'}))).answer,'Legacy');
 await assert.rejects(readChatResponse(Response.json({error:'Ocupado'},{status:429})),/Ocupado/);
});
test('stop cancels a pending stream read and does not return provisional output',async()=>{
 const controller=new AbortController();let cancelled=false;
 const pending=new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/x-ndjson'}});
 const read=readChatResponse(pending,{signal:controller.signal});controller.abort();
 await assert.rejects(read,{name:'AbortError'});assert.equal(cancelled,true);
});
