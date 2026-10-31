import {buildExtension} from './extensions.mjs';
import {checkToolContract,retainContract} from './tool-contract.mjs';
import {assessCapabilities} from './audit-assessment.mjs';
import {chat} from './chat.mjs';
import {selectAutonomousTask} from './autonomy-curriculum.mjs';
export async function reviewCapabilities(extensions,key,{signal,assess=assessCapabilities,allowCreation=false,history=[],generate,codeGeneration=false}={}){
 signal?.throwIfAborted();
 const checks=[];
 for(const item of extensions.filter(x=>x.passed).slice(-8)){
  signal?.throwIfAborted();
  try{const result=await checkToolContract(item);checks.push({id:item.id,passed:result.passed,modelCases:result.modelResults.length,contractCases:result.contractResults.length});}
  catch(e){checks.push({id:item.id,passed:false,error:e.message});}
 }
 const failed=checks.find(x=>!x.passed);
 const target=failed?extensions.find(x=>x.id===failed.id):extensions.find(x=>!x.passed&&!x.curriculumTaskId&&x.acceptanceTests?.length);
 const generator=generate||((input,documents,request,localKey)=>chat(input,documents,request,localKey,'',null,'',[],'',{signal}));
 const localGenerate=async(...args)=>{signal?.throwIfAborted();const value=await generator(...args);signal?.throwIfAborted();return value;};
 let candidate=null,curriculum=null;
 if(target?.acceptanceTests?.length){
  candidate=await buildExtension(target.task,key,target.acceptanceTests,localGenerate,codeGeneration&&target.testOrigin==='external-contract'?{format:'code',name:target.name}:{});
  candidate.parentId=target.id;
  candidate.origin='autonomous-local-review';
  await retainContract(candidate,target);
 }else if(allowCreation){
  const task=selectAutonomousTask(extensions,history);
  if(task){
   curriculum={taskId:task.id,name:task.name,learningPlan:task.learningPlan};
   candidate=await buildExtension(task.task,key,task.acceptanceTests,localGenerate,codeGeneration?{format:'code',name:task.name}:{});
   candidate.curriculumTaskId=task.id;candidate.origin='autonomous-local-programming';
  }
 }
 let assessment;
 signal?.throwIfAborted();
 try{
  assessment=await assess({checks,curriculum,candidate:candidate?{passed:candidate.passed,scope:candidate.scope}:null,capabilities:{quickjs:'Ejecutor disponible; checks contiene las pruebas ejecutadas en esta auditoría.',internet:'Lector público implementado; conectividad no comprobada en esta auditoría.',localModel:'Invocado para este diagnóstico; no constituye evaluación general.',externalProviders:'Opcionales; no necesarios para la auditoría local.',autonomousProgramming:allowCreation?'Creación y reparación de funciones puras con contratos ejecutados.':'Reparación de funciones existentes.',coreEditing:false,qwenWeightTraining:false},scope:'Programación y reparación autónoma de herramientas con casos de aceptación; no edición del servidor ni entrenamiento Qwen.'},key,fetch,signal);
 }catch(e){signal?.throwIfAborted();assessment={diagnosis:'Comprobaciones ejecutadas; evaluación del modelo no disponible.',error:e.message,nextAction:'Reintentar la evaluación sin descartar las comprobaciones.',intervalMinutes:30};}
 signal?.throwIfAborted();
 const minutes=Number(assessment.intervalMinutes);
 return {at:new Date().toISOString(),checks,candidate,curriculum,assessment,assessmentStatus:'Opinión del modelo no verificada; solo checks y resultados ejecutados constituyen evidencia. Las opciones del turno no representan capacidades globales.',intervalMinutes:Number.isFinite(minutes)?Math.max(5,Math.min(allowCreation?15:120,minutes)):15,scope:'Programación, auditoría y reparación de herramientas; pesos Qwen sin cambios.'};
}
