import {env} from 'cloudflare:workers';
import {RESEARCH_SQL} from './storage-sql';
import {initialControl,buildResearchRun,sourceKnowledge} from './engine';
import {TOPICS} from './topics';
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
 return{control:JSON.parse(row.content),revision:row.revision,busy:row.lease_until>Date.now(),sources:sources.results.map(r=>JSON.parse(r.content)),runs:runs.results.map(r=>JSON.parse(r.content)),stats:stats!};
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
 const acquired=await db().prepare(RESEARCH_SQL.acquire).bind(id,started+120000,row.revision,started).first();if(!acquired)throw new Error('BUSY');
 try{
  const topic=TOPICS[control.topicIndex%TOPICS.length],taskMode=input.query||input.url?'manual':control.pendingFollowUp?'follow-up':'topic';
  const query=input.query||(taskMode==='follow-up'?control.pendingFollowUp!.query:topic.query),question=input.query||(taskMode==='follow-up'?control.pendingFollowUp!.question:topic.question);
  const directUrl=input.url||input.query?.match(/https:\/\/[^\s<>]+/)?.[0];
  const tasks=[...(directUrl?[]:[{provider:'Búsqueda pública',run:()=>searchInternet(query)}]),{provider:directUrl?'Lectura HTTPS':'Fuente de referencia',run:()=>readPublicPage(directUrl||topic.url)}];
  // A manual text search must not add a reference unrelated to the user's question.
  if((input.query||taskMode==='follow-up')&&!directUrl)tasks.pop();
  const results=await Promise.allSettled(tasks.map(t=>t.run())),attempts:WebAttempt[]=[],fetched:WebResult[]=[];
  results.forEach((r,i)=>{if(r.status==='fulfilled'){if('results' in r.value){attempts.push(...r.value.attempts);fetched.push(...r.value.results.filter(s=>!/Metadatos/.test(s.kind)).slice(0,3));}else{attempts.push({provider:tasks[i].provider,ok:true,detail:'Texto leído por HTTPS'});fetched.unshift(r.value);}}else attempts.push({provider:tasks[i].provider,ok:false,detail:r.reason instanceof Error?r.reason.message:'No disponible'});});
  const existing=await db().prepare('SELECT content,hash FROM research_sources ORDER BY fetched_at DESC LIMIT 120').all<{content:string;hash:string}>();
  const hashes=new Set<string>();for(const source of fetched){const hash=await sha256(source.text);const hit=await db().prepare('SELECT id FROM research_sources WHERE id=?').bind(hash).first();if(hit)hashes.add(hash);}
  const next=await buildResearchRun({control,known:existing.results.map(r=>JSON.parse(r.content)),knownHashes:hashes,fetched,attempts,question,query,trigger:input.trigger,id,requestId:input.requestId,started,date,taskMode});
  const batch=[...next.sources.map(s=>db().prepare(RESEARCH_SQL.source).bind(s.id,s.url,s.title,s.hash,JSON.stringify(s),s.fetchedAt,id,row.revision,id)),db().prepare(RESEARCH_SQL.run).bind(id,input.requestId,next.run.status,JSON.stringify(next.run),date,row.revision,id),db().prepare(RESEARCH_SQL.commit).bind(JSON.stringify(next.control),date,row.revision,id)];
  const committed=await db().batch(batch);if(!committed.at(-1)?.results?.length)throw new Error('CONFLICT');
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
