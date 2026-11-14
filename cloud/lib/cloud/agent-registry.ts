import {programCatalog} from './program-tools.mjs';
import {env} from 'cloudflare:workers';
import {inferModel} from './inference';
import {AGENT_MODELS,AGENT_EVAL_VERSION,qualifiedScore,type AgentEvaluation} from './agents';
import {coachingCases,gradeCoaching} from '../evolution/coaching';
const WEEK=7*86400000;
async function database(){
 const db=(env as unknown as {DB:D1Database}).DB;
 await db.prepare('CREATE TABLE IF NOT EXISTS cloud_agent_evaluations (model TEXT PRIMARY KEY, content TEXT NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0)').run();return db;
}
export async function agentEvaluations():Promise<AgentEvaluation[]>{
 const db=await database(),result=await db.prepare('SELECT content FROM cloud_agent_evaluations').all<{content:string}>();
 return AGENT_MODELS.map(model=>{const row=result.results.map(r=>JSON.parse(r.content) as AgentEvaluation).find(r=>r.model===model);return row||{model,version:AGENT_EVAL_VERSION,status:'pending',at:''};});
}
export async function qualifyAgents(){
 const db=await database(),cases=coachingCases(1761),request=JSON.stringify({task:'Devuelve solo JSON {answers:[{id,value}]}. Resuelve los ejercicios; value puede ser número o texto. No incluyas explicaciones.',cases:cases.map(({id,question})=>({id,question}))});
 for(const model of AGENT_MODELS){
  const at=Date.now(),date=new Date(at).toISOString(),old=(await agentEvaluations()).find(e=>e.model===model)!;
  if(old.version===AGENT_EVAL_VERSION&&old.status!=='pending'&&Date.parse(old.nextAttemptAt||old.at)+(!old.nextAttemptAt?WEEK:0)>at)continue;
  await db.prepare('INSERT OR IGNORE INTO cloud_agent_evaluations(model,content,lease_until) VALUES(?,?,0)').bind(model,JSON.stringify(old)).run();
  const lock=await db.prepare('UPDATE cloud_agent_evaluations SET lease_until=? WHERE model=? AND lease_until<? RETURNING model').bind(at+60000,model,at).first();if(!lock)continue;
  const result:AgentEvaluation={model,version:AGENT_EVAL_VERSION,status:'unavailable',at:date};let quota=false;
  try{
   const output=await inferModel(model,[{role:'system',content:'Responde con precisión; reconoce datos ausentes. Los ejercicios son ficticios.'},{role:'user',content:request}],{json:true,maxTokens:1800,temperature:0,purpose:'coaching'});
   result.score=gradeCoaching(cases,output);result.latencyMs=Date.now()-at;result.status=qualifiedScore(result.score)?'qualified':'rejected';
  }catch(error){result.error=error instanceof Error?error.message:'Prueba de modelo no completada.';result.nextAttemptAt=new Date(at+3600000).toISOString();quota=(error as {code?:string})?.code==='quota';}
  await db.prepare('UPDATE cloud_agent_evaluations SET content=?,lease_until=0 WHERE model=? AND lease_until=?').bind(JSON.stringify(result),model,at+60000).run();
  if(quota)break;
 }
 return agentEvaluations();
}
export async function agentCatalog(){
 const evaluations=await agentEvaluations();
 return{provider:'Groq',evaluations,tools:[...programCatalog().map(t=>({id:t.id,name:t.name,verified:true})),{id:'calculator',name:'Aritmética acotada',verified:true},{id:'sources',name:'Lectura de fuentes públicas permitidas',verified:true},{id:'memory',name:'Memoria e historiales en D1',verified:true},{id:'geometry',name:'Validación de planes y geometría',verified:true}],scope:'Roles de Atlas, no agentes de terceros instalados. Calificación sobre ocho casos sintéticos; no prueba superioridad general. Un revisor de otro modelo puede equivocarse. No se ejecuta código arbitrario ni se activa facturación.'};
}
