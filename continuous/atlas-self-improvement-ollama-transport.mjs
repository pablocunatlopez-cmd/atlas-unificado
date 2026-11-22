/**
 * Host-only loopback Ollama transport. The model gets no tools, filesystem
 * access, shell commands, or repository write capability through this adapter.
 * Actual model process security remains the responsibility of the host.
 */
export function createAtlasOllamaLoopbackTransport({
 fetchImpl,endpoint='http://127.0.0.1:11434/api/chat',
 timeoutMs=30000,maxResponseBytes=65536
}={}){
 if(typeof fetchImpl!=='function'||
    !Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>120000||
    !Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1024||
    maxResponseBytes>262144)
  throw Error('Bounded trusted HTTP transport required');
 let url;
 try{url=new URL(endpoint);}catch{throw Error('Invalid Ollama endpoint');}
 if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||
    url.username||url.password||url.search||url.hash||url.pathname!=='/api/chat')
  throw Error('Only local Ollama /api/chat endpoint is allowed');
 return async function requestModel(request){
  if(!request||request.stream!==false||request.format!=='json'||
     !Array.isArray(request.messages)||request.messages.length!==2||
     request.messages[0]?.role!=='system'||request.messages[1]?.role!=='user'||
     'tools' in request||'tool_choice' in request)
   throw Error('Unsafe model request');
  const payload=JSON.stringify(request);
  if(payload.length>80000)throw Error('Oversized model request');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetchImpl(url.href,{method:'POST',headers:{'content-type':'application/json'},
    body:payload,signal:controller.signal,redirect:'error'});
   if(!response||response.ok!==true)throw Error('Ollama request failed');
   if(response.headers?.get('content-length')&&
      Number(response.headers.get('content-length'))>maxResponseBytes)
    throw Error('Ollama response exceeds limit');
   if(!response.body?.getReader)throw Error('Streaming response reader required');
   const reader=response.body.getReader();
   const chunks=[];let bytes=0;
   try{
    while(true){
     const {done,value}=await reader.read();
     if(done)break;
     bytes+=value.byteLength;
     if(bytes>maxResponseBytes)throw Error('Ollama response exceeds limit');
     chunks.push(value);
    }
   }finally{await reader.cancel().catch(()=>{});}
   return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks.map(x=>Buffer.from(x)))));
  }finally{clearTimeout(timer);}
 };
}
