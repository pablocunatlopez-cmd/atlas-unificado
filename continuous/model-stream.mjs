import {createVisibleAnswerStream} from './visible-output.mjs';

const MAX_CONTENT_CHARS=100000;
const MAX_LINE_CHARS=100000;

function abortReason(signal){
 return signal?.reason??new DOMException('Generación cancelada','AbortError');
}

// Wait for a stream chunk without making cancellation depend on the producer.
async function nextChunk(iterator,signal){
 signal?.throwIfAborted();
 if(!signal)return iterator.next();
 let abort;
 const interrupted=new Promise((_,reject)=>{
  abort=()=>reject(abortReason(signal));
  signal.addEventListener('abort',abort,{once:true});
 });
 try{return await Promise.race([iterator.next(),interrupted]);}
 finally{signal.removeEventListener('abort',abort);}
}

/** Read OpenAI-compatible SSE, exposing only visible content (never reasoning). */
export async function readModelStream(response,{onDelta,signal}={}){
 signal?.throwIfAborted();
 if(!response?.body?.[Symbol.asyncIterator])throw Error('El motor no devolvió un flujo legible.');
 if(onDelta!==undefined&&typeof onDelta!=='function')throw TypeError('onDelta debe ser una función.');
 const iterator=response.body[Symbol.asyncIterator]();
 const decoder=new TextDecoder('utf-8',{fatal:true});
 let pending='',dataLines=[],dataLength=0,receivedChars=0,finishReason=null,usage;
 let doneMarker=false,naturalEnd=false;
 const visible=createVisibleAnswerStream(onDelta);

 function dispatch(){
  if(!dataLines.length)return;
  const data=dataLines.join('\n');dataLines=[];dataLength=0;
  if(data.trim()==='[DONE]'){doneMarker=true;return;}
  let packet;try{packet=JSON.parse(data);}catch{throw Error('El motor devolvió JSON inválido en el flujo.');}
  if(!packet||typeof packet!=='object'||Array.isArray(packet))throw Error('Evento del motor inválido.');
  if(packet.error)throw Error('Error del motor: '+String(packet.error.message||'generación interrumpida').slice(0,500));
  if(packet.usage&&typeof packet.usage==='object'&&!Array.isArray(packet.usage))usage=packet.usage;
  const choice=Array.isArray(packet.choices)?packet.choices.find(c=>c&&(c.index===0||c.index===undefined)):null;
  if(!choice)return;
  const delta=choice.delta?.content;
  if(delta!==null&&delta!==undefined&&typeof delta!=='string')throw Error('El motor devolvió contenido no textual.');
  if(typeof delta==='string'&&delta.length){
   receivedChars+=delta.length;
   if(receivedChars>MAX_CONTENT_CHARS)throw Error('La respuesta del motor supera el límite de longitud.');
   visible.push(delta);signal?.throwIfAborted();
  }
  if(typeof choice.finish_reason==='string'&&choice.finish_reason.length)finishReason=choice.finish_reason;
 }

 function line(value){
  if(value.endsWith('\r'))value=value.slice(0,-1);
  if(value.length>MAX_LINE_CHARS)throw Error('Una línea del flujo supera el límite de longitud.');
  if(value===''){dispatch();return;}
  if(!value.startsWith('data:'))return;
  let data=value.slice(5);if(data.startsWith(' '))data=data.slice(1);
  dataLength+=data.length+1;
  if(dataLength>MAX_LINE_CHARS)throw Error('Un evento del flujo supera el límite de longitud.');
  dataLines.push(data);
 }

 function consume(text){
  pending+=text;
  let end;
  while(!doneMarker&&(end=pending.indexOf('\n'))!==-1){
   const value=pending.slice(0,end);pending=pending.slice(end+1);line(value);
  }
  if(!doneMarker&&pending.length>MAX_LINE_CHARS)throw Error('Una línea del flujo supera el límite de longitud.');
 }

 try{
  while(!doneMarker){
   const chunk=await nextChunk(iterator,signal);
   signal?.throwIfAborted();
   if(chunk.done){naturalEnd=true;consume(decoder.decode());break;}
   consume(decoder.decode(chunk.value,{stream:true}));
  }
  if(!doneMarker){if(pending.length)line(pending);dispatch();}
  signal?.throwIfAborted();
  if(!doneMarker&&!finishReason)throw Error('El flujo del motor terminó sin confirmar el final de la respuesta.');
  const content=visible.finish();signal?.throwIfAborted();
  return {choices:[{message:{content},finish_reason:finishReason??'stop'}],usage};
 }finally{
  if(!naturalEnd&&typeof iterator.return==='function'){
   // An abort must not wait for an unresponsive async generator to finish.
   const closing=Promise.resolve().then(()=>iterator.return());
   if(signal?.aborted)closing.catch(()=>{});else await closing;
  }
 }
}
