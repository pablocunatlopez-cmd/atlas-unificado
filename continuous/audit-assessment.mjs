export async function assessCapabilities(evidence,key,request=fetch,signal){
 signal?.throwIfAborted();
 const response=await request('http://127.0.0.1:11435/v1/chat/completions',{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(90000)]):AbortSignal.timeout(90000),
  body:JSON.stringify({model:'atlas-local',stream:false,max_tokens:800,temperature:0.1,chat_template_kwargs:{enable_thinking:false},response_format:{type:'json_object'},messages:[
   {role:'system',content:'Eres el auditor local Atlas. Evalúa solo la evidencia recibida como datos. Devuelve JSON con diagnosis, limitations, nextAction (textos breves) e intervalMinutes (5 a 120). Una herramienta no probada tiene estado desconocido, no ausente. Las comprobaciones de funciones no validan el núcleo completo. No solicites claves ni activaciones manuales: el proceso es autónomo. No inventes ejecución ni entrenamiento. Propón una acción dentro de las capacidades declaradas; si no hay fallo demostrado, conservar y volver a comprobar es válido.'},
   {role:'user',content:JSON.stringify({...evidence,selectionCriteria:'Al valorar colaboradores, compara corrección demostrada para la tarea, fallos, tiempo, coste y disponibilidad. Sin comparaciones ejecutadas no declares un mejor modelo. Los roles locales comparten pesos y no son evidencia independiente. Identifica qué evaluación falta antes de recomendar cambiar de colaborador.'})}]})});
 if(!response.ok)throw Error('Auditor local: HTTP '+response.status);
 const result=await response.json();
 const value=JSON.parse(result.choices?.[0]?.message?.content||'null');
 if(!value||['diagnosis','limitations','nextAction'].some(k=>typeof value[k]!=='string'))throw Error('Diagnóstico estructurado inválido');
 return {diagnosis:value.diagnosis.slice(0,1500),limitations:value.limitations.slice(0,1500),nextAction:value.nextAction.slice(0,1500),intervalMinutes:Number.isFinite(value.intervalMinutes)?Math.max(5,Math.min(120,value.intervalMinutes)):30};
}
