// Run with: node --experimental-vm-modules --experimental-strip-types tests/atlas-ai-creation.test.mts
// Exercise the production persistence/lease code and real creative validators.
// Only model inference and the model-evaluation registry are replaced at imports.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {stripTypeScriptTypes} from 'node:module';
import {readFile} from 'node:fs/promises';
import * as vm from 'node:vm';
import * as agents from '../lib/cloud/agents.ts';
import {coachingCases,gradeCoaching} from '../lib/evolution/coaching.ts';
import * as music from '../lib/music/composition.ts';
import * as cinema from '../lib/cinema/director.ts';
import type {AICreation,CreationKind} from '../lib/creation/server.ts';

type ReadHook=(sql:string,values:SQLInputValue[],row:Record<string,unknown>|undefined)=>Promise<void>|void;
class Statement {
 readonly db:DatabaseSync;readonly sql:string;readonly values:SQLInputValue[];readonly afterRead?:ReadHook;
 constructor(db:DatabaseSync,sql:string,values:SQLInputValue[]=[],afterRead?:ReadHook){this.db=db;this.sql=sql;this.values=values;this.afterRead=afterRead;}
 bind(...values:SQLInputValue[]){return new Statement(this.db,this.sql,values,this.afterRead);}
 async first(column?:string){const row=this.db.prepare(this.sql).get(...this.values);await this.afterRead?.(this.sql,this.values,row);return row?(column?row[column]:row):null;}
 async all(){return{results:this.db.prepare(this.sql).all(...this.values),success:true};}
 async run(){const result=this.db.prepare(this.sql).run(...this.values);return{success:true,meta:{changes:result.changes,last_row_id:result.lastInsertRowid}};}
}
class D1 {
 raw=new DatabaseSync(':memory:');afterRead?:ReadHook;
 prepare(sql:string){return new Statement(this.raw,sql,[],(query,values,row)=>this.afterRead?.(query,values,row));}
 close(){this.raw.close();}
}
function gate(){let release!:()=>void,signal!:()=>void;const entered=new Promise<void>(resolve=>signal=resolve),wait=new Promise<void>(resolve=>release=resolve);return{release,signal,entered,wait};}
type Gate=ReturnType<typeof gate>;
type Input={kind:CreationKind;prompt:string;requestId:string};
type Call={model:string;messages:Array<{role:string;content:string}>;options:Record<string,unknown>};
const plain=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));

function composition(){
 const section=(id:string,label:string,note:number)=>({id,label,bars:1,kick:[0,8],snare:[4,12],hat:[0,2,4,6,8,10,12,14],bass:Array.from({length:16},(_,i)=>i%4===0?48:null),melody:[[0,note,2,.45],[8,note+3,2,.4]],chords:[[0,[48,51,55],16,.16]]});
 return{version:1,title:'Pregunta y respuesta',style:'Jazz tranquilo con una variación melódica.',key:'Do menor',bpm:90,swing:.12,sections:[section('tema','Tema inicial',60),section('puente','Variación y regreso',62)],arrangement:['tema','puente','tema']};
}
function video(){return{version:1,title:'Una idea encuentra su ritmo',synopsis:'La cámara conecta una pregunta con la creación musical en la casa.',style:'Pausado y contemplativo',narration:'Una pregunta encuentra su forma.',shots:[{room:'mind',seconds:3,framing:'wide',movement:'still',description:'Presentar el archivo donde empieza la pregunta.',narration:'Una idea aparece.'},{room:'music',seconds:4,framing:'medium',movement:'push',description:'Acercarse al estudio para desarrollar el motivo.',narration:'La pregunta encuentra un ritmo.'}],seconds:7,captureRequired:true};}

async function fixture(){
 assert.equal(typeof vm.SourceTextModule,'function','Pass --experimental-vm-modules to exercise the Worker module.');
 const db=new D1(),clock={now:Date.parse('2026-11-15T10:00:00Z')};
 const calls={inferences:[] as Call[],reservations:[] as Record<string,unknown>[],responses:[] as unknown[],gates:new Map<number,Gate>(),registry:0};
 class ClockDate extends Date{constructor(value?:string|number){super(value===undefined?clock.now:value);}static now(){return clock.now;}}
 const context=vm.createContext({Date:ClockDate,crypto:globalThis.crypto,structuredClone,console,TextEncoder,TextDecoder,setTimeout,clearTimeout});
 const cases=coachingCases(1761),score=gradeCoaching(cases,{answers:cases.map(c=>({id:c.id,value:c.expected}))});
 const modules:Record<string,Record<string,unknown>>={
  'cloudflare:workers':{env:{DB:db}},'../cloud/agents':agents,'../music/composition':music,'../cinema/director':cinema,
  '../cloud/agent-registry':{agentEvaluations:async()=>{calls.registry++;return[{model:'openai/gpt-oss-120b',version:agents.AGENT_EVAL_VERSION,status:'qualified',at:new ClockDate().toISOString(),latencyMs:20,score}];}},
  '../cloud/inference':{inferModel:async(model:string,messages:Call['messages'],options:Call['options'])=>{
   const index=calls.inferences.length;calls.inferences.push({model,messages,options});
   calls.reservations.push(db.raw.prepare("SELECT id,request_id,status,lease_until FROM ai_creations WHERE status='generating'").get()!);
   const response=calls.responses.length?calls.responses.shift():composition(),barrier=calls.gates.get(index);
   if(barrier){barrier.signal();await barrier.wait;}
   if(response instanceof Error)throw response;
   return structuredClone(response);
  }}
 };
 const source=stripTypeScriptTypes(await readFile(new URL('../lib/creation/server.ts',import.meta.url),'utf8'),{mode:'strip'});
 const module=new vm.SourceTextModule(source,{context,identifier:'ai-creation-server.ts'}),linked=new Map<string,vm.Module>();
 await module.link(async(specifier:string)=>{
  if(linked.has(specifier))return linked.get(specifier)!;
  const exports=modules[specifier];assert.ok(exports,'Unexpected dependency: '+specifier);
  const keys=Object.keys(exports),dependency=new vm.SyntheticModule(keys,function(){for(const key of keys)this.setExport(key,exports[key]);},{context});linked.set(specifier,dependency);return dependency;
 });
 await module.evaluate();
 const api=module.namespace as unknown as {createAI:(userId:string,input:Input)=>Promise<AICreation>;listAICreations:(userId:string,kind?:CreationKind)=>Promise<AICreation[]>};
 const row=(userId:string,requestId:string)=>db.raw.prepare('SELECT * FROM ai_creations WHERE user_id=? AND request_id=?').get(userId,requestId)!;
 return{db,clock,calls,api,row};
}

test('validated model music is persisted and an identical request replays without a second inference',async t=>{
 const f=await fixture();t.after(()=>f.db.close());const input:Input={kind:'music',prompt:'Jazz tranquilo para Lía con un motivo que vuelva al final.',requestId:'music-replay'};
 const created=await f.api.createAI('alice',input),call=f.calls.inferences[0];
 assert.equal(created.origin,'model-generated');assert.equal(created.model,'openai/gpt-oss-120b');assert.equal(created.kind,'music');assert.equal(created.prompt,input.prompt);
 assert.deepEqual(plain(created.content),music.validateComposition(composition()));
 assert.equal(call.options.json,true);assert.ok(Number(call.options.maxTokens)>=3000);assert.match(call.messages.at(-1)!.content,/Jazz tranquilo para Lía/);
 assert.match(created.scope,/simbólica|síntesis|sintetizada/i);
 const stored=f.row('alice',input.requestId);assert.equal(stored.status,'completed');assert.equal(stored.lease_until,0);assert.deepEqual(JSON.parse(stored.content as string),plain(created));
 const replay=await f.api.createAI('alice',input);assert.deepEqual(plain(replay),plain(created));assert.equal(f.calls.inferences.length,1);assert.equal(f.calls.registry,1);
 assert.deepEqual(plain(await f.api.listAICreations('alice')),[plain(created)]);assert.deepEqual(plain(await f.api.listAICreations('bob')),[]);
});

test('request IDs and listing remain isolated between users, including real video validation',async t=>{
 const f=await fixture();t.after(()=>f.db.close());f.calls.responses.push(composition(),video());
 const alice=await f.api.createAI('alice',{kind:'music',prompt:'Un motivo de jazz privado de Alice.',requestId:'shared-request'});
 const bob=await f.api.createAI('bob',{kind:'video',prompt:'Conecta la mente con el estudio de música.',requestId:'shared-request'});
 assert.notEqual(alice.id,bob.id);assert.equal(bob.kind,'video');assert.deepEqual(plain(bob.content),cinema.validateVideoPlan(video()));assert.match(bob.scope,/escena 3D|navegador/);
 assert.deepEqual(plain(await f.api.listAICreations('alice')),[plain(alice)]);assert.deepEqual(plain(await f.api.listAICreations('bob')),[plain(bob)]);
 assert.doesNotMatch(JSON.stringify(await f.api.listAICreations('bob')),/privado de Alice/);assert.equal(f.calls.inferences.length,2);
 assert.equal(f.db.raw.prepare('SELECT count(*) AS n FROM ai_creations').get()!.n,2);
});

test('a reused ID with a different prompt or creation kind conflicts before model work',async t=>{
 const f=await fixture();t.after(()=>f.db.close());const input:Input={kind:'music',prompt:'Música tranquila con bajo y melodía.',requestId:'bound-to-input'};
 const first=await f.api.createAI('alice',input);
 await assert.rejects(f.api.createAI('alice',{...input,prompt:'Otro encargo distinto.'}),/CONFLICT/);
 await assert.rejects(f.api.createAI('alice',{...input,kind:'video'}),/CONFLICT/);
 assert.equal(f.calls.inferences.length,1);assert.equal(f.calls.registry,1);assert.deepEqual(plain(await f.api.listAICreations('alice')),[plain(first)]);
});

test('two initially missing requests cannot change the prompt after INSERT OR IGNORE loses a race',async()=>{
 const f=await fixture(),firstRead=gate(),secondRead=gate();let reads=0;
 // Both real SQLite SELECTs capture a missing row. Delay delivery of those
 // results, as two independent D1 transports can, without changing any SQL.
 f.db.afterRead=async(sql,values,row)=>{
  if(!sql.startsWith('SELECT status,content,lease_until,kind,prompt')||values[1]!=='insert-race')return;
  reads++;if(reads>2)return;assert.equal(row,undefined);
  const barrier=reads===1?firstRead:secondRead;barrier.signal();await barrier.wait;
 };
 f.calls.responses.push(Error('first attempt failed'),composition());
 const original:Input={kind:'music',prompt:'El encargo original conserva su motivo de jazz.',requestId:'insert-race'};
 const first=f.api.createAI('alice',original);let conflicting:Promise<AICreation>|undefined;
 try{
  await firstRead.entered;conflicting=f.api.createAI('alice',{...original,prompt:'Este segundo encargo no puede sustituir al primero.'});await secondRead.entered;
  firstRead.release();await assert.rejects(first,/first attempt failed/);const reserved=f.row('alice',original.requestId);assert.equal(reserved.status,'failed');assert.equal(reserved.lease_until,0);
  secondRead.release();await assert.rejects(conflicting,/CONFLICT/);
  const unchanged=f.row('alice',original.requestId);assert.equal(unchanged.id,reserved.id);assert.equal(unchanged.prompt,original.prompt);assert.equal(unchanged.status,'failed');assert.equal(unchanged.content,null);assert.equal(f.calls.inferences.length,1);
  const retry=await f.api.createAI('alice',original);assert.equal(retry.prompt,original.prompt);assert.equal(f.calls.inferences.length,2);assert.deepEqual(plain(await f.api.listAICreations('alice')),[plain(retry)]);
 }finally{firstRead.release();secondRead.release();await first.catch(()=>{});await conflicting?.catch(()=>{});f.db.close();}
});

test('a live lease permits one inference and rejects a concurrent request without overwriting it',async()=>{
 const f=await fixture(),barrier=gate();f.calls.gates.set(0,barrier);const input:Input={kind:'music',prompt:'Un tema con variaciones para la casa.',requestId:'two-tabs'},running=f.api.createAI('alice',input);
 try{
  await barrier.entered;const reserved=f.row('alice',input.requestId);assert.equal(reserved.status,'generating');assert.ok(Number(reserved.lease_until)>f.clock.now);
  await assert.rejects(f.api.createAI('alice',input),/BUSY/);await assert.rejects(f.api.createAI('alice',{...input,prompt:'Un encargo que no corresponde al ID.'}),/CONFLICT/);
  assert.equal(f.calls.inferences.length,1);assert.equal(f.row('alice',input.requestId).id,reserved.id);assert.deepEqual(plain(await f.api.listAICreations('alice')),[]);
  barrier.release();const completed=await running;assert.equal(completed.id,reserved.id);assert.equal(f.row('alice',input.requestId).status,'completed');assert.equal(f.calls.inferences.length,1);
 }finally{barrier.release();await running.catch(()=>{});f.db.close();}
});

test('an expired lease can be retried and its stale model response cannot replace the new owner',async()=>{
 const f=await fixture(),oldGate=gate(),newGate=gate();f.calls.gates.set(0,oldGate);f.calls.gates.set(1,newGate);
 const oldScore=composition(),newScore={...composition(),title:'La respuesta del nuevo propietario'};f.calls.responses.push(oldScore,newScore);
 const input:Input={kind:'music',prompt:'Una pieza de jazz con una sección contrastante.',requestId:'expired-worker'},oldRun=f.api.createAI('alice',input);let newRun:Promise<AICreation>|undefined;
 try{
  await oldGate.entered;const oldId=f.row('alice',input.requestId).id;f.clock.now+=90001;newRun=f.api.createAI('alice',input);await newGate.entered;
  const newReservation=f.row('alice',input.requestId);assert.notEqual(newReservation.id,oldId);assert.equal(f.calls.inferences.length,2);
  oldGate.release();await assert.rejects(oldRun,/CONFLICT/);const stillOwned=f.row('alice',input.requestId);
  assert.equal(stillOwned.id,newReservation.id);assert.equal(stillOwned.status,'generating');assert.equal(stillOwned.lease_until,newReservation.lease_until);assert.equal(stillOwned.content,null);
  newGate.release();const completed=await newRun;assert.equal(completed.id,newReservation.id);assert.equal((completed.content as music.Composition).title,newScore.title);
  assert.deepEqual(plain(await f.api.listAICreations('alice')),[plain(completed)]);
 }finally{oldGate.release();newGate.release();await oldRun.catch(()=>{});await newRun?.catch(()=>{});f.db.close();}
});

test('one repair fixes out-of-range music without resending the raw draft or acquiring a new lease',async t=>{
 const f=await fixture();t.after(()=>f.db.close());
 const rawDraft='RAW_DRAFT_DO_NOT_FORWARD: window.executePrivateCode(); '.repeat(2000),original=composition();
 const invalid={...original,rawDraft,sections:original.sections.map((section,index)=>index===0?{...section,kick:[16]}:section)};
 f.calls.responses.push(invalid,composition());
 const prefix='Jazz tranquilo para Lía, con un motivo que vuelva al final. ',input:Input={kind:'music',prompt:prefix+'a'.repeat(4000-prefix.length),requestId:'repair-music'};
 const created=await f.api.createAI('alice',input);
 assert.equal(f.calls.inferences.length,2);assert.equal(f.calls.registry,1);assert.equal((created as AICreation&{repairAttempted?:boolean}).repairAttempted,true);
 assert.deepEqual(plain(created.content),music.validateComposition(composition()));assert.deepEqual(f.calls.reservations[1],f.calls.reservations[0]);assert.equal(f.calls.reservations[0].id,created.id);
 const first=f.calls.inferences[0],repair=f.calls.inferences[1];assert.equal(repair.model,first.model);
 for(const call of [first,repair]){assert.equal(call.options.maxTokens,3900);assert.equal(call.options.timeoutMs,22000);assert.equal(call.options.json,true);assert.ok(call.messages.reduce((sum,message)=>sum+message.content.length,0)<=16000);}
 const repairText=repair.messages.map(message=>message.content).join('\n');assert.ok(repairText.includes(input.prompt));assert.doesNotMatch(repairText,/RAW_DRAFT_DO_NOT_FORWARD|executePrivateCode/);
 const feedback=repair.messages.filter(message=>!first.messages.some(previous=>previous.role===message.role&&previous.content===message.content)).map(message=>message.content).join('\n').replace(first.messages.at(-1)!.content,'').trim();
 assert.ok(feedback.length>0&&feedback.length<=1100,'The repair receives a bounded validation report and its short correction heading.');assert.match(feedback,/kick|pasos|percusi[oó]n/i);assert.match(feedback,/0\s*(?:\.\.|a|–|-)\s*15/);assert.doesNotMatch(feedback,/\[object Object\]/);
 const replay=await f.api.createAI('alice',input);assert.deepEqual(plain(replay),plain(created));assert.equal(f.calls.inferences.length,2);assert.equal(f.db.raw.prepare('SELECT count(*) AS n FROM ai_creations').get()!.n,1);
});

test('one repair validates a video plan before persisting it',async t=>{
 const f=await fixture();t.after(()=>f.db.close());f.calls.responses.push({...video(),shots:video().shots.map(shot=>({...shot,room:'nonexistent-room'}))},video());
 const created=await f.api.createAI('alice',{kind:'video',prompt:'Conecta la mente y la música con un inicio y cierre claros.',requestId:'repair-video'});
 assert.equal(f.calls.inferences.length,2);assert.equal((created as AICreation&{repairAttempted?:boolean}).repairAttempted,true);assert.deepEqual(plain(created.content),cinema.validateVideoPlan(video()));assert.deepEqual(f.calls.reservations[1],f.calls.reservations[0]);
 assert.equal(f.calls.inferences[1].model,f.calls.inferences[0].model);assert.equal(f.row('alice','repair-video').status,'completed');assert.deepEqual(plain(await f.api.listAICreations('alice')),[plain(created)]);
});

test('an invalid response from an expired owner cannot consume a repair after another worker acquired the request',async()=>{
 const f=await fixture(),oldGate=gate(),newGate=gate();f.calls.gates.set(0,oldGate);f.calls.gates.set(1,newGate);f.calls.responses.push({...composition(),arrangement:['missing-section']},composition());
 const input:Input={kind:'music',prompt:'Un motivo musical para desarrollar con calma.',requestId:'repair-expired-owner'},oldRun=f.api.createAI('alice',input);let newRun:Promise<AICreation>|undefined;
 try{
  await oldGate.entered;f.clock.now+=90001;newRun=f.api.createAI('alice',input);await newGate.entered;const current=f.row('alice',input.requestId);
  oldGate.release();await assert.rejects(oldRun,/CONFLICT|BUSY/);assert.equal(f.calls.inferences.length,2,'The stale invalid draft does not trigger a third model call.');assert.equal(f.row('alice',input.requestId).id,current.id);assert.equal(f.row('alice',input.requestId).status,'generating');
  newGate.release();const completed=await newRun;assert.equal(completed.id,current.id);assert.equal(f.calls.inferences.length,2);assert.equal(f.row('alice',input.requestId).status,'completed');
 }finally{oldGate.release();newGate.release();await oldRun.catch(()=>{});await newRun?.catch(()=>{});f.db.close();}
});

test('two invalid music or video outputs exhaust the single repair and the same request can retry',async t=>{
 for(const kind of ['music','video'] as const){
  const f=await fixture();t.after(()=>f.db.close());
  const valid=kind==='music'?composition():video();
  const invalid=kind==='music'?{...composition(),arrangement:['missing-section']}:{...video(),shots:video().shots.map(shot=>({...shot,room:'nonexistent-room'}))};
  f.calls.responses.push(invalid,invalid,valid);const input:Input={kind,prompt:'Un encargo concreto para desarrollar la casa.',requestId:'retry-'+kind};
  await assert.rejects(f.api.createAI('alice',input),error=>{const message=(error as Error).message;assert.match(message,/v[aá]lid|correcci[oó]n/i);assert.ok(message.length<=300);assert.doesNotMatch(message,/Zod|"code"|"path"|missing-section|nonexistent-room/);return true;});const failed=f.row('alice',input.requestId);
  assert.equal(f.calls.inferences.length,2);assert.equal(failed.status,'failed');assert.equal(failed.lease_until,0);assert.equal(failed.content,null);assert.equal(failed.model,null);assert.deepEqual(plain(await f.api.listAICreations('alice')),[]);
  const completed=await f.api.createAI('alice',input);assert.notEqual(completed.id,failed.id);assert.equal(f.calls.inferences.length,3);assert.equal(f.row('alice',input.requestId).status,'completed');assert.notEqual((completed as AICreation&{repairAttempted?:boolean}).repairAttempted,true);
  assert.deepEqual(plain(await f.api.listAICreations('alice')),[plain(completed)]);
 }
});

test('a failed inference releases its lease and can be retried without storing provider details',async t=>{
 const f=await fixture();t.after(()=>f.db.close());f.calls.responses.push(Error('private provider failure'),composition());const input:Input={kind:'music',prompt:'Una melodía original con acordes suaves.',requestId:'provider-retry'};
 await assert.rejects(f.api.createAI('alice',input),/private provider failure/);const failed=f.row('alice',input.requestId);assert.equal(f.calls.inferences.length,1);assert.equal(failed.status,'failed');assert.equal(failed.lease_until,0);assert.equal(failed.content,null);assert.doesNotMatch(JSON.stringify(failed),/private provider failure/);
 const completed=await f.api.createAI('alice',input);assert.equal(f.calls.inferences.length,2);assert.equal(f.row('alice',input.requestId).status,'completed');assert.equal((await f.api.listAICreations('alice'))[0].id,completed.id);
});

test('quota failures do not consume a validation-repair inference',async t=>{
 const f=await fixture();t.after(()=>f.db.close());const quota=Object.assign(Error('private quota response'),{code:'quota'});f.calls.responses.push(quota,composition());const input:Input={kind:'music',prompt:'Una pieza breve para el estudio de Lía.',requestId:'quota-no-repair'};
 await assert.rejects(f.api.createAI('alice',input),error=>(error as {code?:string}).code==='quota');assert.equal(f.calls.inferences.length,1);assert.equal(f.calls.responses.length,1);assert.equal(f.row('alice',input.requestId).status,'failed');assert.equal(f.row('alice',input.requestId).lease_until,0);assert.deepEqual(plain(await f.api.listAICreations('alice')),[]);
});

test('each creation kind is filtered before the twenty-item limit while preserving ownership and completed state',async t=>{
 const f=await fixture();t.after(()=>f.db.close());
 const original=await f.api.createAI('alice',{kind:'music',prompt:'Una composición antigua que no debe desaparecer detrás de los vídeos.',requestId:'original-music'});
 const insert=f.db.raw.prepare('INSERT INTO ai_creations(user_id,request_id,id,kind,prompt,model,status,content,lease_until,created_at) VALUES(?,?,?,?,?,?,?,?,0,?)');
 function seed(user:string,kind:CreationKind,index:number,hour:number,status='completed'){
  const id=`${user}-${kind}-${index}`,at=`2026-11-15T${hour}:00:${String(index).padStart(2,'0')}.000Z`,creation:AICreation={...original,id,kind,at,content:kind==='music'?music.validateComposition(composition()):cinema.validateVideoPlan(video())};
  insert.run(user,id,id,kind,creation.prompt,creation.model,status,JSON.stringify(creation),at);
 }
 for(let i=0;i<23;i++)seed('alice','music',i,10);
 for(let i=0;i<25;i++)seed('alice','video',i,11);
 seed('bob','music',0,12);seed('alice','music',59,13,'failed');
 const mixed=await f.api.listAICreations('alice'),scores=await f.api.listAICreations('alice','music'),films=await f.api.listAICreations('alice','video');
 assert.equal(mixed.length,20);assert.ok(mixed.every(item=>item.kind==='video'));
 assert.equal(scores.length,20);assert.ok(scores.every(item=>item.kind==='music'&&item.id.startsWith('alice-music-')));
 assert.equal(scores[0].id,'alice-music-22');assert.equal(scores.at(-1)!.id,'alice-music-3');
 assert.equal(films.length,20);assert.equal(films[0].id,'alice-video-24');assert.equal(films.at(-1)!.id,'alice-video-5');
 assert.deepEqual((await f.api.listAICreations('bob','music')).map(item=>item.id),['bob-music-0']);
 assert.deepEqual(plain(await f.api.listAICreations('bob','video')),[]);
 await assert.rejects(f.api.listAICreations('alice',"music' OR 1=1 --" as CreationKind),/INPUT/);
 assert.equal(f.calls.inferences.length,1,'Listing persisted artifacts never invokes inference.');
});
