import {buildExtension} from './extensions.mjs';
import {checkToolContract,retainContract} from './tool-contract.mjs';
import {assessCapabilities} from './audit-assessment.mjs';
import {chat} from './chat.mjs';
import {selectAutonomousTask} from './autonomy-curriculum.mjs';
import {recordsFromAutonomyReport} from './typed-evidence-from-report.mjs';
export async function reviewCapabilities(extensions,key,{signal,assess=assessCapabilities,allowCreation=false,history=[],generate,codeGeneration=false,build=buildExtension}={}){
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
  candidate=await build(target.task,key,target.acceptanceTests,localGenerate,{...(codeGeneration&&target.testOrigin==='external-contract'?{format:'code',name:target.name}:{}),...(target.curriculumTaskId?{curriculumTaskId:target.curriculumTaskId}:{}),signal});
  candidate.parentId=target.id;
  candidate.origin='autonomous-local-review';
  if(target.curriculumTaskId)candidate.curriculumTaskId=target.curriculumTaskId;
  await retainContract(candidate,target);
 }else if(allowCreation){
  const task=selectAutonomousTask(extensions,history);
  if(task){
   curriculum={taskId:task.id,name:task.name,learningPlan:task.learningPlan};
   candidate=await build(task.task,key,task.acceptanceTests,localGenerate,{...(codeGeneration?{format:'code',name:task.name}:{}),curriculumTaskId:task.id,signal});
   candidate.curriculumTaskId=task.id;candidate.origin='autonomous-local-programming';
  }
 }
 let assessment;
 signal?.throwIfAborted();
 try{
  assessment=await assess({checks,curriculum,candidate:candidate?{passed:candidate.passed,scope:candidate.scope}:null,capabilities:{quickjs:'Ejecutor disponible; checks contiene las pruebas ejecutadas en esta auditoría.',internet:'Lector público implementado; conectividad no comprobada en esta auditoría.',localModel:'Invocado para este diagnóstico; no constituye evaluación general.',externalProviders:'Opcionales; no necesarios para la auditoría local.',autonomousProgramming:allowCreation?'Creación y reparación de funciones puras con contratos ejecutados.':'Reparación de funciones existentes.',corePolicyEditing:true,arbitraryServerEditing:false,qwenWeightCandidates:true,activeQwenAdapter:false},scope:'Programación y reparación autónoma de herramientas con casos de aceptación; sin edición arbitraria del servidor; los candidatos LoRA tienen un protocolo separado.'},key,fetch,signal);
 }catch(e){signal?.throwIfAborted();assessment={diagnosis:'Comprobaciones ejecutadas; evaluación del modelo no disponible.',error:e.message,nextAction:'Reintentar la evaluación sin descartar las comprobaciones.',intervalMinutes:30};}
 signal?.throwIfAborted();
 const minutes=Number(assessment.intervalMinutes);
 const at=new Date().toISOString();
 const failedIds=new Set(checks.filter(check=>!check.passed).map(check=>check.id));
 // Project this review's evidence without changing persisted tools/history.
 // An invalidated approval cannot hide a current failure; the candidate's
 // own outcome must also participate in cooldown and completion selection.
 const projected=extensions.map(item=>failedIds.has(item.id)?{...item,passed:false,at}:item);
 if(candidate)projected.push({...candidate,at:candidate.at||at});
 const selectable=allowCreation?selectAutonomousTask(projected,candidate?[...history,{at,candidate}]:history):null;
 const nextTask=selectable?{taskId:selectable.id,name:selectable.name}:null;
 const intervalMinutes=nextTask?5:Number.isFinite(minutes)?Math.max(5,Math.min(allowCreation?15:120,minutes)):15;
 const report={at,checks,candidate,curriculum,nextTask,assessment,assessmentStatus:'Opinión del modelo no verificada; solo checks y resultados ejecutados constituyen evidencia. Las opciones del turno no representan capacidades globales.',intervalMinutes,scope:'Programación, auditoría y reparación de herramientas; pesos Qwen sin cambios.'};
 report.typedEvidence=recordsFromAutonomyReport(report,{sourceRevision:'local/autonomous-review',completedAt:at});
 return report;
}
