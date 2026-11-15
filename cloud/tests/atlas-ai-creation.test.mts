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
 const calls={inferences:[] as Call[],responses:[] as unknown[],gates:new Map<number,Gate>(),registry:0};
 class ClockDate extends Date{constructor(value?:string|number){super(value===undefined?clock.now:value);}static now(){return clock.now;}}
 const context=vm.createContext({Date:ClockDate,crypto:globalThis.crypto,structuredClone,console,TextEncoder,TextDecoder,setTimeout,clearTimeout});
 const cases=coachingCases(1761),score=gradeCoaching(cases,{answers:cases.map(c=>({id:c.id,value:c.expected}))});
 const modules:Record<string,Record<string,unknown>>={
  'cloudflare:workers':{env:{DB:db}},'../cloud/agents':agents,'../music/composition':music,'../cinema/director':cinema,
  '../cloud/agent-registry':{agentEvaluations:async()=>{calls.registry++;return[{model:'openai/gpt-oss-120b',version:agents.AGENT_EVAL_VERSION,status:'qualified',at:new ClockDate().toISOString(),latencyMs:20,score}];}},
  '../cloud/inference':{inferModel:async(model:string,messages:Call['messages'],options:Call['options'])=>{
   const index=calls.inferences.length;calls.inferences.push({model,messages,options});
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
 const api=module.namespace as unknown as {createAI:(userId:string,input:Input)=>Promise<AICreation>;listAICreations:(userId:string)=>Promise<AICreation[]>};
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

test('invalid music and video outputs never become artifacts and the same request can retry',async t=>{
 for(const kind of ['music','video'] as const){
  const f=await fixture();t.after(()=>f.db.close());
  const valid=kind==='music'?composition():video();
  const invalid=kind==='music'?{...composition(),arrangement:['missing-section']}:{...video(),shots:video().shots.map(shot=>({...shot,room:'nonexistent-room'}))};
  f.calls.responses.push(invalid,valid);const input:Input={kind,prompt:'Un encargo concreto para desarrollar la casa.',requestId:'retry-'+kind};
  await assert.rejects(f.api.createAI('alice',input));const failed=f.row('alice',input.requestId);
  assert.equal(failed.status,'failed');assert.equal(failed.lease_until,0);assert.equal(failed.content,null);assert.equal(failed.model,null);assert.deepEqual(plain(await f.api.listAICreations('alice')),[]);
  const completed=await f.api.createAI('alice',input);assert.notEqual(completed.id,failed.id);assert.equal(f.calls.inferences.length,2);assert.equal(f.row('alice',input.requestId).status,'completed');
  assert.deepEqual(plain(await f.api.listAICreations('alice')),[plain(completed)]);
 }
});

test('a failed inference releases its lease and can be retried without storing provider details',async t=>{
 const f=await fixture();t.after(()=>f.db.close());f.calls.responses.push(Error('private provider failure'),composition());const input:Input={kind:'music',prompt:'Una melodía original con acordes suaves.',requestId:'provider-retry'};
 await assert.rejects(f.api.createAI('alice',input),/private provider failure/);const failed=f.row('alice',input.requestId);assert.equal(failed.status,'failed');assert.equal(failed.lease_until,0);assert.equal(failed.content,null);assert.doesNotMatch(JSON.stringify(failed),/private provider failure/);
 const completed=await f.api.createAI('alice',input);assert.equal(f.calls.inferences.length,2);assert.equal(f.row('alice',input.requestId).status,'completed');assert.equal((await f.api.listAICreations('alice'))[0].id,completed.id);
});
