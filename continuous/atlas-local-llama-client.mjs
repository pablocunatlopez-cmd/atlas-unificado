/**
 * Explicitly opt-in local llama.cpp HTTP integration.
 * No API credits or GPU are required by this adapter.
 * A trusted host must configure a local endpoint and installed model.
 */
const LOCAL=/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):[0-9]{2,5}$/;
export async function queryAtlasLocalLlama({endpoint='http://127.0.0.1:8080',messages,model='local',
 maxTokens=256,timeoutMs=30000,fetchImpl=globalThis.fetch}={}){
 if(!LOCAL.test(endpoint)||!Array.isArray(messages)||messages.length<1||messages.length>30||
  messages.some(m=>!m||!['system','user','assistant'].includes(m.role)||
   typeof m.content!=='string'||m.content.length>16000)||
  typeof model!=='string'||!/^[A-Za-z0-9_.\/-]{1,100}$/.test(model)||
  !Number.isSafeInteger(maxTokens)||maxTokens<1||maxTokens>2048||
  !Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000||
  typeof fetchImpl!=='function')throw Error('Invalid local llama request');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetchImpl(endpoint+'/v1/chat/completions',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({model,messages,max_tokens:maxTokens,stream:false}),
   signal:controller.signal,redirect:'error'
  });
  if(!response.ok)throw Error('Local inference HTTP '+response.status);
  const body=await response.text();
  if(body.length>1000000)throw Error('Local inference output too large');
  const data=JSON.parse(body);
  const answer=data?.choices?.[0]?.message?.content;
  if(typeof answer!=='string')throw Error('Invalid local inference response');
  return Object.freeze({answer,provider:'llama.cpp',local:true,verified:false,
   model,usage:data.usage??null});
 }finally{clearTimeout(timer);}
}
