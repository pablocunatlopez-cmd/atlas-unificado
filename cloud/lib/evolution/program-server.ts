import {agentPlan} from '../cloud/agents';
import {env} from 'cloudflare:workers';
import {inferModel,CLOUD_MODEL} from '../cloud/inference';
import {agentEvaluations} from '../cloud/agent-registry';
import {livingReviewer} from './living-policy';
import {WORLD_ENTITIES} from './world';
import {sha256} from '../research/web';
import {PROGRAM_TASKS,PROGRAM_SCOPE,PROGRAM_LAB_VERSION,validateProgram,executeProgram,programCases,gradeProgram,programDecision} from './program-runtime.mjs';
export type ProgramArtifact={id:string;taskId:string;program:any;at:string;actorId:string;creator:string;reviewer:string;review:string;parentId?:string;tests:ReturnType<typeof gradeProgram>};
export type ProgramTrial={id:string;taskId:string;actorId:string;actorName:string;room:string;at:string;status:'completed'|'waiting';decision:'installed'|'promoted'|'retained'|'rejected'|'waiting';creator:string;reviewer?:string;reviewStatus?:string;reason:string;scope:string;seed:number;before:ReturnType<typeof gradeProgram>|null;after?:ReturnType<typeof gradeProgram>;candidate?:any;artifactId?:string};
export type ProgramState={cursor:number;attempts:number;nextAttemptAt?:string;projects:Record<string,{active?:ProgramArtifact;history:ProgramArtifact[];lastTrial?:ProgramTrial}>;lastTrial?:ProgramTrial};
function database(){if(!env.DB)throw Error('DB');return env.DB;}
export const emptyPrograms=():ProgramState=>({cursor:0,attempts:0,projects:{}});
export function programDue(state?:ProgramState,at=Date.now()){return !state?.nextAttemptAt||Date.parse(state.nextAttemptAt)<=at;}
export async function programPayload(){
 const row=await database().prepare("SELECT content FROM research_control WHERE id='main'").first<{content:string}>();
 return{version:PROGRAM_LAB_VERSION,tasks:PROGRAM_TASKS,state:row?JSON.parse(row.content).programming||emptyPrograms():emptyPrograms(),scope:PROGRAM_SCOPE};
}
export async function runInstalledProgram(taskId:string,input:unknown){
 const payload=await programPayload(),artifact=payload.state.projects[taskId]?.active;
 if(!artifact)throw Error('Todavía no hay un programa aceptado para este proyecto.');
 return{...executeProgram(artifact.program,input),artifactId:artifact.id,taskId,source:artifact.program,origin:'model-program',scope:PROGRAM_SCOPE};
}
export async function restoreProgram(taskId:string){
 const row=await database().prepare("SELECT revision,content,lease_until FROM research_control WHERE id='main'").first<{revision:number;content:string;lease_until:number}>();
 if(!row||row.lease_until>Date.now())throw Error('Hay una vuelta en curso.');
 const control=JSON.parse(row.content),project=control.programming?.projects?.[taskId];
 if(!project?.history?.length)throw Error('No hay una versión anterior.');
 const restored=project.history.pop();project.restoredAt=new Date().toISOString();project.active=restored;
 const saved=await database().prepare("UPDATE research_control SET content=?,revision=revision+1,updated_at=? WHERE id='main' AND revision=? AND lease_until<? RETURNING revision").bind(JSON.stringify(control),new Date().toISOString(),row.revision,Date.now()).first();
 if(!saved)throw Error('El estado cambió; no se restauró.');return programPayload();
}
export async function evolveProgram(previous:ProgramState|undefined,at=Date.now(),actorId?:string){
 const state:ProgramState=structuredClone(previous||emptyPrograms()),actors=WORLD_ENTITIES.filter(e=>e.kind==='resident'&&e.module==='programming'&&!e.visualOnly);
 const actor=(actorId?WORLD_ENTITIES.find(a=>a.id===actorId&&a.module==='programming'&&!a.visualOnly):actors[state.cursor%actors.length]);if(!actor)throw Error('PROGRAM_ACTOR');const task=PROGRAM_TASKS[state.cursor%PROGRAM_TASKS.length],project=state.projects[task.id]||{history:[]};
 const date=new Date(at).toISOString(),cases=programCases(task.id,Math.floor(at/86400000)+state.attempts);
 const before=project.active?gradeProgram(project.active.program,cases):null;
 const trial:ProgramTrial={id:crypto.randomUUID(),taskId:task.id,actorId:actor.id,actorName:actor.name,room:actor.room,at:date,status:'waiting',decision:'waiting',creator:CLOUD_MODEL,reason:'Propuesta pendiente.',scope:PROGRAM_SCOPE,seed:Math.floor(at/86400000)+state.attempts,before};
 let proposed=false;
 try{
  const evaluations=(await agentEvaluations()).filter(e=>Date.parse(e.at)>at-7*86400000);
  const creator=agentPlan('Implementa código comprobable',evaluations).primary;trial.creator=creator;
  if(!evaluations.some(e=>e.model===creator&&e.status==='qualified'&&e.score?.cases.filter(c=>c.domain==='programming'&&c.passed).length===2))throw Error('El autor necesita una calificación vigente de programación.');
  const reviewer=livingReviewer(creator,evaluations);if(!reviewer)throw Error('No hay segundo modelo calificado para programación.');
  const prompt='Escribe un programa en el lenguaje JSON de expresiones de Atlas. SOLO devuelve {program:AST,rationale:string}. Cada nodo es {op,args?}; number lleva value finito. Operaciones sin args: input (lista), item (número actual solo dentro de map/filter), number. Binarias: add,sub,mul,div,gt,lt,eq. Unarias: sum,length. if tiene 3 args: condición,verdadero,falso; evalúa solo la rama elegida. map y filter tienen 2 args: lista,expresión por item. sum recibe lista numérica. Ejemplo genérico: {op:"length",args:[{op:"input"}]}. Máximo 96 nodos, profundidad 12. No existen otras operaciones, JavaScript, variables globales, archivos o red. Debes resolver la especificación para todas las listas de hasta 128 números, no memorizar ejemplos. Ante un error previo, repara el algoritmo.';
  const generated=await inferModel(trial.creator,[{role:'system',content:prompt},{role:'user',content:JSON.stringify({actor:{name:actor.name,role:actor.role,personality:actor.personality},task,baseline:project.active?.program||null,development:cases.filter(c=>c.split==='development'),availablePrograms:Object.values(state.projects).flatMap(p=>p.active&&p.active.taskId!==task.id&&JSON.stringify(p.active.program).length<1200?[{id:p.active.id,taskId:p.active.taskId,program:p.active.program}]:[]).slice(0,2),previousFeedback:project.lastTrial?{decision:project.lastTrial.decision,reason:project.lastTrial.reason,developmentFailures:project.lastTrial.after?.checks.filter((c:{split:string;passed:boolean})=>c.split==='development'&&!c.passed)}:null})}],{json:true,maxTokens:1800,purpose:'research'});
  proposed=true;const candidate=validateProgram(generated?.program);trial.candidate=candidate;trial.after=gradeProgram(candidate,cases);trial.status='completed';trial.decision=programDecision(before,trial.after) as ProgramTrial['decision'];
  if(trial.decision==='rejected')trial.reason='El programa falló contratos de desarrollo o casos reservados; la versión activa se conserva.';
  else if(trial.decision==='retained')trial.reason='No mejora los resultados del programa activo en estos mismos casos. Se conserva la versión.';
  else{
   const review=await inferModel(reviewer,[{role:'system',content:'Revisa un programa JSON acotado. Los contratos se han ejecutado realmente, incluidos casos reservados. Busca contradicciones concretas entre especificación y programa. Devuelve {decision:"accept"|"reject",reason:string(max500)}. No afirmes perfección ni ejecución visual.'},{role:'user',content:JSON.stringify({task,program:candidate,development:cases.filter(c=>c.split==='development'),scores:{before:before?.passed??null,after:trial.after.passed,total:trial.after.total}})}],{json:true,maxTokens:800,purpose:'research'});
   trial.reviewer=reviewer;trial.reviewStatus='completed';
   if(review?.decision!=='accept'||typeof review.reason!=='string'||!review.reason.trim()){
trial.decision='rejected';trial.reason=typeof review?.reason==='string'?review.reason.slice(0,500):'Revisión no aceptada.';}
   else{
    const artifact:ProgramArtifact={id:'program-'+(await sha256(task.id+JSON.stringify(candidate))).slice(0,24),taskId:task.id,program:candidate,at:date,actorId:actor.id,creator:trial.creator,reviewer,review:review.reason.slice(0,500),tests:trial.after,...(project.active?{parentId:project.active.id}:{})};
    if(project.active)project.history=[...project.history,project.active].slice(-8);
    project.active=artifact;trial.artifactId=artifact.id;trial.reason=trial.decision==='installed'?'Primer programa instalado: antes no había implementación. No se inventa una puntuación previa.':'Reparación aprobada: mejora en los mismos casos, ningún acierto perdido y todos los contratos superados.';
   }
  }
 }catch(error){
  trial.reason=error instanceof Error?error.message:'Ejecución o inferencia indisponible.';
  if(trial.status==='completed'&&trial.decision!=='retained'){trial.status='waiting';trial.decision='waiting';trial.reviewStatus='unavailable';}
  else if(proposed&&trial.status!=='completed'){trial.status='completed';trial.decision='rejected';}
 }
 state.attempts++;if(trial.status==='completed')state.cursor++;
 state.nextAttemptAt=new Date(at+(trial.status==='waiting'?1:4)*3600000).toISOString();
 project.lastTrial=trial;state.projects[task.id]=project;state.lastTrial=trial;
 return{state,trial};
}
