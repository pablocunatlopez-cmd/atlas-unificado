import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCloudQueue} from './queue.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
function fixture(t,options={}){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 for(const file of fs.readdirSync(path.join(root,'drizzle')).filter(name=>name.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));
 const adapter={prepare(sql){let params=[];const item={bind(...values){params=values;return item;},async first(){return sqlite.prepare(sql).get(...params)||null;},async all(){return {results:sqlite.prepare(sql).all(...params)};},async run(){return {meta:sqlite.prepare(sql).run(...params)};},execute(){return sqlite.prepare(sql).run(...params);}};return item;},async batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(statement=>statement.execute());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
 let at=1793470000000;const queue=createCloudQueue(adapter,{...options,now:()=>at});
 return {queue,sqlite,advance(ms){at+=ms;},now:()=>at};
}
const next=(message='Hola Atlas',extra={})=>({message,requestId:crypto.randomUUID(),...extra});
const bridge={agentId:'atlas-pc',modelName:'Qwen3.5 local GPU'};
const result={answer:'Respuesta local comprobada.',model:'atlas-local',modelName:'Qwen local'};
test('live learning summaries survive heartbeat storage while private tool details stay on the PC',async t=>{
 const {queue,advance,now}=fixture(t),at=new Date(now()).toISOString();
 await queue.heartbeat({...bridge,capabilities:{processTelemetry:{at,learning:{reviewEnabled:true,paused:false,running:true,lastCycleAt:at,nextRun:at,pendingTask:{taskId:'json-pointer-resolve',name:'private task'},tools:[{taskId:'dag-dependency-plan',name:'private name',cases:8,passed:8,createdAt:at,source:'private code',prompt:'private prompt'}],approvedTools:999,token:'private key'}}}});
 const live=await queue.status(),learning=live.capabilities.processTelemetry.learning;
 assert.equal(live.online,true);assert.equal(learning.approvedTools,1);assert.equal(learning.tools[0].name,'Planificar dependencias de proyectos');assert.equal(learning.pendingTask.name,'Resolver referencias JSON Pointer');assert.equal(learning.running,true);assert.doesNotMatch(JSON.stringify(learning),/private|999/);
 advance(46000);assert.equal((await queue.status()).online,false);
});
test('actual migrations support isolated conversations, atomic claim and exactly-once completion',async t=>{
 const {queue}=fixture(t);const input=next('El motor se llama Zafiro.');const accepted=await queue.enqueue('pablo',input);
 assert.equal(accepted.status,'queued');await assert.rejects(queue.getJob('otro',accepted.jobId),error=>error.status===404);await assert.rejects(queue.conversation('otro',accepted.conversationId),error=>error.status===404);
 const claims=await Promise.all([queue.claim(bridge),queue.claim(bridge)]);const owned=claims.filter(value=>value.job);assert.equal(owned.length,1);const job=owned[0].job;
 assert.deepEqual(job.messages,[{role:'user',content:input.message}]);assert.equal(job.internet,false);assert.equal((await queue.status()).online,true);
 const publicStatus=await queue.getJob('pablo',job.id);assert.equal(publicStatus.leaseToken,undefined);assert.equal(publicStatus.lease_token,undefined);assert.equal(publicStatus.user_id,undefined);
 await queue.complete({jobId:job.id,leaseToken:job.leaseToken,result});await queue.complete({jobId:job.id,leaseToken:job.leaseToken,result});
 const history=await queue.conversation('pablo',accepted.conversationId);assert.equal(history.messages.length,2);assert.equal(history.messages[1].content,result.answer);assert.equal(history.pendingJob,undefined);
 assert.equal((await queue.enqueue('pablo',input)).status,'completed');await assert.rejects(queue.enqueue('pablo',{...input,message:'Pregunta diferente'}),error=>error.status===409);assert.equal((await queue.conversations('otro')).conversations.length,0);
});
test('only one pending turn per conversation, cancellation invalidates the lease',async t=>{
 const {queue}=fixture(t);const accepted=await queue.enqueue('pablo',next());await assert.rejects(queue.enqueue('pablo',next('Otra pregunta',{conversationId:accepted.conversationId})),error=>error.status===409);
 const {job}=await queue.claim(bridge);assert.equal((await queue.conversation('pablo',accepted.conversationId)).pendingJob.id,job.id);
 await assert.rejects(queue.cancel('otro',job.id),error=>error.status===404);assert.equal((await queue.cancel('pablo',job.id)).status,'cancelled');
 assert.equal((await queue.heartbeat({...bridge,jobId:job.id,leaseToken:job.leaseToken})).continue,false);await assert.rejects(queue.complete({jobId:job.id,leaseToken:job.leaseToken,result}),error=>error.status===409);
 assert.equal((await queue.conversation('pablo',accepted.conversationId)).messages.length,1);assert.equal((await queue.cancel('pablo',job.id)).status,'cancelled');
});
test('leases expire, one retry changes ownership, and a second lost attempt fails visibly',async t=>{
 const {queue,advance}=fixture(t);const accepted=await queue.enqueue('pablo',next());const first=(await queue.claim(bridge)).job;
 advance(300001);await assert.rejects(queue.complete({jobId:first.id,leaseToken:first.leaseToken,result}),error=>error.status===409);
 const second=(await queue.claim(bridge)).job;assert.equal(second.id,first.id);assert.notEqual(second.leaseToken,first.leaseToken);
 await assert.rejects(queue.complete({jobId:first.id,leaseToken:first.leaseToken,result}),error=>error.status===409);
 advance(300001);assert.equal((await queue.claim(bridge)).job,null);assert.equal((await queue.getJob('pablo',accepted.jobId)).status,'failed');
});
test('database gates enforce per-user hourly and global queue limits',async t=>{
 const {queue,advance}=fixture(t);for(let i=0;i<20;i++)await queue.enqueue('pablo',next('Pregunta '+i));
 await assert.rejects(queue.enqueue('pablo',next('21')),error=>error.status===429);
 for(let i=0;i<10;i++)await queue.enqueue('otro',next('Pregunta '+i));await assert.rejects(queue.enqueue('tercero',next()),error=>error.status===429);
 const {job}=await queue.claim(bridge);await queue.complete({jobId:job.id,leaseToken:job.leaseToken,result});await assert.rejects(queue.enqueue('pablo',next('Todavía limitado')),error=>error.status===429);
 advance(3600001);assert.equal((await queue.enqueue('pablo',next('Nueva hora'))).status,'queued');
});
test('context is bounded to current user conversation and result cannot smuggle credentials',async t=>{
 const {queue,sqlite,now}=fixture(t);const accepted=await queue.enqueue('pablo',next('Última pregunta'));await queue.cancel('pablo',accepted.jobId);
 for(let i=0;i<20;i++)sqlite.prepare('INSERT INTO cloud_messages(id,conversation_id,role,content,created_at) VALUES(?,?,?,?,?)').run('old-'+i,accepted.conversationId,i%2?'assistant':'user','x'.repeat(2000),now());
 const pending=await queue.enqueue('pablo',next('Pregunta actual',{conversationId:accepted.conversationId,internet:true}));const {job}=await queue.claim(bridge);
 assert.equal(job.id,pending.jobId);assert.equal(job.messages.at(-1).content,'Pregunta actual');assert.ok(job.messages.length<=15);assert.ok(job.messages.reduce((sum,message)=>sum+message.content.length,0)<=10000);assert.equal(job.internet,true);
 await assert.rejects(queue.complete({jobId:job.id,leaseToken:job.leaseToken,result:{...result,model:'fabricated-provider'}}));await assert.rejects(queue.complete({jobId:job.id,leaseToken:job.leaseToken,result:{...result,answer:'x'.repeat(16001)}}));
 await queue.complete({jobId:job.id,leaseToken:job.leaseToken,result:{...result,secret:'private-value',sources:['private-memory']}});const response=await queue.getJob('pablo',job.id);assert.equal(response.result.secret,undefined);assert.equal(response.result.sources,undefined);
});
test('errors are generic and bridge liveness never exposes authentication material',async t=>{
 const {queue,advance}=fixture(t);assert.equal((await queue.status()).online,false);await queue.heartbeat(bridge);assert.equal((await queue.status()).online,true);advance(45001);assert.equal((await queue.status()).online,false);
 const accepted=await queue.enqueue('pablo',next());const {job}=await queue.claim(bridge);await queue.fail({jobId:job.id,leaseToken:job.leaseToken,error:'sk-private-secret and C:/private/file'});
 const response=await queue.getJob('pablo',accepted.jobId);assert.equal(response.status,'failed');assert.doesNotMatch(JSON.stringify(response),/sk-private|C:\//);await assert.rejects(queue.claim({agentId:'../../bad'}));
});
const creativePlan=(kind='world')=>({title:'  Jardín de pruebas  ',variant:kind==='game'?'exploration':'forest',lighting:'sunset',palette:'Verde',objects:[{type:'box',position:[5,1,0],size:[1,1,1],material:4}],design:'Un recorrido legible.',code:'never execute',secret:'private-plan-value'});
function compiler(calls){return (prompt,mode,options)=>{calls.push({prompt,mode,options});return {brief:{title:options.plan.title,mode},code:'<!doctype html><title>'+options.plan.title+'</title>',secret:'compiler-private'};};}
test('world and game completion atomically create one owned project/version and one assistant turn',async t=>{
 for(const kind of ['world','game'])await t.test(kind,async t=>{
  const calls=[],{queue,sqlite}=fixture(t,{compileCreative:compiler(calls)}),input=next('Crea un jardín transitable',{kind});
  const accepted=await queue.enqueue('pablo',input),{job}=await queue.claim(bridge);
  assert.equal(job.kind,kind);assert.deepEqual(job.parameters,{});
  const completion={jobId:job.id,leaseToken:job.leaseToken,result:{...result,creative:{plan:creativePlan(kind),code:'untrusted code',review:{independentModels:true}},secret:'private-result'}};
  await Promise.all([queue.complete(completion),queue.complete(completion)]);
  const response=await queue.getJob('pablo',job.id),projectId=response.result.creative.projectId;
  const projects=sqlite.prepare('SELECT * FROM studio_projects').all(),versions=sqlite.prepare('SELECT * FROM studio_versions').all();
  assert.equal(projects.length,1);assert.equal(versions.length,1);assert.equal(projects[0].id,projectId);assert.equal(projects[0].user_id,'pablo');assert.equal(projects[0].mode,kind==='game'?'game':'3d');assert.equal(projects[0].revision,1);assert.equal(projects[0].title,'Jardín de pruebas');
  assert.equal(versions[0].project_id,projectId);assert.equal(versions[0].version,1);assert.deepEqual(JSON.parse(versions[0].content),{brief:{title:'Jardín de pruebas',mode:kind==='game'?'game':'3d'},code:'<!doctype html><title>Jardín de pruebas</title>'});
  assert.ok(calls.length>=1);for(const call of calls){assert.equal(call.prompt,input.message);assert.equal(call.mode,projects[0].mode);assert.equal(call.options.plan.code,undefined);assert.equal(call.options.plan.secret,undefined);}
  assert.equal(response.progress,100);assert.equal(response.stage,'completed');assert.equal(response.result.creative.review.independentModels,false);assert.equal(response.result.creative.review.geometryValidated,true);assert.equal(response.result.creative.plan.objects[0].tag,kind==='game'?'obstacle':undefined);
  assert.doesNotMatch(JSON.stringify(response),/untrusted code|private-result|private-plan-value|compiler-private/);
  const messages=(await queue.conversation('pablo',accepted.conversationId)).messages;assert.equal(messages.length,2);assert.match(messages[1].content,new RegExp('/taller\\?project='+projectId));
  const callsBefore=calls.length;await queue.complete(completion);assert.equal(calls.length,callsBefore);assert.equal((await queue.enqueue('pablo',input)).status,'completed');
  await assert.rejects(queue.getJob('otro',job.id),error=>error.status===404);
 });
});
test('a failed version insert rolls back project, assistant message and completion so the same lease can retry',async t=>{
 const calls=[],{queue,sqlite}=fixture(t,{compileCreative:compiler(calls)}),accepted=await queue.enqueue('pablo',next('Jardín',{kind:'world'})),{job}=await queue.claim(bridge);
 sqlite.exec("CREATE TRIGGER version_storage_failure BEFORE INSERT ON studio_versions BEGIN SELECT RAISE(ABORT,'storage failure'); END");
 const completion={jobId:job.id,leaseToken:job.leaseToken,result:{...result,creative:{plan:creativePlan()}}};
 await assert.rejects(queue.complete(completion),/storage failure/);
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM studio_projects').get().n,0);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM studio_versions').get().n,0);assert.equal((await queue.getJob('pablo',job.id)).status,'running');assert.equal((await queue.conversation('pablo',accepted.conversationId)).messages.length,1);
 sqlite.exec('DROP TRIGGER version_storage_failure');await queue.complete(completion);assert.equal((await queue.getJob('pablo',job.id)).status,'completed');assert.equal(sqlite.prepare('SELECT count(*) AS n FROM studio_versions').get().n,1);
});
test('creative plans are validated before compiling or writing and stay retryable on invalid output',async t=>{
 const calls=[],{queue,sqlite}=fixture(t,{compileCreative:compiler(calls)});await queue.enqueue('pablo',next('Una escena',{kind:'world'}));const {job}=await queue.claim(bridge);
 for(const plan of [undefined,{...creativePlan(),variant:'exploration'},{...creativePlan(),objects:[{type:'box',position:[0,1,0],size:[999,1,1],material:0}]}])await assert.rejects(queue.complete({jobId:job.id,leaseToken:job.leaseToken,result:{...result,creative:{plan}}}),error=>error.status===400&&/geométrica/.test(error.message));
 assert.equal(calls.length,0);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM studio_projects').get().n,0);assert.equal((await queue.getJob('pablo',job.id)).status,'running');
 await queue.complete({jobId:job.id,leaseToken:job.leaseToken,result:{...result,creative:{plan:creativePlan()}}});assert.equal(calls.length,1);
 const unavailable=fixture(t);await unavailable.queue.enqueue('pablo',next('Otra escena',{kind:'world'}));const missing=(await unavailable.queue.claim(bridge)).job;await assert.rejects(unavailable.queue.complete({jobId:missing.id,leaseToken:missing.leaseToken,result:{...result,creative:{plan:creativePlan()}}}),error=>error.status===503);
});
test('video parameters are bounded, request ids bind parameters and completed artifacts bind exactly to the job',async t=>{
 const {queue,sqlite}=fixture(t);
 for(const parameters of [{frames:18},{steps:4},{steps:31},{steps:5.5}])await assert.rejects(queue.enqueue('pablo',next('Vídeo',{kind:'video',parameters})),error=>error.status===400);
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM cloud_jobs').get().n,0);
 const input=next('Un amanecer',{kind:'video',parameters:{frames:33,steps:8,width:99999,path:'C:/private'}}),accepted=await queue.enqueue('pablo',input),{job}=await queue.claim(bridge);
 assert.equal(job.kind,'video');assert.deepEqual(job.parameters,{frames:33,steps:8,fps:8,width:480,height:272});
 await assert.rejects(queue.enqueue('pablo',{...input,parameters:{frames:49,steps:8}}),error=>error.status===409);await assert.rejects(queue.enqueue('pablo',{...input,kind:'chat'}),error=>error.status===409);
 for(const video of [undefined,{artifactId:'job-'+'a'.repeat(64)},{artifactId:job.id+'?download=secret'}])await assert.rejects(queue.complete({jobId:job.id,leaseToken:job.leaseToken,result:{...result,video}}),error=>error.status===400);
 assert.equal((await queue.getJob('pablo',job.id)).status,'running');
 const completion={jobId:job.id,leaseToken:job.leaseToken,result:{...result,video:{artifactId:job.id,url:'https://untrusted.invalid/private',path:'C:/private',provider:'fabricated'}}};await queue.complete(completion);await queue.complete(completion);
 const saved=await queue.getJob('pablo',accepted.jobId);assert.deepEqual(saved.result.video,{artifactId:job.id,url:'/api/cloud/artifacts/'+job.id,provider:'Wan 2.1 · ComfyUI local'});assert.doesNotMatch(JSON.stringify(saved),/untrusted|C:\/private|fabricated/);assert.equal((await queue.conversation('pablo',accepted.conversationId)).messages.length,2);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM studio_projects').get().n,0);
});
test('bridge capabilities use a public whitelist and progress is monotonic with bounded stages',async t=>{
 const {queue,sqlite}=fixture(t),secret='never-public';await queue.enqueue('pablo',next());const {job}=await queue.claim(bridge);
 await queue.heartbeat({...bridge,jobId:job.id,leaseToken:job.leaseToken,progress:38.9,stage:'architect',capabilities:{worlds:false,independentModels:99,localRoles:['secret-agent'],gpuMode:'video',secret,token:secret,path:'C:/private',video:{ready:true,openfieldInstalled:true,nativeOpenfieldReady:'true',provider:secret,downloadedBytes:500,totalBytes:999999999999,secret}}});
 const status=await queue.status();assert.deepEqual(status.capabilities,{worlds:true,localRoles:['Arquitecto Qwen','Revisor Qwen'],independentModels:0,video:{ready:true,openfieldInstalled:true,nativeOpenfieldReady:false,provider:'wan21-comfy',downloadedBytes:500,totalBytes:100000000000},gpuMode:'video',processTelemetry:null});assert.doesNotMatch(JSON.stringify(status),/never-public|secret-agent|C:\/private/);
 let saved=await queue.getJob('pablo',job.id);assert.equal(saved.progress,38);assert.equal(saved.stage,'architect');
 await queue.heartbeat({...bridge,jobId:job.id,leaseToken:job.leaseToken,progress:2,stage:'C:/private',capabilities:{video:{downloadedBytes:-3,totalBytes:NaN},gpuMode:'other'}});saved=await queue.getJob('pablo',job.id);assert.equal(saved.progress,38);assert.equal(saved.stage,'architect');
 assert.deepEqual((await queue.status()).capabilities.video,{ready:false,openfieldInstalled:false,nativeOpenfieldReady:false,provider:'wan21-comfy',downloadedBytes:0,totalBytes:0});
 await queue.heartbeat({...bridge,jobId:job.id,leaseToken:job.leaseToken,progress:999,stage:'encoding'});assert.equal((await queue.getJob('pablo',job.id)).progress,99);
 assert.doesNotMatch(sqlite.prepare('SELECT capabilities FROM cloud_bridge').get().capabilities,/never-public|C:\/private/);
});

test('LOR completion stores a measured refutation exactly once, strips private payload and keeps owner isolation',async t=>{
 const {queue,sqlite}=fixture(t),accepted=await queue.enqueue('pablo',next('Reproduce el ensayo LOR',{kind:'lor'})),{job}=await queue.claim(bridge);
 assert.equal(job.kind,'lor');assert.deepEqual(job.parameters,{});
 const measured={verdict:'REFUTED',baseline:2/3,score:.6,delta:.6-2/3,negativeControlDelta:0,synthetic:true};
 for(const lor of [undefined,{...measured,verdict:'NEW_PHYSICS'},{...measured,baseline:NaN},{...measured,score:Infinity},{...measured,delta:undefined},{...measured,negativeControlDelta:undefined},{...measured,synthetic:false}])await assert.rejects(queue.complete({jobId:job.id,leaseToken:job.leaseToken,result:{...result,lor}}),error=>error.status===400);
 assert.equal((await queue.getJob('pablo',job.id)).status,'running');assert.equal((await queue.conversation('pablo',accepted.conversationId)).messages.length,1);
 const completion={jobId:job.id,leaseToken:job.leaseToken,result:{...result,lor:{...measured,prompt:'private memory',token:'private-token',path:'C:/private',code:'do not execute'}}};
 await queue.complete(completion);await queue.complete(completion);
 const saved=await queue.getJob('pablo',job.id);assert.equal(saved.status,'completed');assert.deepEqual(saved.result.lor,measured);assert.match(saved.result.answer,/REFUTED/);assert.match(saved.result.answer,/sin cambiar los pesos/);assert.doesNotMatch(JSON.stringify(saved),/private memory|private-token|C:\/private|do not execute/);
 assert.equal((await queue.conversation('pablo',accepted.conversationId)).messages.length,2);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM studio_projects').get().n,0);await assert.rejects(queue.getJob('otro',job.id),error=>error.status===404);
});

test('process telemetry is independently whitelisted before persistence and cannot invent weight learning',async t=>{
 const {queue,sqlite}=fixture(t);await queue.heartbeat({...bridge,capabilities:{processTelemetry:{at:'2026-10-31T12:00:00Z',processes:[{id:'research',room:'private-room',label:'private prompt',state:'running',phase:'observe',counters:{observations:17,trials:NaN},token:'private-token'},{id:'unknown',state:'running'}],core:{generation:2,attempts:8,accepted:2,rejected:6,version:'candidate-2',qwenWeightsChanged:true,code:'private-code'},lor:{verdict:'REFUTED',baseline:.7,score:.6,delta:-.1,negativeControlDelta:0},path:'C:/private'}}});
 const status=await queue.status(),telemetry=status.capabilities.processTelemetry;
 assert.equal(telemetry.processes.length,1);assert.equal(telemetry.processes[0].label,'Observación de fuentes');assert.equal(telemetry.processes[0].room,'mind');assert.deepEqual(telemetry.processes[0].counters,{observations:17});assert.equal(telemetry.core.generation,2);assert.equal(telemetry.core.qwenWeightsChanged,false);assert.equal(telemetry.core.method,'StrategyPolicy');assert.equal(telemetry.lor.verdict,'REFUTED');
 assert.doesNotMatch(sqlite.prepare('SELECT capabilities FROM cloud_bridge').get().capabilities,/private-room|private prompt|private-token|private-code|C:\/private/);
});
