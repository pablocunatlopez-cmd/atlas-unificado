let cached=null,pending=null;
export function freeStars(data){return (Array.isArray(data)?data:[]).filter(m=>typeof m.id==='string'&&m.id.endsWith(':free')&&m.pricing?.prompt==='0'&&m.pricing?.completion==='0'&&m.architecture?.output_modalities?.includes('text')).map(m=>({id:m.id,name:String(m.name||m.id).slice(0,120),context:m.context_length||0,tools:m.supported_parameters?.includes('tools')||false,description:String(m.description||'').slice(0,700)})).sort((a,b)=>a.name.localeCompare(b.name));}
export async function starCatalog(request=fetch){
 if(cached&&Date.now()-cached.time<600000)return cached;if(pending)return pending;
 pending=(async()=>{const r=await request('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Catálogo no disponible: HTTP '+r.status);const j=await r.json();if(!Array.isArray(j.data))throw Error('Catálogo inválido');cached={time:Date.now(),at:new Date().toISOString(),models:freeStars(j.data)};return cached;})();try{return await pending;}finally{pending=null;}
}
export async function requireFreeStar(id,request=fetch){if(id==='openrouter/free')return id;if(typeof id!=='string'||!id.endsWith(':free'))throw Error('Solo se permiten modelos gratuitos.');if(!(await starCatalog(request)).models.some(m=>m.id===id))throw Error('Modelo fuera del catálogo gratuito. No se usará una alternativa de pago.');return id;}
