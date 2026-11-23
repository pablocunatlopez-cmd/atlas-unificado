import {missionTools} from '../collaboration/missions';
import {consultIcarus} from '../collaboration/server';
import {livingPayload,buildLiving,advanceLivingReference,livingBuildReceipt} from '../evolution/living-server';
import {evolveProgram,programDue} from '../evolution/program-server';
import {selectResearchSources} from './relevance';
import {verifyProgramLibrary} from '../cloud/program-tools.mjs';
import {coachingDue} from '../evolution/coaching';
import {runCoaching} from '../evolution/coach-server';
import {env} from 'cloudflare:workers';
import {RESEARCH_SQL} from './storage-sql';
import {initialControl,buildResearchRun,sourceKnowledge} from './engine';
import {TOPICS} from './topics';
import {cloudConfigured,CLOUD_MODEL} from '../cloud/inference';
import {chooseResearch,reflectResearch} from './deliberation';
import {BRANCHES,initialSpiral,advanceSpiral} from '../evolution/spiral';
import {runCapabilityTrial} from '../evolution/benchmarks';
import {initialWorld,expandWorld,selectWorldActor,worldPerspective,advanceWorld,rememberWorldCreation,rememberWorldConsultation,rememberWorldProgram} from '../evolution/world';
import {readPublicPage,searchInternet,sha256,type WebAttempt,type WebResult} from './web';
import type {ResearchControl,ResearchPayload,ResearchRun,StoredSource,ResearchSchedule} from './types';
type ControlRow={revision:number;content:string;lease_until:number};
function db(){if(!env.DB)throw new Error('DB');return env.DB;}
async function controlRow(){const at=new Date().toISOString();await db().prepare("INSERT OR IGNORE INTO research_control(id,revision,content,lease_until,updated_at) VALUES('main',0,?,0,?)").bind(JSON.stringify(initialControl()),at).run();return(await db().prepare("SELECT revision,content,lease_until FROM research_control WHERE id='main'").first<ControlRow>())!;}
export async function getResearchKnowledge(){const row=await controlRow();const docs=await db().prepare('SELECT content FROM research_sources ORDER BY fetched_at DESC LIMIT 120').all<{content:string}>();return{profile:(JSON.parse(row.content) as ResearchControl).profile,knowledge:sourceKnowledge(docs.results.map(r=>JSON.parse(r.content) as StoredSource))};}
export async function researchPayload():Promise<ResearchPayload>{
 const row=await controlRow();const [sources,runs,stats]=await Promise.all([
  db().prepare('SELECT content FROM research_sources ORDER BY fetched_at DESC LIMIT 18').all<{content:string}>(),
  db().prepare('SELECT content FROM research_runs ORDER BY created_at DESC LIMIT 18').all<{content:string}>(),
  db().prepare("SELECT (SELECT count(*) FROM research_sources) AS sources,count(*) AS runs,coalesce(sum(status='Aprendizaje registrado'),0) AS learning FROM research_runs").first<{sources:number;runs:number;learning:number}>()
 ]);
 const currentControl=JSON.parse(row.content);if(currentControl.spiral?.world)currentControl.spiral.world=expandWorld(currentControl.spiral.world);
 return{control:currentControl,revision:row.revision,busy:row.lease_until>Date.now(),sources:sources.results.map(r=>JSON.parse(r.content)),runs:runs.results.map(r=>JSON.parse(r.content)),stats:stats!};
}
export async function configureResearch(enabled:boolean,revision:number){
 const row=await controlRow();if(row.revision!==revision)throw new Error('CONFLICT');
 const control={...JSON.parse(row.content),enabled};
 const result=await db().prepare("UPDATE research_control SET content=?,revision=revision+1,updated_at=? WHERE id='main' AND revision=? RETURNING revision").bind(JSON.stringify(control),new Date().toISOString(),revision).first();
 if(!result)throw new Error('CONFLICT');return researchPayload();
}
export async function runResearch(input:{query?:string;url?:string;trigger:'manual'|'schedule';requestId:string}){
 const previous=await db().prepare('SELECT content FROM research_runs WHERE request_id=?').bind(input.requestId).first<{content:string}>();if(previous)return{...await researchPayload(),run:JSON.parse(previous.content) as ResearchRun};
 const row=await controlRow(),control=JSON.parse(row.content) as ResearchControl;
 if(!control.enabled)return{...await researchPayload(),paused:true};
 const started=Date.now(),id=crypto.randomUUID(),date=new Date().toISOString();
 const acquired=await db().prepare(RESEARCH_SQL.acquire).bind(id,started+180000,row.revision,started).first();if(!acquired)throw new Error('BUSY');
 let referenceRevision:number|undefined;
 try{
  // Recheck under our lease: a duplicate may have committed after the first lookup.
  const replayRun=await db().prepare('SELECT content FROM research_runs WHERE request_id=?').bind(input.requestId).first<{content:string}>();if(replayRun)return{...await researchPayload(),run:JSON.parse(replayRun.content) as ResearchRun};
  if(input.trigger==='schedule'&&!input.query&&!input.url){
   const consultation=await consultIcarus({requestId:'vocation:'+input.requestId,trigger:'schedule'});
   let programming=control.programming,programmingTrial:ResearchRun['programmingTrial'];
   if(missionTools(consultation.actorId).includes('program-lab')&&programDue(programming,started)&&(await livingPayload()).budget.backgroundAvailable){const evolved=await evolveProgram(programming,started,consultation.actorId);programming=evolved.state;programmingTrial=evolved.trial;}
   const coached=missionTools(consultation.actorId).includes('strategy-eval')&&coachingDue(control.coaching,started)&&(await livingPayload()).budget.backgroundAvailable?await runCoaching(control.coaching,started):undefined;
   const sources:StoredSource[]=await Promise.all(consultation.sources.map(async source=>({id:source.id,url:source.url,title:source.title,text:source.excerpt,hash:await sha256(source.excerpt),provider:new URL(source.url).hostname,kind:'Documento público leído para un oficio; contenido por contrastar',runId:id,fetchedAt:source.readAt})));
   const run:ResearchRun={id,requestId:input.requestId,date,trigger:input.trigger,question:consultation.question,status:consultation.status==='blocked'?'Sin acceso':consultation.status==='proposed'?'Propuesta registrada':'Evidencia recogida',consultation,sourceIds:sources.map(s=>s.id),repeated:0,attempts:consultation.attempts,evaluation:null,evaluatorHash:'',negativeMemory:['Leer documentación y proponer un cambio no demuestra que se haya aplicado. Cada oficio necesita su propia validación.'],nextQuestion:consultation.question,coverage:{before:0,after:sources.length},elapsedMs:Date.now()-started,...(programmingTrial?{programmingTrial}:{}),phases:[{name:'Investigar el oficio con Ícaro',result:consultation.actorName+' · '+consultation.title},{name:'Leer y contrastar',result:consultation.sources.length+' fuentes leídas; '+consultation.agents.filter(a=>a.status==='completed').length+' intervenciones de modelo completadas.'},{name:'Preparar aplicación',result:consultation.application+' Estado: '+consultation.status+'. La publicación requiere pruebas y un recibo posterior.'}]};
   if(programmingTrial){run.phases.push({name:'Ejecutar programa del oficio',result:programmingTrial.reason});if(programmingTrial.decision==='installed')run.status='Programa instalado';if(programmingTrial.decision==='promoted')run.status='Aprendizaje registrado';}
   if(coached){run.coachingTrial=coached.trial;run.phases.push({name:'Comparar estrategias con Cota',result:coached.trial.reason});if(coached.trial.decision==='promoted')run.status='Aprendizaje registrado';}
   const baseSpiral=control.spiral||initialSpiral();let nextWorld=rememberWorldConsultation(baseSpiral.world||initialWorld(),consultation,id);if(programmingTrial)nextWorld=rememberWorldProgram(nextWorld,programmingTrial,id);const updated={...control,programming,coaching:coached?.state||control.coaching,lastRunAt:date,lastRunId:id,nextQuestion:consultation.question,spiral:{...baseSpiral,world:nextWorld}};
   const committed=await db().batch([...sources.map(s=>db().prepare(RESEARCH_SQL.source).bind(s.id,s.url,s.title,s.hash,JSON.stringify(s),s.fetchedAt,id,row.revision,id)),db().prepare(RESEARCH_SQL.run).bind(id,input.requestId,run.status,JSON.stringify(run),date,row.revision,id),db().prepare(RESEARCH_SQL.commit).bind(JSON.stringify(updated),date,row.revision,id)]);if(!committed.at(-1)?.results?.length)throw Error('CONFLICT');return{...await researchPayload(),run};
  }
  const topic=TOPICS[control.topicIndex%TOPICS.length],taskMode=input.query||input.url?'manual':control.pendingFollowUp?'follow-up':'topic';
  const spiral=control.spiral||initialSpiral(),branch=taskMode==='manual'?null:spiral.branches[spiral.cursor%spiral.branches.length],definition=BRANCHES.find(b=>b.id===branch?.id);
  const world=spiral.world||initialWorld(),actor=branch?selectWorldActor(world,branch.id):null,perspective=actor?worldPerspective(world,actor):undefined;
  let query=input.query||(taskMode==='follow-up'?control.pendingFollowUp!.query:topic.query),question=input.query||(taskMode==='follow-up'?control.pendingFollowUp!.question:topic.question);
  if(branch){query=branch.query;question=branch.question;}
  let reason='',inferenceError='';
  if(cloudConfigured()&&!input.query&&!input.url){
   try{const recent=await db().prepare('SELECT content FROM research_runs ORDER BY created_at DESC LIMIT 18').all<{content:string}>();const plan=await chooseResearch(branch?{...control,nextQuestion:branch.question,pendingFollowUp:{question:branch.question,query:branch.query}}:control,recent.results.map(r=>JSON.parse(r.content)).filter((r:ResearchRun)=>!branch||r.spiral?.branch===branch.id),definition?.name,perspective);query=plan.query;question=plan.question;reason=plan.reason;}
   catch(e){inferenceError=e instanceof Error?e.message:'Inferencia no disponible';}
  }
  const directUrl=input.url||input.query?.match(/https:\/\/[^\s<>]+/)?.[0];
  const tasks=[...(directUrl?[]:[{provider:'Búsqueda pública',run:()=>searchInternet(query)}]),{provider:directUrl?'Lectura HTTPS':'Fuente de referencia',run:()=>readPublicPage(directUrl||topic.url)}];
  // A manual text search must not add a reference unrelated to the user's question.
  if((input.query||taskMode==='follow-up'||cloudConfigured())&&!directUrl)tasks.pop();
  // A primary reference anchors each capability spiral even if search is noisy.
  if(definition&&!directUrl)tasks.unshift({provider:'Documentación primaria · '+definition.name,run:()=>readPublicPage(definition.url)});
  if(inferenceError)tasks.length=0;
  const results=await Promise.allSettled(tasks.map(t=>t.run())),attempts:WebAttempt[]=[],fetched:WebResult[]=[];
  results.forEach((r,i)=>{if(r.status==='fulfilled'){if('results' in r.value){attempts.push(...r.value.attempts);fetched.push(...r.value.results.filter(s=>!/Metadatos/.test(s.kind)).slice(0,3));}else{attempts.push({provider:tasks[i].provider,ok:true,detail:'Texto leído por HTTPS'});fetched.unshift(r.value);}}else attempts.push({provider:tasks[i].provider,ok:false,detail:r.reason instanceof Error?r.reason.message:'No disponible'});});
  const selection=directUrl?{accepted:fetched,rejected:[],method:'explicit-url' as const}:selectResearchSources(query,fetched);
  const selectedCount=selection.accepted.length;fetched.splice(0,fetched.length,...selection.accepted);
  const existing=await db().prepare('SELECT content,hash FROM research_sources ORDER BY fetched_at DESC LIMIT 120').all<{content:string;hash:string}>();
  const hashes=new Set<string>();for(const source of fetched){const hash=await sha256(source.text);const hit=await db().prepare('SELECT id FROM research_sources WHERE id=?').bind(hash).first();if(hit)hashes.add(hash);}
  const next=await buildResearchRun({control,known:existing.results.map(r=>JSON.parse(r.content)),knownHashes:hashes,fetched,attempts,question,query,trigger:input.trigger,id,requestId:input.requestId,started,date,taskMode});
  next.run.sourceSelection={method:selection.method,accepted:selectedCount,rejected:selection.rejected};
  if(cloudConfigured()){
   if(!inferenceError)try{
    const result=await reflectResearch(question,[...next.sources,...existing.results.map(r=>JSON.parse(r.content) as StoredSource).filter(s=>fetched.some(f=>f.url===s.url))],perspective);
    next.run.deliberation={...result,status:'completed',reason,...(reason?{plannerModel:CLOUD_MODEL}:{})};
    next.run.nextQuestion=result.reflection.nextQuestion;
    next.run.phases.push({name:'Contrastar con el modelo',result:result.reflection.conclusion});
    // A manual investigation does not displace the unattended agenda.
    if(taskMode!=='manual'){next.control.pendingFollowUp={question:result.reflection.nextQuestion,query:result.reflection.nextQuery};next.control.nextQuestion=result.reflection.nextQuestion;}
   }catch(e){inferenceError=e instanceof Error?e.message:'Inferencia no disponible';}
   if(inferenceError){
    next.run.deliberation={model:CLOUD_MODEL,status:'unavailable',error:inferenceError};
    next.run.negativeMemory.push(inferenceError+' No se ha demostrado deliberación ni una mejora.');
    next.run.phases.push({name:'Inferencia pendiente',result:inferenceError});
    // Retry the same unresolved question next time; do not manufacture a new question.
    next.control.pendingFollowUp=control.pendingFollowUp;next.control.nextQuestion=control.nextQuestion;next.control.topicIndex=control.topicIndex;next.run.nextQuestion=control.nextQuestion;
    if(!next.sources.length){next.run.status='Sin acceso';next.run.evaluation=null;next.control.profile=control.profile;next.control.evaluatedVersions=control.evaluatedVersions;}
   }
  }
  if(branch?.id==='programming'){const tools=verifyProgramLibrary();next.run.programTools=tools;next.run.phases.push({name:'Ejecutar biblioteca',result:`${tools.passed}/${tools.total} contratos de cinco herramientas comprobados. ${tools.scope}`});}
  if(branch){
   const technical=runCapabilityTrial(branch.id,spiral.profiles),advanced=advanceSpiral(spiral,next.run,technical.trial,technical.profiles);
   next.control.spiral=advanced.state;next.run.spiral=advanced.turn;
   if(actor){const result=advanceWorld(world,actor,next.run,technical.trial);next.control.spiral.world=result.world;next.run.spiral.world=result.receipt;}
   next.control.pendingFollowUp={question:advanced.nextBranch.question,query:advanced.nextBranch.query};next.control.nextQuestion=advanced.nextBranch.question;next.run.nextQuestion=advanced.nextBranch.question;
   next.run.phases.push({name:'Prueba técnica · '+branch.id,result:`${technical.trial.decision}: ${technical.trial.metric}: ${technical.trial.before} → ${technical.trial.after}. ${technical.trial.scope}`});
   if(technical.trial.decision==='promoted')next.run.status='Aprendizaje registrado';
   if(technical.trial.decision==='rejected')next.run.negativeMemory.push('Candidato técnico rechazado: '+technical.trial.candidate+'. Se conserva el perfil anterior.');
  }
  next.run.elapsedMs=Date.now()-started;
  const batch=[...next.sources.map(s=>db().prepare(RESEARCH_SQL.source).bind(s.id,s.url,s.title,s.hash,JSON.stringify(s),s.fetchedAt,id,row.revision,id)),db().prepare(RESEARCH_SQL.run).bind(id,input.requestId,next.run.status,JSON.stringify(next.run),date,row.revision,id),db().prepare(RESEARCH_SQL.commit).bind(JSON.stringify(next.control),date,row.revision,id)];
  const committed=await db().batch(batch);if(!committed.at(-1)?.results?.length)throw new Error('CONFLICT');
  if(referenceRevision!==undefined)await advanceLivingReference(referenceRevision);
  return{...await researchPayload(),run:next.run};
 }finally{await db().prepare(RESEARCH_SQL.release).bind(id).run();}
}
export async function rollbackResearch(revision:number){
 const row=await controlRow();if(row.revision!==revision||row.lease_until>Date.now())throw new Error('CONFLICT');
 const control=JSON.parse(row.content) as ResearchControl,at=new Date().toISOString(),id=crypto.randomUUID();
 const run:ResearchRun={id,requestId:'rollback:'+id,date:at,trigger:'manual',question:'Restaurar el perfil base de recuperación',status:'Restaurado',sourceIds:[],repeated:0,attempts:[],phases:[{name:'Restaurar',result:`Perfil ${control.profile} → baseline. Se conservan fuentes, resultados y juez ya evaluado.`}],evaluation:null,evaluatorHash:'',negativeMemory:['Una restauración no elimina errores ni repite un test como aprendizaje.'],nextQuestion:control.nextQuestion,coverage:{before:0,after:0},elapsedMs:0};
 const result=await db().batch([
  db().prepare("INSERT INTO research_runs(id,request_id,status,content,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM research_control WHERE id='main' AND revision=? AND lease_until<?)").bind(id,run.requestId,run.status,JSON.stringify(run),at,revision,Date.now()),
  db().prepare("UPDATE research_control SET content=?,revision=revision+1,updated_at=? WHERE id='main' AND revision=? AND lease_until<? RETURNING revision").bind(JSON.stringify({...control,profile:'baseline'}),at,revision,Date.now())
 ]);if(!result.at(-1)?.results?.length)throw new Error('CONFLICT');return researchPayload();
}
export async function linkResearchSchedule(schedule:ResearchSchedule){
 const row=await controlRow();const control={...JSON.parse(row.content),schedule};
 const result=await db().prepare("UPDATE research_control SET content=?,revision=revision+1,updated_at=? WHERE id='main' AND revision=? AND lease_until<? RETURNING revision").bind(JSON.stringify(control),new Date().toISOString(),row.revision,Date.now()).first();
 if(!result)throw new Error('CONFLICT');return researchPayload();
}
