/**
 * Fail-closed local llama.cpp health probe. No remote endpoint accepted.
 * A healthy HTTP response does not prove that inference works.
 */
const LOCAL=/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):[0-9]{2,5}$/;
export async function checkAtlasLocalLlamaHealth({
 endpoint='http://127.0.0.1:8080',fetchImpl=globalThis.fetch,
 timeoutMs=3000
}={}){
 if(!LOCAL.test(endpoint)||typeof fetchImpl!=='function'||
  !Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>10000)
  throw Error('Invalid localhost health probe');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetchImpl(endpoint+'/health',{
   method:'GET',signal:controller.signal,redirect:'error'
  });
  if(!response?.ok)return Object.freeze({ready:false,status:'http_error',
   httpStatus:response?.status??null,inferenceVerified:false});
  const body=await response.text();
  if(body.length>10000)return Object.freeze({ready:false,status:'oversized_response',
   inferenceVerified:false});
  let data;
  try{data=JSON.parse(body);}catch{return Object.freeze({ready:false,
   status:'invalid_json',inferenceVerified:false});}
  const ready=data?.status==='ok';
  return Object.freeze({ready,status:ready?'ready':'not_ready',
   inferenceVerified:false,modelVerified:false});
 }catch(error){
  return Object.freeze({ready:false,status:error?.name==='AbortError'?'timeout':'unreachable',
   inferenceVerified:false});
 }finally{clearTimeout(timer);}
}
