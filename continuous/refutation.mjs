import {randomUUID} from 'node:crypto';
export function makeClaim(input, now=new Date().toISOString()) {
 if(!input || typeof input.claim!=='string' || !input.claim.trim() || input.claim.length>4000) throw Error('Escribe una hipótesis de hasta 4000 caracteres.');
 const evidence=input.evidence??[];
 if(!Array.isArray(evidence)||evidence.length>20) throw Error('Máximo 20 evidencias.');
 const checked=evidence.map(e=>{
  if(!e || !['support','against'].includes(e.direction) || typeof e.text!=='string' || !e.text.trim() || e.text.length>4000) throw Error('Evidencia inválida.');
  let source='';
  if(e.source){const u=new URL(e.source);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('Fuente inválida.');source=u.href;}
  return {direction:e.direction,text:e.text.trim(),source,verification:'unverified'};
 });
 const counterexample=typeof input.counterexample==='string'?input.counterexample.trim():'';
 if(counterexample.length>4000)throw Error('La prueba propuesta es demasiado larga.');
 return {id:randomUUID(),at:now,claim:input.claim.trim(),evidence:checked,counterexample,
  status:checked.some(e=>e.direction==='support')&&checked.some(e=>e.direction==='against')?'disputed':'pending',
  eligibleForTraining:false,conclusion:'Pendiente de verificación independiente; registrar no demuestra ni refuta la hipótesis.'};
}
