import {requireFreeStar} from './constellation.mjs';
export async function freeAgent(messages,key,request=fetch,selected='openrouter/free'){
 if(!key)throw Error('Falta conectar OpenRouter en Conexiones.');
 const model=await requireFreeStar(selected,request);
 const r=await request('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},signal:AbortSignal.timeout(90000),body:JSON.stringify({model,messages,max_tokens:1500,temperature:0.3})});
 if(!r.ok)throw Error(r.status===429?'Cuota gratuita agotada; no se usará un modelo de pago.':'OpenRouter no pudo responder (HTTP '+r.status+'). Revisa la clave y los permisos de tu cuenta.');
 const j=await r.json();if(!j.choices?.[0]?.message?.content)throw Error('El colaborador no devolvió texto.');
 return {text:j.choices[0].message.content.slice(0,14000),model:j.model||'openrouter/free',cost:j.usage?.cost??null};
}
