import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {getAutonomousTask} from './autonomy-curriculum.mjs';
import {LOR_FIELDS,LOR_SOURCE,validateLorRecord,situatedFrame} from './lor-omega.mjs';

const IDS=['lor-omega-schema','json-pointer-resolve','dag-dependency-plan','merge-intervals','stable-dedupe','numeric-statistics'];
const KINDS=new Set(['curriculum-repair','tool-experiment','open-inquiry','creative-experiment']);
const FOCI=new Set(['programming','language','3d','games','video','music','conversation','research','reasoning','suceso','unknown']);
const EPISTEMIC=new Set(['within-model','unexpected','unexplained','unassessed']);
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value)?value.toLowerCase():null;
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const count=(value,max=1000000000)=>Number.isSafeInteger(value)&&value>=0?Math.min(value,max):0;
const taskId=value=>typeof value==='string'&&IDS.includes(value)?value:null;
const goalFocus=value=>FOCI.has(value?.focus)?value.focus:value?.taskId==='lor-omega-schema'?'language':'programming';
const cleanFailure=value=>object(value)&&taskId(value.taskId)?{taskId:value.taskId,summary:text(value.summary,400),caseHash:hash(value.caseHash)}:null;

function observations(value){
 const raw=object(value)?value:{};
 return {facts:Array.isArray(raw.facts)?raw.facts.slice(0,12).map(value=>text(value,300)).filter(Boolean):[],gaps:Array.isArray(raw.gaps)?raw.gaps.slice(0,12).filter(value=>object(value)&&taskId(value.taskId)).map(value=>({taskId:value.taskId,reason:text(value.reason,300)})):[],failures:Array.isArray(raw.failures)?raw.failures.slice(0,12).map(cleanFailure).filter(Boolean):[],unknowns:Array.isArray(raw.unknowns)?raw.unknowns.slice(0,4).map(value=>text(value,250)).filter(Boolean):[],caseHash:hash(raw.caseHash)};
}

function goalValue(value){
 if(!object(value)||!KINDS.has(value.kind)||(['open-inquiry','creative-experiment'].includes(value.kind)?value.taskId!==null:!taskId(value.taskId))||(value.focus!==undefined&&!FOCI.has(value.focus))||(value.kind==='creative-experiment'&&!['3d','games'].includes(value.focus))||typeof value.question!=='string'||typeof value.rationale!=='string'||value.question.length>600||value.rationale.length>1000||(value.prediction!==undefined&&(typeof value.prediction!=='string'||value.prediction.length>600)))return null;
 const question=value.question.trim(),rationale=value.rationale.trim();
 return question.length>=8&&rationale.length>=8?{question,rationale,prediction:text(value.prediction,600)||'Se comprobará si existe evidencia observable para la pregunta; no se presupone un resultado positivo.',kind:value.kind,taskId:value.taskId,focus:goalFocus(value)}:null;
}

function physicalResult(value){
 const raw=object(value)?value:{},cases=count(raw.cases,128);
 return {executed:raw.executed===true,cases,passed:Math.min(cases,count(raw.passed,128)),acceptedChange:raw.acceptedChange===true,invariantsPreserved:raw.invariantsPreserved===true,evidenceHash:hash(raw.evidenceHash),caseHash:hash(raw.caseHash),summary:text(raw.summary,800)};
}

function reflectionValue(value){
 const raw=object(value)?value:{};
 return {consulted:raw.consulted===true,independentModels:count(raw.independentModels,16),collaborators:Array.isArray(raw.collaborators)?raw.collaborators.slice(0,8).filter(value=>object(value)&&typeof value.id==='string'&&/^[a-zA-Z0-9._/-]{1,80}$/.test(value.id)).map(value=>({id:value.id,free:value.free===true,available:value.available===true})):[],summary:text(raw.summary,800),epistemicStatus:EPISTEMIC.has(raw.epistemicStatus)?raw.epistemicStatus:'unassessed',unknowns:Array.isArray(raw.unknowns)?raw.unknowns.slice(0,4).map(value=>text(value,250)).filter(Boolean):[],possibilityBeyondModel:true,noveltyScope:raw.noveltyScope==='new-to-atlas'?'new-to-atlas':'unresolved',suggestedNextQuestion:text(raw.suggestedNextQuestion,600)||null};
}

function logicValue(value){
 const raw=object(value)?value:{};
 return {acceptedChange:raw.acceptedChange===true,invariantsPreserved:raw.invariantsPreserved===true,summary:text(raw.summary,800),rule:text(raw.rule,600)};
}

function recentExperience(record){
 return {id:record.id,ordinal:record.ordinal,at:record.at,goal:{taskId:record.goal?.taskId||null,kind:record.goal?.kind,focus:goalFocus(record.goal),question:text(record.goal?.question,300),prediction:text(record.goal?.prediction,300),objectiveRevision:record.goal?.objectiveRevision||0},result:{...physicalResult(record.result),summary:text(record.result?.summary,300)},reflection:{epistemicStatus:record.reflection?.epistemicStatus||'unassessed',unknowns:record.reflection?.unknowns||[],noveltyScope:record.reflection?.noveltyScope||'unresolved',summary:text(record.reflection?.summary,200),suggestedNextQuestion:text(record.reflection?.suggestedNextQuestion,300)||null},logic:{summary:text(record.logic?.summary,200),rule:text(record.logic?.rule,300)},L:record.L||null,reason:record.reason};
}

function languageRecord(experience){
 const {goal,result,reflection,logic,L}=experience;
 const subject={kind:goal.kind,focus:goalFocus(goal),question:text(goal.question,600),...(goal.taskId?{taskId:goal.taskId}:{})};
 const subjectLabel=subject.kind+' ('+subject.focus+'): '+subject.question;
 return validateLorRecord({encoding:'atlas-lor-record/v1',language:'LOR-ΩΣ',source:LOR_SOURCE,at:experience.at,
  K:situatedFrame({object:subjectLabel,environment:'Coordinador local y observaciones disponibles',perspective:'Evidencia situada y apertura a lo no explicado por el modelo',scale:'Una experiencia observada; sin cambios de pesos Qwen'}),
  S:{O:[subject],A:'Herramientas disponibles, fuentes públicas y límites del ejecutor local',X:{executed:result.executed,cases:result.cases,passed:result.passed,epistemicStatus:reflection.epistemicStatus,unknowns:reflection.unknowns},R:['El objetivo se formula desde observaciones previas','La ejecución física precede al acontecimiento, al contraste y a la formalización','Un acontecimiento puede permanecer fuera de lo que el modelo explica'],T:['Observar','Ejecutar','Acoger el acontecimiento y contrastar','Formalizar sin borrar lo desconocido','Conservar'],I:['Permisos del ejecutor intactos','Pesos y adaptadores de Qwen no promovidos','La crítica verbal no sustituye los casos ejecutados','No afirmar novedad universal ni convertir desconocimiento en verdad'],C:['Acciones acotadas por el ejecutor; preguntas abiertas sin whitelist temática','Solo se acredita cambio con evidencia nueva e invariantes preservadas'],E:'Una experiencia de software; no escala física ni prueba de una teoría',M:[{name:'casos ejecutados',unit:'casos',value:result.cases},{name:'casos aprobados',unit:'casos',value:result.passed}],P:[{statement:goal.prediction,question:goal.question,declaredBeforeEvaluation:true}],F:[{condition:'No existe contraste con contratos o alguno falla.',observed:!result.executed||!result.cases||result.passed!==result.cases},{condition:'No se ha registrado una observación ejecutada con huella inédita; su registro no decide su verdad.',observed:!L.newEvidence},{condition:'El resultado queda sin explicación dentro del modelo actual.',observed:['unexpected','unexplained','unassessed'].includes(reflection.epistemicStatus)}],
   'Σ':[{object:'Resultado observado de '+subjectLabel,sign:result.evidenceHash||'Sin evidencia ejecutada acreditada',interpretant:logic.summary||reflection.summary||'No se acredita una mejora.',scope:'Solo esta experiencia situada; no inteligencia general.'}]},
  Gamma:{Animal:{executed:result.executed,cases:result.cases},Mente:{goalId:goal.goalId,parentExperienceId:goal.parentExperienceId},Suceso:{evidenceHash:result.evidenceHash,possibilityBeyondModel:true,epistemicStatus:reflection.epistemicStatus,unknowns:reflection.unknowns,noveltyScope:reflection.noveltyScope},Realidad:{passed:result.passed,acceptedChange:L.acceptedChange}},L:{...L,scope:'newEvidence registra una observación ejecutada con huella inédita, no su verdad. Aprendizaje operativo exige además cambio aceptado, contratos completos e invariantes preservadas; leer o cambiar de pregunta no basta.'},unimplemented:['No se editan pesos, permisos ni código arbitrario del servidor desde esta espiral','No se resuelve una afirmación metafísica ni se acredita novedad universal']});
}

/** Persistent coordinator only: every observation, model call and physical
 * action is provided by the caller, which retains resource arbitration.
 */
export function createExperienceSpiral({directory,observe,proposeGoal,execute,reflect,formalize,now=Date.now,waitMs=30000,failureWaitMs=30000}={}){
 if(typeof directory!=='string'||!directory.trim())throw new TypeError('La espiral necesita una carpeta.');
 for(const [name,callback] of Object.entries({observe,execute,reflect,formalize}))if(typeof callback!=='function')throw new TypeError('Falta el callback '+name+'.');
 if(proposeGoal!==undefined&&typeof proposeGoal!=='function')throw new TypeError('proposeGoal debe ser una función.');
 const file=path.join(directory,'experience-spiral.json'),pause=Math.max(1000,Math.min(60000,Number(waitMs)||30000)),failurePause=Math.max(30000,Math.min(300000,Number(failureWaitMs)||30000));
 let state,initialized,busy=false;
 const stamp=()=>{const value=now();if(!Number.isFinite(value))throw new TypeError('El reloj debe devolver milisegundos finitos.');return new Date(value).toISOString();};
 async function save(){await fs.writeFile(file+'.tmp',JSON.stringify(state,null,2));await fs.rename(file+'.tmp',file);}
 async function init(){
  if(!initialized)initialized=(async()=>{
   await fs.mkdir(directory,{recursive:true});
   try{const loaded=JSON.parse(await fs.readFile(file,'utf8'));if(loaded.version!==1||!Array.isArray(loaded.history)||!Array.isArray(loaded.attemptKeys)||!Array.isArray(loaded.evidenceHashes))throw Error('Estado de espiral no válido.');state=loaded;}
   catch(error){if(error.code!=='ENOENT')throw error;state={version:1,enabled:true,phase:'waiting',nextRun:null,attempts:0,experiences:0,learningChanges:0,objectiveRevision:0,lastObjectiveHash:null,lastGoal:null,history:[],attemptKeys:[],evidenceHashes:[],current:null,waitReason:'ready'};await save();}
   // A crash never turns an unfinished action into learning or an approval.
   if(state.current){const record={...state.current,at:stamp(),reason:'interrupted',L:{newEvidence:false,acceptedChange:false,invariantsPreserved:false,countsAsLearning:false}};delete record.language;retain(record);state.current=null;state.phase='waiting';state.waitReason='interrupted';state.nextRun=new Date(now()+failurePause).toISOString();await save();}
  })();
  await initialized;
 }
 function retain(record){
  if(state.history.some(item=>item.id===record.id))return;
  state.history.push(record);state.history=state.history.slice(-80);state.experiences++;if(record.L?.countsAsLearning)state.learningChanges++;
 }
 function summary(record){return record?{at:record.at,taskId:record.goal?.taskId||null,focus:goalFocus(record.goal),executed:record.result?.executed===true,cases:record.result?.cases||0,passed:record.result?.passed||0,acceptedChange:record.L?.acceptedChange===true,newEvidence:record.L?.newEvidence===true,countsAsLearning:record.L?.countsAsLearning===true,epistemicStatus:EPISTEMIC.has(record.reflection?.epistemicStatus)?record.reflection.epistemicStatus:'unassessed',unknownsCount:record.reflection?.unknowns?.length||0,noveltyScope:record.reflection?.noveltyScope==='new-to-atlas'?'new-to-atlas':'unresolved',reason:record.reason}:null;}
 async function status(){await init();const objective=state.current?.goal||state.lastGoal;return {enabled:state.enabled!==false,paused:false,running:busy&&state.phase!=='waiting',phase:state.phase,objective:objective?{...structuredClone(objective),focus:goalFocus(objective)}:null,last:summary(state.history.at(-1)),experiences:state.experiences,learningChanges:state.learningChanges,attempts:state.attempts,sequence:state.attempts,nextOrdinal:state.attempts+1,nextRun:state.nextRun,waitReason:state.waitReason,qwenWeightsChanged:false,activeAdapter:false};}
 function key(goal,snapshot){return digest({taskId:goal.taskId,...(goal.taskId?{}:{focus:goalFocus(goal),kind:goal.kind}),evidenceHash:digest(snapshot),caseHash:snapshot.caseHash});}
 function fallback(snapshot,failures,unknowns){
  if(!snapshot.facts.length&&!snapshot.gaps.length&&!failures.length&&!unknowns.length)return null;
  const goals=IDS.filter(id=>snapshot.gaps.some(item=>item.taskId===id)||failures.some(item=>item.taskId===id)).map(id=>{
   const gap=snapshot.gaps.find(item=>item.taskId===id),failure=failures.find(item=>item.taskId===id),prior=[...state.history].reverse().find(item=>item.goal?.taskId===id),reason=failure?.summary||gap?.reason||snapshot.facts[0];
   const task=getAutonomousTask(id),goal={question:('¿Qué experimento ejecutable permite refutar o corregir '+task.name+' ante este hecho: '+reason+'?').slice(0,600),rationale:('Partir del dato observado y comprobar un cambio pequeño: '+reason).slice(0,1000),prediction:'Un caso ejecutado permitirá conservar o refutar la corrección sin presuponer su éxito.',kind:failure?'curriculum-repair':'tool-experiment',taskId:id,focus:id==='lor-omega-schema'?'language':'programming'};
   return {goal,priority:failure?0:1,last:prior?.ordinal||0};
  });
  const suggested=[...state.history].reverse().find(item=>item.reflection?.suggestedNextQuestion)?.reflection.suggestedNextQuestion;
  const unresolved=unknowns[0]||snapshot.facts[0]||'Queda una observación sin explicar.';
  goals.push({goal:{question:suggested||('¿Qué evidencia pública permitiría investigar lo aún no explicado: '+unresolved+'?').slice(0,600),rationale:('Acoger un posible acontecimiento sin forzarlo al catálogo de herramientas: '+unresolved).slice(0,1000),prediction:'La búsqueda puede aportar evidencia situada o dejar la pregunta sin resolver; no se predice novedad universal.',kind:'open-inquiry',taskId:null,focus:'unknown'},priority:2,last:0});
  const eligible=goals.filter(item=>!state.attemptKeys.includes(key(item.goal,snapshot))).sort((a,b)=>a.priority-b.priority||a.last-b.last||IDS.indexOf(a.goal.taskId)-IDS.indexOf(b.goal.taskId));
  return eligible[0]?.goal||null;
 }
 async function tick({signal}={}){
  if(busy)return {status:'busy',reason:'busy'};busy=true;let record=null,reason='completed',retained=false,shouldSchedule=false;
  try{
   await init();signal?.throwIfAborted();
   if(state.enabled===false)return {status:'waiting',reason:'disabled'};
   if(state.nextRun&&Date.parse(state.nextRun)>now())return {status:'waiting',reason:'cooldown',nextRun:state.nextRun};
   shouldSchedule=true;state.attempts++;state.phase='mind';state.nextRun=null;state.waitReason=null;await save();
   const ordinal=state.attempts,lastExperiences=state.history.slice(-3).map(recentExperience);
   const observed=await observe({signal,ordinal,sequence:ordinal,lastExperiences});signal?.throwIfAborted();
   const snapshot=observations(observed),failures=[...snapshot.failures,...lastExperiences.filter(item=>item.goal?.taskId&&item.result&&(!item.result.executed||item.result.passed!==item.result.cases)).map(item=>({taskId:item.goal.taskId,summary:item.result.summary||'El último experimento no superó sus casos.',caseHash:item.result.caseHash}))].slice(0,15),unknowns=[...new Set([...snapshot.unknowns,...lastExperiences.flatMap(item=>item.reflection?.unknowns||[])])].slice(0,12);
   let proposed=null;
   if(proposeGoal){try{proposed=goalValue(await proposeGoal({signal,ordinal,sequence:ordinal,observations:structuredClone(snapshot),lastExperiences,failures,unknowns}));}catch(error){signal?.throwIfAborted();}}
   signal?.throwIfAborted();
   const chosen=proposed&&!state.attemptKeys.includes(key(proposed,snapshot))?proposed:fallback(snapshot,failures,unknowns);
   if(!chosen){reason=snapshot.facts.length||snapshot.gaps.length||snapshot.failures.length||unknowns.length?'no_new_evidence':'no_eligible_goal';state.waitReason=reason;return {status:'waiting',reason};}
   const objectiveHash=digest(chosen),parent=state.history.at(-1),changedQuestion=state.lastGoal?.question!==chosen.question;
   if(state.lastObjectiveHash!==objectiveHash)state.objectiveRevision++;
   const goal={...chosen,goalId:'goal-'+digest({objectiveHash,ordinal}).slice(0,24),parentExperienceId:parent?.id||null,objectiveRevision:state.objectiveRevision,revision:state.objectiveRevision,changedQuestion,objectiveHash};
   record={id:'experience-'+ordinal+'-'+objectiveHash.slice(0,12),ordinal,at:stamp(),goal,observations:snapshot,observationHash:digest(snapshot),result:physicalResult(null),reflection:reflectionValue(null),logic:logicValue(null),phases:[{phase:'mind',at:stamp()}]};
   state.lastGoal=goal;state.lastObjectiveHash=objectiveHash;state.current=record;
   async function phase(value){signal?.throwIfAborted();state.phase=value;record.phases.push({phase:value,at:stamp()});await save();}
   await phase('ion');state.attemptKeys.push(key(goal,snapshot));await save();
   record.result=physicalResult(await execute({signal,ordinal,sequence:ordinal,goal:structuredClone(goal),observations:structuredClone(snapshot)}));
   record.physicalEvidenceNew=record.result.executed&&!!record.result.evidenceHash&&!state.evidenceHashes.includes(record.result.evidenceHash);
   if(record.physicalEvidenceNew)state.evidenceHashes.push(record.result.evidenceHash);
   await save();signal?.throwIfAborted();
   await phase('constellation');
   record.reflection=reflectionValue(await reflect({signal,ordinal,goal:structuredClone(goal),observations:structuredClone(snapshot),result:structuredClone(record.result)}));signal?.throwIfAborted();await save();
   await phase('logic');
   record.logic=logicValue(await formalize({signal,ordinal,goal:structuredClone(goal),observations:structuredClone(snapshot),result:structuredClone(record.result),reflection:structuredClone(record.reflection),lorFields:structuredClone(LOR_FIELDS)}));signal?.throwIfAborted();
   const result=record.result,newEvidence=record.physicalEvidenceNew===true,acceptedChange=goal.kind!=='open-inquiry'&&result.acceptedChange&&record.logic.acceptedChange,invariantsPreserved=result.executed&&result.cases>0&&result.passed===result.cases&&result.invariantsPreserved&&record.logic.invariantsPreserved;
   record.L={newEvidence,acceptedChange,invariantsPreserved,countsAsLearning:newEvidence&&acceptedChange&&invariantsPreserved};
   record.language=languageRecord(record);record.reason=newEvidence?'completed':'no_new_evidence';reason=record.reason;
   await phase('retained');retain(record);retained=true;await save();
   return {status:'retained',reason,experience:structuredClone(record)};
  }catch(error){
   reason=signal?.aborted?'cancelled':'callback_failed';shouldSchedule=!!state;
   if(record&&!retained){record.at=stamp();record.reason=reason;record.failedPhase=state.phase;record.L={newEvidence:false,acceptedChange:false,invariantsPreserved:false,countsAsLearning:false};delete record.language;retain(record);retained=true;}
   if(signal?.aborted)throw error;
   return {status:'failed',reason};
  }finally{
   if(state&&shouldSchedule){state.phase='waiting';state.current=null;state.waitReason=reason;state.nextRun=new Date(now()+(reason==='completed'?pause:failurePause)).toISOString();try{await save();}finally{busy=false;}}
   else busy=false;
  }
 }
 return {status,tick};
}
