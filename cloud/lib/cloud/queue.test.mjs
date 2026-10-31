import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCloudQueue} from './queue.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
function fixture(t){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 for(const file of fs.readdirSync(path.join(root,'drizzle')).filter(name=>name.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));
 const adapter={prepare(sql){let params=[];const item={bind(...values){params=values;return item;},async first(){return sqlite.prepare(sql).get(...params)||null;},async all(){return {results:sqlite.prepare(sql).all(...params)};},async run(){return {meta:sqlite.prepare(sql).run(...params)};},execute(){return sqlite.prepare(sql).run(...params);}};return item;},async batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(statement=>statement.execute());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
 let at=1793470000000;const queue=createCloudQueue(adapter,{now:()=>at});
 return {queue,sqlite,advance(ms){at+=ms;},now:()=>at};
}
const next=(message='Hola Atlas',extra={})=>({message,requestId:crypto.randomUUID(),...extra});
const bridge={agentId:'atlas-pc',modelName:'Qwen3.5 local GPU'};
const result={answer:'Respuesta local comprobada.',model:'atlas-local',modelName:'Qwen local'};
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
