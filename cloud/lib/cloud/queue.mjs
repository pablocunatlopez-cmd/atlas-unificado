import {buildLiaHypothesisLedger} from '../../../continuous/lia-hypothesis-ledger.mjs';
/** D1-backed, user-isolated handoff to the owner's local inference worker. */
import {validateCreativePlan} from '../creative/plan.mjs';
import {sanitizeProcessTelemetry} from '../core/process-telemetry.mjs';
import {RESIDENT_MEMORY_LIMIT,RESIDENT_MEMORY_RETENTION_MS,buildResidentMemoryEvents,isResidentId} from '../core/resident-memory.mjs';
export class CloudQueueError extends Error {
 constructor(message,status=400){super(message);this.status=status;}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MESSAGES=1000,LEASE_MS=300000;
const active="('queued','running')";
const fail=(message,status=400)=>{throw new CloudQueueError(message,status);};
const validId=value=>typeof value==='string'&&UUID.test(value);
const safeTitle=text=>text.replace(/\s+/g,' ').trim().slice(0,80);
const safeAgent=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value);

async function verifyLiaJournalInCloud(journal,allowedHypotheses){
 if(!Array.isArray(journal)||journal.length>30)return false;
 const encoder=new TextEncoder();let previousHash=null;
 for(const entry of journal){
  if(!entry||typeof entry.id!=='string'||!/^[\\w-]{1,80}$/.test(entry.id)||!allowedHypotheses.has(entry.hypothesisId)||entry.previousHash!==previousHash||typeof entry.hash!=='string'||!/^[a-f0-9]{64}$/.test(entry.hash))return false;
  const t=entry.transition,c=t?.check;
  if(!t||!c||c.executed!==true||t.previousStatus!=='testing'||!['citation-audit','deterministic-tool'].includes(c.kind)||!['pass','fail','unknown'].includes(c.outcome)||typeof c.reference!=='string'||!c.reference.trim()||c.reference.length>240)return false;
  const expected=c.outcome==='pass'?'supported':c.outcome==='fail'?'refuted':'inconclusive';
  if(t.nextStatus!==expected||t.rule!==(c.outcome==='pass'?'recorded-check-passed':c.outcome==='fail'?'recorded-check-failed':'executed-check-inconclusive')||t.changed!==(expected!=='testing')||t.factualAccuracyVerified!==false)return false;
  const hypothesis=allowedHypotheses.get(entry.hypothesisId);
  if(hypothesis.status!==expected||!hypothesis.evidence.some(e=>e.type==='tool-output'&&e.verified===true&&e.reference===c.reference))return false;
  if(typeof entry.timestamp!=='string'||!/^\\d{4}-\\d\\d-\\d\\dT/.test(entry.timestamp))return false;
  const {hash,...payload}=entry;
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(JSON.stringify(payload))));
  const computed=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
  if(computed!==hash)return false;
  previousHash=hash;
 }
 return true;
}

function publicJob(row){
 if(!row)return null;
 const result={id:row.id,conversationId:row.conversation_id,status:row.status,kind:row.kind||'chat',progress:row.progress||0,stage:row.stage||null,createdAt:row.created_at,updatedAt:row.updated_at};
 if(row.status==='completed'&&row.result)result.result=JSON.parse(row.result);
 if(row.status==='failed')result.error=row.error||'El motor local no pudo completar la respuesta.';
 return result;
}
function contextWindow(rows){
 const result=[];let size=0;
 for(const row of rows){if(result.length>=15||size+row.content.length>10000)break;result.unshift({role:row.role,content:row.content});size+=row.content.length;}
 while(result[0]?.role==='assistant')result.shift();
 return result;
}
async function jobId(userId,requestId){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(userId+'\0'+requestId));
 return 'job-'+[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
export function createCloudQueue(db,{now=()=>Date.now(),uuid=()=>crypto.randomUUID(),compileCreative,enrichMessages}={}){
 const statement=(sql,...values)=>db.prepare(sql).bind(...values);
 const one=(sql,...values)=>statement(sql,...values).first();
 const all=async(sql,...values)=>(await statement(sql,...values).all()).results||[];
 async function ownedConversation(userId,id){
  if(!validId(id))fail('Conversación no encontrada.',404);
  const row=await one('SELECT id,title,updated_at FROM cloud_conversations WHERE id=? AND user_id=?',id,userId);
  if(!row)fail('Conversación no encontrada.',404);return row;
 }
 async function ownedJob(userId,id){
  if(typeof id!=='string'||!/^job-[a-f0-9]{64}$/.test(id))fail('Solicitud no encontrada.',404);
  const row=await one('SELECT * FROM cloud_jobs WHERE id=? AND user_id=?',id,userId);
  if(!row)fail('Solicitud no encontrada.',404);return row;
 }
 async function enqueue(userId,input){
  if(!input||typeof input.message!=='string'||!input.message.trim()||input.message.length>6000)fail('Escribe entre 1 y 6000 caracteres.');
  if(!validId(input.requestId))fail('El identificador de la solicitud no es válido.');
  if(input.conversationId!==undefined&&!validId(input.conversationId))fail('El identificador de la conversación no es válido.');
  const kind=input.kind??'chat';if(!['chat','world','game','video','lor','review'].includes(kind))fail('Herramienta no disponible.');
  const parameters=kind==='video'?{frames:input.parameters?.frames??17,steps:input.parameters?.steps??5,fps:8,width:480,height:272}:{};
  if(kind==='video'&&(![17,33,49,65,81].includes(parameters.frames)||!Number.isInteger(parameters.steps)||parameters.steps<5||parameters.steps>30))fail('La duración o los pasos de vídeo exceden los límites.');
  const serializedParameters=JSON.stringify(parameters);
  const message=input.message.trim(),id=await jobId(userId,input.requestId),at=now();
  const previous=await one('SELECT * FROM cloud_jobs WHERE id=? AND user_id=?',id,userId);
  if(previous){if(previous.question!==message||previous.kind!==kind||previous.parameters!==serializedParameters||(input.conversationId&&input.conversationId!==previous.conversation_id))fail('Ese identificador ya pertenece a otra solicitud.',409);return {jobId:id,conversationId:previous.conversation_id,status:previous.status};}
  const conversationId=input.conversationId||uuid();
  if(input.conversationId)await ownedConversation(userId,conversationId);
  else{
   const count=await one('SELECT count(*) AS total FROM cloud_conversations WHERE user_id=?',userId);
   if(count.total>=1000)fail('Se alcanzó el límite de conversaciones guardadas.',409);
   await statement('INSERT OR IGNORE INTO cloud_conversations(id,user_id,title,created_at,updated_at) VALUES(?,?,?,?,?)',conversationId,userId,safeTitle(message),at,at).run();
   await ownedConversation(userId,conversationId);
  }
  const messageCount=await one('SELECT count(*) AS total FROM cloud_messages WHERE conversation_id=?',conversationId);
  if(messageCount.total>=MAX_MESSAGES-1)fail('Esta conversación alcanzó 1000 mensajes. Abre una nueva.',409);
  await db.batch([
   statement(`INSERT OR IGNORE INTO cloud_jobs(id,user_id,request_id,conversation_id,question,internet,kind,parameters,status,attempts,created_at,updated_at)
    SELECT ?,?,?,?,?,?,?,?,'queued',0,?,? WHERE
    (SELECT count(*) FROM cloud_jobs WHERE user_id=? AND created_at>=?)<20 AND
    (SELECT count(*) FROM cloud_jobs WHERE status IN ${active})<30 AND
    NOT EXISTS(SELECT 1 FROM cloud_jobs WHERE conversation_id=? AND status IN ${active})`,id,userId,input.requestId,conversationId,message,input.internet===true?1:0,kind,serializedParameters,at,at,userId,at-3600000,conversationId),
   statement(`INSERT OR IGNORE INTO cloud_messages(id,conversation_id,role,content,created_at)
    SELECT ?,?,'user',?,? WHERE EXISTS(SELECT 1 FROM cloud_jobs WHERE id=? AND user_id=?)`,id+'-user',conversationId,message,at,id,userId),
   statement('UPDATE cloud_conversations SET updated_at=? WHERE id=? AND user_id=? AND EXISTS(SELECT 1 FROM cloud_jobs WHERE id=?)',at,conversationId,userId,id),
  ]);
  const saved=await one('SELECT id,status,question,conversation_id FROM cloud_jobs WHERE id=? AND user_id=?',id,userId);
  if(!saved){
   const running=await one(`SELECT id FROM cloud_jobs WHERE conversation_id=? AND status IN ${active} LIMIT 1`,conversationId);
   if(running)fail('Esta conversación ya tiene una respuesta pendiente.',409);
   fail('Se alcanzó el límite de solicitudes. Prueba más tarde.',429);
  }
  if(saved.question!==message||saved.conversation_id!==conversationId)fail('Ese identificador ya pertenece a otra solicitud.',409);
  return {jobId:id,conversationId,status:saved.status};
 }
 async function status(){
  const row=await one('SELECT model_name,last_seen,capabilities FROM cloud_bridge ORDER BY last_seen DESC LIMIT 1');
  let capabilities={};try{capabilities=JSON.parse(row?.capabilities||'{}');}catch{}
  return {online:!!row&&now()-row.last_seen<45000,modelName:row?.model_name||'Qwen local',lastSeen:row?new Date(row.last_seen).toISOString():null,capabilities,sessionRequired:true,inference:'GPU del PC del propietario; no alojada en GitHub'};
 }
 async function conversations(userId){
  const rows=await all('SELECT id,title,updated_at FROM cloud_conversations WHERE user_id=? ORDER BY updated_at DESC,id LIMIT 100',userId);
  return {conversations:rows.map(row=>({id:row.id,title:row.title,updatedAt:new Date(row.updated_at).toISOString()}))};
 }
 async function conversation(userId,id){
  const row=await ownedConversation(userId,id);
  const messages=await all('SELECT id,role,content,created_at FROM cloud_messages WHERE conversation_id=? ORDER BY rowid LIMIT 1000',id);
  const pending=await one(`SELECT id,status FROM cloud_jobs WHERE conversation_id=? AND user_id=? AND status IN ${active} ORDER BY created_at DESC LIMIT 1`,id,userId);
  return {conversation:{id:row.id,title:row.title,updatedAt:new Date(row.updated_at).toISOString()},messages:messages.map(message=>({id:message.id,role:message.role,content:message.content,createdAt:new Date(message.created_at).toISOString()})),...(pending?{pendingJob:pending}:{})};
 }
 async function conversationExecutionEvents(userId,id){
  await ownedConversation(userId,id);
  const rows=await all('SELECT id,kind,status,stage,created_at,updated_at,result FROM cloud_jobs WHERE conversation_id=? AND user_id=? ORDER BY created_at DESC,id DESC LIMIT 30',id,userId);
  return {events:rows.reverse().map(row=>{
   let result=null;
   if(row.status==='completed'&&row.result){try{result=JSON.parse(row.result);}catch{}}
   return {id:row.id,kind:row.kind||'chat',status:row.status,stage:row.stage||null,createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString(),
    checks:Object.freeze({answerStored:typeof result?.answer==='string'&&result.answer.length>0,modelReported:typeof result?.model==='string'?result.model:null}),audit:result?.liaExecutionAudit||null,hypotheses:result?.liaHypotheses||[],transitionJournal:result?.liaTransitionJournal||[],
    evidence:'cloud_jobs',verifiedExecution:row.status==='completed',hypothesis:null,revision:null};
  })};
 }
 async function getJob(userId,id){return publicJob(await ownedJob(userId,id));}
 async function cancel(userId,id){
  await ownedJob(userId,id);
  await statement(`UPDATE cloud_jobs SET status='cancelled',lease_token=NULL,lease_until=0,updated_at=? WHERE id=? AND user_id=? AND status IN ${active}`,now(),id,userId).run();
  return publicJob(await ownedJob(userId,id));
 }
 async function heartbeat(input){
  if(!safeAgent(input?.agentId))fail('Agente no válido.');
  const modelName=typeof input.modelName==='string'?input.modelName.trim().slice(0,120):'Qwen local';
  const c=input.capabilities||{},video=c.video||{},capabilities={worlds:true,localRoles:['Arquitecto Qwen','Revisor Qwen'],independentModels:0,video:{ready:video.ready===true,openfieldInstalled:video.openfieldInstalled===true,nativeOpenfieldReady:video.nativeOpenfieldReady===true,provider:'wan21-comfy',downloadedBytes:Number.isSafeInteger(video.downloadedBytes)?Math.max(0,Math.min(100000000000,video.downloadedBytes)):0,totalBytes:Number.isSafeInteger(video.totalBytes)?Math.max(0,Math.min(100000000000,video.totalBytes)):0},gpuMode:['video','training'].includes(c.gpuMode)?c.gpuMode:'chat'};
  capabilities.processTelemetry=sanitizeProcessTelemetry(c.processTelemetry);
  await statement('INSERT INTO cloud_bridge(id,model_name,last_seen,capabilities) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET model_name=excluded.model_name,last_seen=excluded.last_seen,capabilities=excluded.capabilities',input.agentId,modelName||'Qwen local',now(),JSON.stringify(capabilities)).run();
  if(input.jobId&&input.leaseToken){
   const row=await one("SELECT status,lease_token,created_at,attempts FROM cloud_jobs WHERE id=?",input.jobId);
   if(!row||row.status!=='running'||row.lease_token!==input.leaseToken)return {ok:true,continue:false};
   const progress=Number.isFinite(input.progress)?Math.max(0,Math.min(99,Math.floor(input.progress))):0;
   const stage=['architect','critic','repair','revision','video','sampling','encoding','restoring','queued'].includes(input.stage)?input.stage:null;
   await statement("UPDATE cloud_jobs SET lease_until=?,updated_at=?,progress=MAX(progress,?),stage=COALESCE(?,stage) WHERE id=? AND lease_token=? AND status='running'",now()+LEASE_MS,now(),progress,stage,input.jobId,input.leaseToken).run();
  }
  const waiting=await one("SELECT count(*) AS total FROM cloud_jobs WHERE status='queued'");
  return {ok:true,continue:true,queuedCount:Math.min(30,Number(waiting?.total)||0)};
 }
 async function claim(input){
  await heartbeat(input);const at=now(),leaseToken=uuid();
  await statement("UPDATE cloud_jobs SET status='failed',error='El motor local no pudo terminar tras dos intentos.',lease_token=NULL,lease_until=0,updated_at=? WHERE status='running' AND lease_until<? AND attempts>=2",at,at).run();
  const row=await statement(`UPDATE cloud_jobs SET status='running',lease_token=?,lease_until=?,agent_id=?,attempts=attempts+1,updated_at=?
   WHERE id=(SELECT id FROM cloud_jobs WHERE (status='queued' OR (status='running' AND lease_until<?)) AND attempts<2 ORDER BY created_at,id LIMIT 1)
   AND (status='queued' OR (status='running' AND lease_until<?)) RETURNING id,conversation_id,question,internet,kind,parameters`,leaseToken,at+LEASE_MS,input.agentId,at,at,at).first();
  if(!row)return {job:null};
  const messages=await all('SELECT role,content FROM cloud_messages WHERE conversation_id=? ORDER BY rowid DESC LIMIT 15',row.conversation_id);
  let transport=contextWindow(messages);
  if(typeof enrichMessages==='function'&&row.kind==='chat')try{const enriched=await enrichMessages(structuredClone(transport),{kind:row.kind,internet:row.internet===1});if(Array.isArray(enriched)&&enriched.length===transport.length&&enriched.every((item,i)=>item?.role===transport[i].role&&typeof item.content==='string'&&(i===transport.length-1?item.content.startsWith(transport[i].content):item.content===transport[i].content)&&item.content.length<=(item.role==='user'?6000:16000))&&enriched.reduce((n,item)=>n+item.content.length,0)<=10000)transport=enriched.map(({role,content})=>({role,content}));}catch{}
  const reservation=await one('SELECT status,lease_token FROM cloud_jobs WHERE id=?',row.id);
  if(reservation?.status!=='running'||reservation.lease_token!==leaseToken)return {job:null};
  return {job:{id:row.id,conversationId:row.conversation_id,messages:transport,kind:row.kind,parameters:JSON.parse(row.parameters||'{}'),internet:row.internet===1,leaseToken}};
 }
 async function complete(input){
  if(typeof input?.jobId!=='string'||!validId(input.leaseToken))fail('Resultado sin reserva válida.');
  const result=input.result;
  if(!result||typeof result.answer!=='string'||!result.answer.trim()||result.answer.length>16000||!['atlas-local','atlas-coordinator'].includes(result.model))fail('El resultado local no es válido.');
  const value={answer:result.answer,model:result.model,modelName:typeof result.modelName==='string'?result.modelName.slice(0,120):'Qwen local'};
  if(result.liaExecutionAudit?.schema===1&&result.liaExecutionAudit.source==='local-chat-result'){
   const audit=result.liaExecutionAudit;
   value.liaExecutionAudit={schema:1,source:'local-chat-result',review:['completed','failed','not-recorded'].includes(audit.review)?audit.review:'not-recorded',reviewAttempted:audit.reviewAttempted===true,citationAuditRecorded:audit.citationAuditRecorded===true,unknownCitationLabels:Array.isArray(audit.unknownCitationLabels)?audit.unknownCitationLabels.filter(x=>typeof x==='string').slice(0,12).map(x=>x.slice(0,100)):[],sourcesReturned:Number.isInteger(audit.sourcesReturned)&&audit.sourcesReturned>=0?Math.min(audit.sourcesReturned,100):null,webRead:audit.webRead===true,hypothesis:'not-recorded',revision:audit.review==='completed'?'answer-revised-without-diff':'not-recorded',factualAccuracyVerified:false};
  }
  if(Array.isArray(result.liaHypotheses))value.liaHypotheses=buildLiaHypothesisLedger(result.liaHypotheses);
  if(Array.isArray(result.liaTransitionJournal)){
   const hypotheses=new Map((value.liaHypotheses||[]).map(h=>[h.id,h]));
   if(!await verifyLiaJournalInCloud(result.liaTransitionJournal,hypotheses))fail('La cadena de auditoría no supera la verificación.');
   value.liaTransitionJournal=result.liaTransitionJournal.map(item=>({...item,integrityVerifiedInCloud:true}));
  }
  const at=now();
  const row=await one('SELECT conversation_id,user_id,question,kind,status,lease_token,lease_until,result FROM cloud_jobs WHERE id=?',input.jobId);
  if(!row||row.lease_token!==input.leaseToken)fail('La reserva de la respuesta ha caducado.',409);
  if(row.status==='completed')return {ok:true,status:'completed'};
  if(row.status!=='running')fail('La solicitud ya no admite resultados.',409);
  if(row.lease_until<at)fail('La reserva de la respuesta ha caducado.',409);
  const extra=[];
  if(row.kind==='lor'){
   const lor=sanitizeProcessTelemetry({lor:result.lor})?.lor;if(result.lor?.synthetic!==true||!lor||![lor.baseline,lor.score,lor.delta,lor.negativeControlDelta].every(Number.isFinite))fail('El experimento LOR no produjo métricas válidas.');
   value.lor=lor;value.answer=`Ensayo sintético LOR-ΩΣ ejecutado en CPU: ${lor.verdict}. Precisión base ${lor.baseline}; con rasgos LOR ${lor.score}; diferencia ${lor.delta}. El resultado se conserva sin cambiar los pesos de Qwen. Es geometría de datos, no una demostración física.`;
  }
  if(['world','game'].includes(row.kind)){
   const mode=row.kind==='game'?'game':'3d';let plan;
   try{plan=validateCreativePlan(result.creative?.plan,mode);}catch{fail('El diseño no superó la validación geométrica.');}
   if(typeof compileCreative!=='function')fail('El compilador 3D no está disponible.',503);
   const generated=compileCreative(row.question,mode,{plan});
   const h=input.jobId.slice(4),projectId=`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
   const date=new Date(at).toISOString(),content=JSON.stringify({brief:generated.brief,code:generated.code});
   value.answer=`He creado ${mode==='game'?'un prototipo 3D jugable':'un entorno 3D'} con un plan de Qwen validado y geometría procedural. [Abrir en el taller](/taller?project=${projectId}). Puedes recorrerlo, modificarlo y exportar sus archivos. La revisión es otra pasada del mismo Qwen; no acredita calidad AAA.`;
   value.creative={projectId,plan,review:{roles:['Arquitecto Qwen','Revisor Qwen'],independentModels:false,geometryValidated:true}};
   extra.push(statement(`INSERT OR IGNORE INTO studio_projects(id,user_id,title,mode,revision,created_at,updated_at) SELECT ?,user_id,?,?,1,?,? FROM cloud_jobs WHERE id=? AND lease_token=? AND status='running' AND lease_until>=?`,projectId,plan.title,mode,date,date,input.jobId,input.leaseToken,at),statement(`INSERT OR IGNORE INTO studio_versions(id,project_id,version,content,created_at) SELECT ?,?,1,?,? FROM cloud_jobs WHERE id=? AND lease_token=? AND status='running' AND lease_until>=?`,projectId+'-v1',projectId,content,date,input.jobId,input.leaseToken,at));
  }
  if(row.kind==='video'){
   if(result.video?.artifactId!==input.jobId)fail('El vídeo no pertenece a esta solicitud.');
   value.video={artifactId:input.jobId,url:'/api/cloud/artifacts/'+input.jobId,provider:'Wan 2.1 · ComfyUI local'};
   value.answer='El vídeo generado en la GPU está listo. [Abrir vídeo]('+value.video.url+').';
  }
  const serialized=JSON.stringify(value);
  await db.batch([
   ...extra,
   statement(`INSERT OR IGNORE INTO cloud_messages(id,conversation_id,role,content,created_at)
    SELECT ?,conversation_id,'assistant',?,? FROM cloud_jobs WHERE id=? AND lease_token=? AND status='running' AND lease_until>=?`,input.jobId+'-assistant',value.answer,at,input.jobId,input.leaseToken,at),
   statement("UPDATE cloud_jobs SET status='completed',result=?,lease_until=0,progress=100,stage='completed',updated_at=? WHERE id=? AND lease_token=? AND status='running' AND lease_until>=?",serialized,at,input.jobId,input.leaseToken,at),
   statement("UPDATE cloud_conversations SET updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM cloud_jobs WHERE id=? AND lease_token=? AND status='completed')",at,row.conversation_id,input.jobId,input.leaseToken),
  ]);
  const saved=await one('SELECT status,lease_token FROM cloud_jobs WHERE id=?',input.jobId);
  if(saved.status!=='completed'||saved.lease_token!==input.leaseToken)fail('La reserva cambió antes de guardar la respuesta.',409);
  return {ok:true,status:'completed'};
 }
 async function failJob(input){
  if(typeof input?.jobId!=='string'||!validId(input.leaseToken))fail('Resultado sin reserva válida.');
  const row=await one('SELECT status,lease_token FROM cloud_jobs WHERE id=?',input.jobId);
  if(!row||row.status!=='running'||row.lease_token!==input.leaseToken)fail('La reserva de la respuesta ha caducado.',409);
  await statement("UPDATE cloud_jobs SET status='failed',error='El motor local no pudo completar la respuesta. Puedes intentarlo de nuevo.',lease_until=0,updated_at=? WHERE id=? AND lease_token=? AND status='running'",now(),input.jobId,input.leaseToken).run();
  return {ok:true,status:'failed'};
 }
 async function observeResidentEvents(telemetry){
  const events=buildResidentMemoryEvents(telemetry,{now:now()});
  if(!events.length)return {observed:0};
  // One read avoids twelve no-op writes on every ten-second house poll.
  const existing=await all('SELECT event_key FROM resident_memories WHERE event_key IN ('+events.map(()=>'?').join(',')+')',...events.map(event=>event.eventKey));
  const seen=new Set(existing.map(row=>row.event_key));
  const fresh=events.filter(event=>!seen.has(event.eventKey));
  if(!fresh.length)return {observed:0};
  await statement('DELETE FROM resident_memories WHERE created_at<?',now()-RESIDENT_MEMORY_RETENTION_MS).run();
  let written=0;
  for(const event of fresh){
   const result=await statement('INSERT OR IGNORE INTO resident_memories(id,resident_id,process_id,state,phase,event_key,text,at,created_at) VALUES(?,?,?,?,?,?,?,?,?)',event.id,event.residentId,event.processId,event.state,event.phase,event.eventKey,event.text,event.at,now()).run();
   written+=Number(result?.meta?.changes)||0;
  }
  return {observed:written};
 }
 async function residentMemories(residentId){
  if(!isResidentId(residentId))fail('Habitante no válido.',404);
  const rows=await all('SELECT id,process_id,state,phase,text,at,created_at FROM resident_memories WHERE resident_id=? ORDER BY created_at DESC,id LIMIT ?',residentId,RESIDENT_MEMORY_LIMIT);
  return {residentId,memories:rows.map(row=>({id:row.id,processId:row.process_id,state:row.state,phase:row.phase||null,text:row.text,at:row.at,observedAt:new Date(row.created_at).toISOString()}))};
 }
 return {enqueue,status,conversations,conversation,conversationExecutionEvents,getJob,cancel,heartbeat,claim,complete,fail:failJob,observeResidentEvents,residentMemories};
}
