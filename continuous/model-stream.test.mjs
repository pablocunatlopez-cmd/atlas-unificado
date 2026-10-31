import test from 'node:test';
import assert from 'node:assert/strict';
import {readModelStream} from './model-stream.mjs';

const encoder=new TextEncoder();
const event=packet=>'data: '+JSON.stringify(packet)+'\n\n';
const content=text=>({choices:[{index:0,delta:{content:text},finish_reason:null}]});
function response(text,size=37){
 const bytes=encoder.encode(text);
 return {body:(async function*(){for(let i=0;i<bytes.length;i+=size)yield bytes.subarray(i,i+size);})()};
}

test('decodes fragmented UTF-8 and data lines, emitting only visible text',async()=>{
 const deltas=[];
 const text=': keep alive\r\n\r\n'+event({choices:[{index:0,delta:{reasoning_content:'privado'},finish_reason:null}]})+
  event(content('¡Hola 🌍! '))+event(content('Sí.'))+'data: [DONE]\r\n\r\n';
 const result=await readModelStream(response(text,1),{onDelta:delta=>deltas.push(delta)});
 assert.equal(result.choices[0].message.content,'¡Hola 🌍! Sí.');
 assert.deepEqual(deltas,['¡Hola 🌍! ','Sí.']);
 assert.equal(result.choices[0].finish_reason,'stop');
 assert.ok(!JSON.stringify(result).includes('privado'));
});

test('retains finish reason and usage that arrive after the final content',async()=>{
 const text=event(content('Respuesta'))+event({choices:[{index:0,delta:{},finish_reason:'length'}]})+
  event({choices:[],usage:{prompt_tokens:12,completion_tokens:4,total_tokens:16}});
 const result=await readModelStream(response(text));
 assert.equal(result.choices[0].finish_reason,'length');
 assert.deepEqual(result.usage,{prompt_tokens:12,completion_tokens:4,total_tokens:16});
});

test('accepts an unterminated DONE line and ignores alternative choices',async()=>{
 const text=event({choices:[{index:1,delta:{content:'Other'}}]})+event(content('Primary'))+'data: [DONE]';
 assert.equal((await readModelStream(response(text))).choices[0].message.content,'Primary');
});

test('joins multiline SSE data before parsing JSON',async()=>{
 const text='data: {"choices":\n'+'data: [{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n';
 assert.equal((await readModelStream(response(text))).choices[0].message.content,'ok');
});

test('rejects malformed JSON and streams missing a terminal marker',async()=>{
 await assert.rejects(readModelStream(response('data: {broken}\n\n')),/JSON inválido/);
 await assert.rejects(readModelStream(response(event(content('partial')))),/sin confirmar/);
});

test('rejects non-text content, oversized lines and oversized visible output',async()=>{
 await assert.rejects(readModelStream(response(event(content({text:'bad'}))+'data: [DONE]\n\n')),/no textual/);
 await assert.rejects(readModelStream(response('data: '+'x'.repeat(100001))),/longitud/);
 const text=event(content('x'.repeat(60000)))+event(content('y'.repeat(50000)))+'data: [DONE]\n\n';
 await assert.rejects(readModelStream(response(text)),/longitud/);
});

test('pre-aborted signal preserves its reason and does not consume the stream',async()=>{
 const controller=new AbortController(),reason=new Error('Usuario detuvo la respuesta');controller.abort(reason);
 let read=false;
 const source={body:{[Symbol.asyncIterator](){read=true;return {next:async()=>({done:true})};}}};
 await assert.rejects(readModelStream(source,{signal:controller.signal}),error=>error===reason);
 assert.equal(read,false);
});

test('aborting an idle stream rejects promptly and asks the producer to close',async()=>{
 const controller=new AbortController(),reason=new Error('Cancelación');let closed=false;
 const source={body:{[Symbol.asyncIterator](){return {next:()=>new Promise(()=>{}),return:async()=>{closed=true;return {done:true};}};}}};
 const work=readModelStream(source,{signal:controller.signal});controller.abort(reason);
 await assert.rejects(work,error=>error===reason);
 await Promise.resolve();assert.equal(closed,true);
});

test('abort triggered during a delta callback is not converted to a partial success',async()=>{
 const controller=new AbortController(),reason=new Error('Stop after first delta');
 await assert.rejects(readModelStream(response(event(content('first'))+'data: [DONE]\n\n'),{
  signal:controller.signal,onDelta:()=>controller.abort(reason)
 }),error=>error===reason);
});

test('SSE hides thought envelopes split between model content deltas and UTF-8 bytes',async()=>{
 const deltas=[];
 const pieces=['<th','ink>privado 🌍','</th','ink>\n\n','Órbita'];
 const text=pieces.map(piece=>event(content(piece))).join('')+'data: [DONE]\n\n';
 const result=await readModelStream(response(text,1),{onDelta:delta=>deltas.push(delta)});
 assert.equal(result.choices[0].message.content,'Órbita');
 assert.equal(deltas.join(''),'Órbita');
});

test('SSE final result repairs an orphan closing tag without scrubbing source code',async()=>{
 for(const [raw,expected] of [
  ['Órbita\n</think>\n\nÓrbita','Órbita'],
  ['const text = `<think>\n</think>\n`;','const text = `<think>\n</think>\n`;'],
  ['```js\nconst text="</think>";\n```','```js\nconst text="</think>";\n```']
 ]){
  const text=Array.from(raw).map(char=>event(content(char))).join('')+'data: [DONE]\n\n';
  const result=await readModelStream(response(text,11));
  assert.equal(result.choices[0].message.content,expected);
 }
});

test('hidden thinking still counts against the content limit',async()=>{
 const text=event(content('<think>'+'x'.repeat(60000)))+event(content('y'.repeat(50000)))+'data: [DONE]\n\n';
 await assert.rejects(readModelStream(response(text)),/longitud/);
});
