import {getChatGPTUser} from '@/app/chatgpt-auth';
import {privateHeaders,allowedOrigin,readState} from '@/lib/server-state';
import {readLab,saveLab,getKnowledge} from '@/lib/atlas-lab';
import {calculate,deduce,retrieve,memoryKnowledge,capabilityTests,makeReply,normalize} from '@/lib/atlas-core';
import type {Mission} from '@/lib/lab-types';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sesión requerida.'},{status:401,headers:privateHeaders});if(!allowedOrigin(request))return Response.json({error:'Origen no autorizado.'},{status:403,headers:privateHeaders});
 try{
  const raw=await request.text();if(raw.length>30000)return Response.json({error:'Objetivo demasiado largo.'},{status:413,headers:privateHeaders});const {goal}=JSON.parse(raw);if(typeof goal!=='string'||!goal.trim()||goal.length>8000)return Response.json({error:'Escribe un objetivo de hasta 8.000 caracteres.'},{status:400,headers:privateHeaders});
  const [{state},{lab,revision}]=await Promise.all([readState(user.userId),readLab(user.userId)]);
  const mission:Mission={id:crypto.randomUUID(),goal,date:new Date().toISOString(),steps:[],summary:'',gaps:[],status:'Parcial'};
  const log=(tool:string,result:string,status:'ok'|'limitado'='ok')=>mission.steps.push({tool,result:result.slice(0,10000),date:new Date().toISOString(),status});
  let calculation=null,logic=null;
  try{calculation=calculate(goal);logic=calculation?null:deduce(goal);}catch(e){log('Analizador',e instanceof Error?e.message:'Entrada no válida','limitado');}
  log('Planificador',calculation?'Resolver la expresión y comprobar el resultado.':logic?'Derivar consecuencias y buscar contradicciones.':'Recuperar fuentes locales, inspeccionar límites y comprobar las herramientas.');
  if(calculation){log('Calculadora',`${calculation.expression} = ${calculation.value}`);mission.summary=makeReply(goal,state,[]).answer;mission.status='Resuelta';}
  else if(logic){log('Lógica de reglas',JSON.stringify(logic));mission.summary=makeReply(goal,state,[]).answer;mission.status=logic.result==='desconocido'||logic.contradictions.length?'Parcial':'Resuelta';if(logic.contradictions.length)mission.gaps.push('Las premisas son contradictorias.');}
  else{
   const hits=retrieve(goal,[...memoryKnowledge(state),...getKnowledge(lab)],4);
   log('Memoria y corpus',hits.length?hits.map((h,i)=>`[${i+1}] ${h.title}\n${h.text.slice(0,1000)}`).join('\n\n'):'Sin documentos pertinentes.',hits.length?'ok':'limitado');
   const checks=capabilityTests();log('Evaluador protegido',checks.map(c=>(c.passed?'OK':'FALLO')+' · '+c.name).join('\n'),checks.every(c=>c.passed)?'ok':'limitado');
   const isAudit=/audita|evalua|capacidades|diagnostico|mejora/.test(normalize(goal));
   mission.summary=isAudit?`He ejecutado ${checks.length} pruebas internas: ${checks.filter(c=>c.passed).length} superadas. Corpus propio: ${lab.documents.length} documentos. Modelo: ${lab.checkpoint.parameters} parámetros y ${lab.checkpoint.steps} pasos conservados.\n\nSiguiente carencia concreta: evaluar preguntas nuevas fuera del corpus y fuera de estas pruebas. Más pasos de entrenamiento no demuestran una mejora general.`:makeReply(goal,state,getKnowledge(lab)).answer;
   mission.gaps.push('La misión no consulta internet ni abre servicios externos.','El evaluador interno no mide competencia general frente a otros modelos.');
   if(!hits.length)mission.gaps.push('Falta una fuente relevante para este objetivo.');
  }
  log('Memoria de ejecución','Se conservan las herramientas usadas, sus salidas y los límites. No se modifica el código del evaluador.');
  const next={...lab,missions:[mission,...lab.missions].slice(0,30)};const nextRevision=await saveLab(user.userId,next,revision);
  return Response.json({mission,lab:next,revision:nextRevision},{headers:privateHeaders});
 }catch(e){return Response.json({error:e instanceof Error&&e.message==='CONFLICT'?'Otro cambio avanzó el núcleo. Recarga antes de repetir la misión.':'La misión no se completó ni se registró como resuelta.'},{status:503,headers:privateHeaders});}
}
