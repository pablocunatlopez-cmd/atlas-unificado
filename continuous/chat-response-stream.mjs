// The provisional stream is never a saved assistant message. Only result is final.
export async function readChatResponse(response,{onEvent=()=>{},signal}={}){
 signal?.throwIfAborted();
 if(!response.headers.get('content-type')?.includes('application/x-ndjson')){
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Atlas no pudo responder.');
  if(typeof result.answer!=='string')throw Error('La respuesta de Atlas no contiene texto.');
  return result;
 }
 if(!response.ok)throw Error('Atlas no pudo responder (HTTP '+response.status+').');
 if(!response.body)throw Error('La respuesta no contiene un flujo de texto.');
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let buffer='',total=0;
 const abort=()=>{void reader.cancel().catch(()=>{});};
 signal?.addEventListener('abort',abort,{once:true});
 function processLine(line){
  if(!line.trim())return null;
  let event;try{event=JSON.parse(line);}catch{throw Error('El flujo de Atlas contiene un mensaje inválido.');}
  if(event.type==='error')throw Error(typeof event.error==='string'?event.error:'Atlas no pudo completar la respuesta.');
  if(event.type==='result'){
   if(typeof event.result?.answer!=='string')throw Error('El resultado final no contiene una respuesta.');
   return event.result;
  }
  if(event.type==='stage'||event.type==='delta'){
   if(event.type==='delta'&&typeof event.text!=='string')throw Error('Fragmento de texto inválido.');
   onEvent(event);
  }
  return null;
 }
 try{
  while(true){
   signal?.throwIfAborted();const {done,value}=await reader.read();signal?.throwIfAborted();
   buffer+=done?decoder.decode():decoder.decode(value,{stream:true});total+=value?.byteLength||0;
   if(total>2*1024*1024||buffer.length>1024*1024)throw Error('La respuesta supera el límite de lectura.');
   let newline;
   while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);const result=processLine(line);if(result)return result;}
   if(done){if(buffer.trim()){const result=processLine(buffer);if(result)return result;}throw Error('La conexión terminó sin una respuesta final. Puedes volver a intentarlo.');}
  }
 }finally{signal?.removeEventListener('abort',abort);try{await reader.cancel();}catch{}reader.releaseLock();}
}
