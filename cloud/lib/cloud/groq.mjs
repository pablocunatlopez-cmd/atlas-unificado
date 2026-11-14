// Server-only transport. No alternate provider or automatic paid fallback.
export const CLOUD_MODEL='qwen/qwen3.8-27b';
export const ALLOWED_MODELS=[CLOUD_MODEL,'openai/gpt-oss-120b','openai/gpt-oss-20b'];
export class InferenceError extends Error {
 constructor(code,message){super(message);this.code=code;}
}
export async function reserveInference(db,at=Date.now(),purpose='chat'){
 await db.prepare('CREATE TABLE IF NOT EXISTS cloud_inference_budget (day TEXT PRIMARY KEY, requests INTEGER NOT NULL DEFAULT 0, blocked_until INTEGER NOT NULL DEFAULT 0)').run();
 const day=new Date(at).toISOString().slice(0,10),limit=purpose==='chat'?60:48;
 const result=await db.prepare('INSERT INTO cloud_inference_budget(day,requests,blocked_until) VALUES(?,1,0) ON CONFLICT(day) DO UPDATE SET requests=requests+1 WHERE requests<? AND blocked_until<=? RETURNING requests').bind(day,limit,at).first();
 if(!result)throw new InferenceError('quota','Atlas espera a que se renueve la cuota de inferencia. No se activa ningún servicio de pago.');
}
export async function pauseInference(db,seconds,at=Date.now()){
 const day=new Date(at).toISOString().slice(0,10);
 await db.prepare('UPDATE cloud_inference_budget SET blocked_until=MAX(blocked_until,?) WHERE day=?').bind(at+Math.max(60,Math.min(86400,seconds))*1000,day).run();
}
export async function generateCloud({apiKey,messages,json=false,maxTokens=1500,temperature=0.4,model=CLOUD_MODEL,timeoutMs=22000,fetcher=fetch,reserve=async()=>{},pause=async(_seconds=60)=>{}}){
 if(!apiKey)throw new InferenceError('configuration','La inferencia en la nube no está configurada.');
 if(!ALLOWED_MODELS.includes(model))throw new InferenceError('model','El modelo no pertenece al catálogo autorizado.');
 if(!Array.isArray(messages)||messages.some(m=>!['system','user','assistant'].includes(m.role)||typeof m.content!=='string')||messages.reduce((n,m)=>n+m.content.length,0)>16000)throw new InferenceError('input','El contexto supera el límite de esta vuelta.');
 await reserve();
 let response;
 try{response=await fetcher('https://api.groq.com/openai/v1/chat/completions',{
  method:'POST',redirect:'manual',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','User-Agent':'Atlas/1.0'},
  body:JSON.stringify({model,messages,temperature,max_completion_tokens:Math.min(1800,maxTokens),...(model===CLOUD_MODEL?{reasoning_effort:'none',reasoning_format:'hidden'}:{reasoning_effort:'low',include_reasoning:false}),...(json?{response_format:{type:'json_object'}}:{})}),signal:AbortSignal.timeout(Math.max(1000,Math.min(22000,timeoutMs)))
 });}catch(error){
  const detail=String(error?.message||'').replaceAll(apiKey,'[redacted]').replace(/(?:Bearer\s+|gsk_)[A-Za-z0-9_-]+/g,'[redacted]').slice(0,350);
  console.error('Atlas inference transport',String(error?.name||'Error'),detail);
  throw new InferenceError('network','No se pudo conectar con la inferencia en la nube.');
 }
 if(!response.ok){
  if(response.status===429){const delay=Number(response.headers.get('retry-after'));await pause(Number.isFinite(delay)&&delay>0?delay:3600);throw new InferenceError('quota','Groq ha agotado una cuota. Atlas espera antes de volver a intentarlo; no cambia de plan.');}
  throw new InferenceError(response.status===401||response.status===403?'credentials':'provider','El proveedor de inferencia no pudo completar esta vuelta.');
 }
 const payload=await response.json().catch(()=>null),choice=payload?.choices?.[0],answer=choice?.message?.content;
 if(choice?.finish_reason==='length'||typeof answer!=='string'||!answer.trim()||answer.length>16000)throw new InferenceError('output','La respuesta no se completó dentro del límite.');
 if(json){try{return JSON.parse(answer);}catch{throw new InferenceError('output','La respuesta estructurada no es válida.');}}
 return answer;
}
