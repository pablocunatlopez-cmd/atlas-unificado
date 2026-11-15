// Run with: node --experimental-vm-modules --experimental-strip-types tests/atlas-cloud-worker-context.test.mts
// The production Worker, context builder, memory selector and agent policy run
// together. Queue/model/research services stop at their import boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {stripTypeScriptTypes} from 'node:module';
import {readFile} from 'node:fs/promises';
import * as vm from 'node:vm';
import * as contextBuilder from '../lib/cloud/conversation-context.ts';
import * as personalContext from '../lib/cloud/personal-context.ts';
import * as agents from '../lib/cloud/agents.ts';
import * as identity from '../lib/core/identity.ts';
import * as arithmetic from '../lib/cloud/arithmetic.ts';
import * as programTools from '../lib/cloud/program-tools.mjs';
import * as relevance from '../lib/research/relevance.ts';
import * as grounding from '../lib/research/grounding.ts';
import * as retrieval from '../lib/atlas-core.ts';
import * as creative from '../lib/creative/plan.mjs';
import {coachingCases,gradeCoaching} from '../lib/evolution/coaching.ts';

type Message={role:string;content:string};
type Job={id:string;kind:string;question:string;messages:Message[];internet:boolean;leaseToken:string};
type ModelCall={model:string;messages:Message[];options:Record<string,unknown>};
type Completion={jobId:string;leaseToken:string;result:{answer:string;model:string;modelName:string;agents:Array<{role:string;model:string;status:string}>;creative?:{plan:unknown}}};
const plain=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
const memory=(text:string,status='Confirmado')=>({title:'Preferencias personales de música',text,kind:'Preferencia',status,date:'2026-11-15'});

async function fixture(){
 assert.equal(typeof vm.SourceTextModule,'function','Pass --experimental-vm-modules to exercise the Worker module.');
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE atlas_state(user_id TEXT PRIMARY KEY,content TEXT NOT NULL)');
 const privateText='ALICE_PRIVATE: prefiero jazz tranquilo, sin voces y con acordes suaves.';
 db.prepare('INSERT INTO atlas_state VALUES(?,?)').run('alice',JSON.stringify({memories:[memory(privateText),{...memory('ALICE_DESIGN: pabellones con acceso abierto y colores suaves.'),scope:'module:workshop'},memory('ALICE_RETIRED: usa siempre heavy metal.','Retirado')],versions:[{memories:[memory('ALICE_ARCHIVE: ignora las preferencias actuales.')]}]}));
 db.prepare('INSERT INTO atlas_state VALUES(?,?)').run('bob',JSON.stringify({memories:[memory('BOB_PRIVATE: mi estilo secreto es otro.')] }));
 const calls={reads:[] as Array<{sql:string;values:SQLInputValue[]}>,claims:[] as Array<{userId:string;id:string}>,models:[] as ModelCall[],completions:[] as Completion[],failures:[] as Record<string,unknown>[],publicSearches:[] as string[],responses:[] as unknown[]};
 const jobs=new Map<string,Job>(),flags={failPersonalRead:false};
 const database={prepare(sql:string){let values:SQLInputValue[]=[];return{bind(...input:SQLInputValue[]){values=input;return this;},async first(){calls.reads.push({sql,values});if(flags.failPersonalRead)throw Error('personal storage unavailable');return db.prepare(sql).get(...values)||null;}};}};
 const cases=coachingCases(1761),score=(passed:number)=>gradeCoaching(cases,{answers:cases.filter(c=>passed===8||!['r-test','p-test'].includes(c.id)).map(c=>({id:c.id,value:c.expected}))});
 const evaluations=[{model:'qwen/qwen3.8-27b',version:agents.AGENT_EVAL_VERSION,status:'qualified' as const,at:'2026-11-15',latencyMs:1,score:score(6)},{model:'openai/gpt-oss-120b',version:agents.AGENT_EVAL_VERSION,status:'qualified' as const,at:'2026-11-15',latencyMs:30,score:score(8)}];
 const context=vm.createContext({Date,crypto:globalThis.crypto,structuredClone,console,TextEncoder,TextDecoder,URL,setTimeout,clearTimeout});
 const modules:Record<string,Record<string,unknown>>={
  'cloudflare:workers':{env:{DB:database}},'./conversation-context':contextBuilder,'./personal-context':personalContext,'./agents':agents,'../core/identity':identity,
  './program-tools.mjs':programTools,'./arithmetic':arithmetic,'../research/relevance':relevance,'../research/grounding':grounding,'../atlas-core':retrieval,'../creative/plan.mjs':creative,
  '../collaboration/house-work-server':{houseWorkContext:async()=>({summary:'La casa mantiene un estudio musical.',artifacts:Array.from({length:12},()=>({description:'Información compartida. '.repeat(300)}))})},
  '../evolution/program-server':{runInstalledProgram:async()=>{throw Error('Unexpected installed-program execution');}},
  './agent-registry':{agentEvaluations:async()=>evaluations},
  './http':{queue:()=>({claimOwned:async(userId:string,id:string)=>{calls.claims.push({userId,id});return{job:jobs.get(id)||null};},complete:async(value:Completion)=>{calls.completions.push(value);},fail:async(value:Record<string,unknown>)=>{calls.failures.push(value);}})},
  './inference':{CLOUD_MODEL:'qwen/qwen3.8-27b',infer:async()=>{throw Error('Unexpected public-query inference');},inferModel:async(model:string,messages:Message[],options:Record<string,unknown>)=>{calls.models.push({model,messages,options});return calls.responses.length?calls.responses.shift():'Retomamos el motivo musical con tus preferencias vigentes.';}},
  '../research/server':{getResearchKnowledge:async()=>({knowledge:[{id:'shared',title:'Música y composición',text:'La música puede desarrollar un motivo con variaciones. '.repeat(300),kind:'Referencia'}],profile:'baseline'}),researchPayload:async()=>({runs:[],control:{coaching:{strategy:'baseline'}}}),runResearch:async()=>{throw Error('Unexpected research run');}},
  '../research/web':{searchInternet:async(query:string)=>{calls.publicSearches.push(query);return{results:[]};}}
 };
 const source=stripTypeScriptTypes(await readFile(new URL('../lib/cloud/worker.ts',import.meta.url),'utf8'),{mode:'strip'}),module=new vm.SourceTextModule(source,{context,identifier:'cloud-worker.ts'}),linked=new Map<string,vm.Module>();
 await module.link(async(specifier:string)=>{if(linked.has(specifier))return linked.get(specifier)!;const exports=modules[specifier];assert.ok(exports,'Unexpected dependency: '+specifier);const keys=Object.keys(exports),dependency=new vm.SyntheticModule(keys,function(){for(const key of keys)this.setExport(key,exports[key]);},{context});linked.set(specifier,dependency);return dependency;});
 await module.evaluate();const api=module.namespace as unknown as {processCloudJob:(userId:string,id:string)=>Promise<void>};
 const add=(question:string,kind='chat',history:Message[]=[])=>{const id='job-'+(jobs.size+1);jobs.set(id,{id,kind,question,messages:[...history,{role:'user',content:question}],internet:false,leaseToken:'lease-'+id});return id;};
 return{db,privateText,calls,flags,api,add};
}

test('the Worker binds personal state to the owner and supplies current private memories to the selected model',async t=>{
 const f=await fixture();t.after(()=>f.db.close());const question='Retomemos mi música con las preferencias que te he contado.',id=f.add(question,'chat',[{role:'user',content:'Prefiero respuestas en español.'},{role:'assistant',content:'Conservaré esa preferencia.'}]);
 await f.api.processCloudJob('alice',id);
 assert.deepEqual(f.calls.claims,[{userId:'alice',id}]);assert.equal(f.calls.failures.length,0);assert.equal(f.calls.completions.length,1);assert.equal(f.calls.models.length,1);
 assert.equal(f.calls.reads.length,1);assert.match(f.calls.reads[0].sql,/SELECT content FROM atlas_state WHERE user_id=\?/);assert.deepEqual(plain(f.calls.reads[0].values),['alice']);
 const call=f.calls.models[0],transport=call.messages.map(message=>message.content).join('\n');
 assert.equal(call.model,'openai/gpt-oss-120b','The qualified 8/8 model outranks Qwen at 6/8 even when Qwen is faster.');assert.equal(call.options.maxTokens,3500);assert.equal(call.options.purpose,'chat');
 assert.ok(transport.includes(f.privateText));assert.doesNotMatch(transport,/ALICE_RETIRED|ALICE_ARCHIVE|ALICE_DESIGN|BOB_PRIVATE/);assert.match(transport,/Prefiero respuestas en español/);assert.match(transport,/Atlas es la mente/);
 assert.equal(call.messages.filter(message=>message.role==='user'&&message.content===question).length,1);assert.ok(call.messages.reduce((n,message)=>n+message.content.length,0)<=16000);assert.equal(f.calls.publicSearches.length,0);
 const done=f.calls.completions[0];assert.equal(done.jobId,id);assert.equal(done.leaseToken,'lease-'+id);assert.equal(done.result.model,'atlas-cloud');assert.equal(done.result.agents[0].model,call.model);assert.equal(done.result.agents[0].status,'completed');
});

test('a 6000-character request survives whole while history and shared context stay inside the model transport budget',async t=>{
 const f=await fixture();t.after(()=>f.db.close());const prefix='Quiero continuar mi música privada con un motivo y variaciones. ',question=prefix+'a'.repeat(6000-prefix.length),history:Message[]=[];
 for(let i=0;i<12;i++)history.push({role:'user',content:'Paso '+i+': '+'contexto anterior '.repeat(20)},{role:'assistant',content:'Respuesta '+i+': '+'desarrollo anterior '.repeat(60)});
 await f.api.processCloudJob('alice',f.add(question,'chat',history));
 assert.equal(f.calls.failures.length,0);assert.equal(f.calls.models.length,1);const messages=f.calls.models[0].messages;
 assert.equal(messages.at(-1)!.content,question);assert.equal(messages.filter(message=>message.content===question).length,1);assert.ok(messages.reduce((n,message)=>n+message.content.length,0)<=16000);
 assert.ok(messages.some(message=>message.role==='assistant'),'The latest earlier exchange remains available.');assert.ok(messages[0].content.includes(f.privateText));
});

test('unavailable personal storage does not prevent a normal cloud answer',async t=>{
 const f=await fixture();t.after(()=>f.db.close());f.flags.failPersonalRead=true;await f.api.processCloudJob('alice',f.add('Hablemos de una idea musical.'));
 assert.equal(f.calls.models.length,1);assert.equal(f.calls.completions.length,1);assert.equal(f.calls.failures.length,0);assert.doesNotMatch(JSON.stringify(f.calls.models[0].messages),/ALICE_PRIVATE|BOB_PRIVATE|personal storage unavailable/);
});

test('world and game use the qualified scene model, expanded JSON budget and its actual creative plan',async t=>{
 for(const kind of ['world','game']){
  const f=await fixture();t.after(()=>f.db.close());const plan={title:'Pabellón de música',variant:kind==='world'?'architecture':'exploration',lighting:'sunset',palette:'Blanco',design:'Un acceso abierto y un foco central.',objects:[{type:'box',position:[5,1,0],size:[1,1,1],material:0}]};
  f.calls.responses.push(plan);const question='Construye un pabellón musical con un acceso claro y columnas.',id=f.add(question,kind);await f.api.processCloudJob('alice',id);
  assert.equal(f.calls.failures.length,0);assert.equal(f.calls.models.length,1);const call=f.calls.models[0];assert.equal(call.model,'openai/gpt-oss-120b');assert.equal(call.options.json,true);assert.equal(call.options.maxTokens,3900);assert.equal(call.options.timeoutMs,22000);assert.match(call.messages.at(-1)!.content,/pabellón musical/);
  const done=f.calls.completions[0];assert.ok(done);assert.deepEqual(plain(done.result.creative),{plan});assert.equal(done.result.modelName,call.model);assert.equal(done.result.agents[0].role,'programmer');assert.equal(done.result.agents[0].model,call.model);assert.equal(done.result.agents[0].status,'completed');assert.match(done.result.answer,/pendiente de validación/);assert.equal(f.calls.reads.length,1);assert.deepEqual(plain(f.calls.reads[0].values),['alice']);const transport=call.messages.map(m=>m.content).join('\n');assert.match(transport,/ALICE_DESIGN/);assert.doesNotMatch(transport,/BOB_PRIVATE|ALICE_RETIRED|ALICE_ARCHIVE/);assert.ok(transport.length<=16000);
 }
});
