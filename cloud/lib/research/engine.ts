import {chunkKnowledge,retrieve,tokens,type Knowledge} from '../atlas-core.ts';
import {EVALUATOR_VERSION,DEVELOPMENT,HELDOUT,evaluateCandidate} from './evaluator.ts';
import {sha256,type WebResult,type WebAttempt} from './web.ts';
import type {ResearchControl,ResearchRun,StoredSource} from './types.ts';
import {TOPICS} from './topics.ts';
export const initialControl=():ResearchControl=>({enabled:true,topicIndex:0,profile:'baseline',evaluatedVersions:[],nextQuestion:TOPICS[0].question,lastRunAt:null,lastRunId:null});
export function sourceKnowledge(sources:StoredSource[]):Knowledge[]{
 const latest=new Map<string,StoredSource>();for(const s of sources)if(!latest.has(s.url)||s.fetchedAt>=latest.get(s.url)!.fetchedAt)latest.set(s.url,s);
 return chunkKnowledge([...latest.values()].map(s=>({id:s.id,title:s.title,text:s.text,url:s.url,date:s.fetchedAt,kind:s.kind+' · leída '+s.fetchedAt.slice(0,10)})));
}
export async function buildResearchRun(args:{control:ResearchControl;known:StoredSource[];knownHashes:Set<string>;fetched:WebResult[];attempts:WebAttempt[];question:string;query:string;trigger:'manual'|'schedule';id:string;requestId:string;started:number;date:string;taskMode?:'topic'|'follow-up'|'manual'}){
 const {control,known,knownHashes,fetched,attempts,question,id,requestId,started,date,trigger}=args;
 const sources:StoredSource[]=[],seen=new Set(knownHashes);let repeated=0;
 for(const s of fetched){
  // Bibliographic and repository metadata remain search leads, not learned evidence.
  if(s.text.trim().length<100||/Metadatos/.test(s.kind))continue;
  const hash=await sha256(s.text);if(seen.has(hash)){repeated++;continue;}seen.add(hash);
  sources.push({...s,id:hash,hash,fetchedAt:date,runId:id});if(sources.length===3)break;
 }
 const evaluatorHash=await sha256(JSON.stringify({version:EVALUATOR_VERSION,development:DEVELOPMENT,heldout:HELDOUT}));
 const evaluation=control.evaluatedVersions.includes(evaluatorHash)?null:evaluateCandidate(control.profile);
 const profile=evaluation?.profile||control.profile;
 const available=attempts.some(a=>a.ok),status=sources.length||evaluation?.promoted?'Aprendizaje registrado':available?'Sin novedad':'Sin acceso';
 const before=retrieve(args.query,sourceKnowledge(known),3,control.profile).length,after=retrieve(args.query,sourceKnowledge([...known,...sources]),3,profile).length;
 const negativeMemory=[
  ...attempts.filter(a=>!a.ok).map(a=>`${a.provider}: ${a.detail}. Este fallo no se cuenta como aprendizaje.`),
  ...(evaluation&&!evaluation.promoted?['La propuesta de recuperación no superó el criterio de promoción; se conserva el perfil anterior.']:[]),
  'Leer una fuente amplía memoria recuperable; no demuestra su verdad ni entrena pesos neuronales.',
  'La prueba de recuperación mide casos sintéticos; no demuestra comprensión ni capacidad general.',
 ];
 const taskMode=args.taskMode||'topic';
 const titleTerms=sources.length?tokens(sources[0].title).filter(t=>!['the','and','for','with','web','2d','3d','graphics','api','apis','mdn','documentation','docs'].includes(t)).slice(0,4):[];
 const pendingFollowUp=taskMode==='manual'?control.pendingFollowUp:taskMode==='topic'&&sources.length?{question:`¿Qué límites o contraejemplos documentan otras fuentes sobre «${sources[0].title}»?`,query:(titleTerms.join(' ')||args.query)+' limitations'}:undefined;
 const topicIndex=taskMode==='manual'?control.topicIndex:taskMode==='topic'&&pendingFollowUp?control.topicIndex:control.topicIndex+1;
 const nextQuestion=pendingFollowUp?.question||TOPICS[topicIndex%TOPICS.length].question;
 const run:ResearchRun={id,requestId,date,question,trigger,status,sourceIds:sources.map(s=>s.id),repeated,attempts,evaluation,evaluatorHash,negativeMemory,nextQuestion,coverage:{before,after},elapsedMs:Math.max(0,Date.now()-started),phases:[
  {name:'Observar',result:`${attempts.filter(a=>a.ok).length}/${attempts.length} accesos disponibles; ${sources.length} extractos nuevos con URL, fecha y SHA-256; ${repeated} repetidos.`},
  {name:'Comprender',result:'El texto se conserva como contenido por contrastar, separado de instrucciones, metadatos y datos privados. La extracción no acredita comprensión semántica.'},
  {name:'Conectar',result:`Fragmentos recuperables para la consulta: ${before} → ${after}. Es cobertura léxica, no una nota de corrección ni causalidad.`},
  {name:'Aplicar',result:`${sources.length} versiones de fuente conservadas. Perfil de recuperación: ${control.profile} → ${profile}. No se modifican código, juez ni pesos.`},
  {name:'Refutar',result:evaluation?`Banco fijo: ${evaluation.before.passed}/${evaluation.before.total} → ${evaluation.after.passed}/${evaluation.after.total}; regresión: ${evaluation.regression?'sí':'no'}. ${evaluation.scope}`:'Esta versión del juez ya fue utilizada. No se vuelve a consultar como un resultado nuevo.'},
  {name:'Aprender',result:status==='Aprendizaje registrado'?`Novedad trazable: ${sources.length} extractos${evaluation?.promoted?' y una mejora acotada de recuperación promovida':''}. La numeración Q histórica no cambia.`:'Se registra el intento y su límite, sin sumar una vuelta de aprendizaje.'}
 ]};
 return{sources,run,control:{...control,topicIndex,pendingFollowUp,profile,evaluatedVersions:evaluation?[...control.evaluatedVersions,evaluatorHash]:control.evaluatedVersions,nextQuestion,lastRunAt:date,lastRunId:id}};
}
