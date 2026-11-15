// Run: node --experimental-vm-modules --experimental-strip-types tests/atlas-living-server.test.mts
// Persistence, model selection, tools and scene validation are real. Remote
// inference is replaced at the Worker import boundary; these are not visual tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {stripTypeScriptTypes} from 'node:module';
import {readFile} from 'node:fs/promises';
import * as vm from 'node:vm';
import * as agents from '../lib/cloud/agents.ts';
import {reserveInference} from '../lib/cloud/groq.mjs';
import * as missions from '../lib/collaboration/missions.ts';
import * as policy from '../lib/evolution/living-policy.ts';
import * as tools from '../lib/evolution/living-tools.mjs';
import * as lab from '../lib/evolution/living-lab.mjs';
import * as world from '../lib/evolution/world.ts';
import * as layout from '../public/house/layout.js';
import * as contract from '../public/house/living-contract.js';
import * as web from '../lib/research/web.ts';
import type {LivingResult} from '../lib/evolution/living-server.ts';

class Statement{
 readonly db:DatabaseSync;readonly sql:string;readonly values:unknown[];
 constructor(db:DatabaseSync,sql:string,values:unknown[]=[]){this.db=db;this.sql=sql;this.values=values;}
 bind(...values:unknown[]){return new Statement(this.db,this.sql,values);}
 async first(column?:string){const row=this.db.prepare(this.sql).get(...this.values as any[]) as Record<string,unknown>|undefined;return row?(column?row[column]:row):null;}
 async all(){return{success:true,results:this.db.prepare(this.sql).all(...this.values as any[])};}
 async run(){const r=this.db.prepare(this.sql).run(...this.values as any[]);return{success:true,meta:{changes:r.changes,last_row_id:r.lastInsertRowid}};}
}
class D1{
 raw=new DatabaseSync(':memory:');
 prepare(sql:string){return new Statement(this.raw,sql);}
 async batch(statements:Statement[]){this.raw.exec('BEGIN IMMEDIATE');try{const results=[];for(const s of statements)results.push(/\bRETURNING\b/i.test(s.sql)||/^\s*SELECT\b/i.test(s.sql)?await s.all():{...await s.run(),results:[]});this.raw.exec('COMMIT');return results;}catch(error){this.raw.exec('ROLLBACK');throw error;}}
 close(){this.raw.close();}
}
type Gate={entered:Promise<void>;wait:Promise<void>;signal:()=>void;release:()=>void};
function gate():Gate{let signal!:()=>void,release!:()=>void;return{entered:new Promise<void>(r=>signal=r),wait:new Promise<void>(r=>release=r),signal:()=>signal(),release:()=>release()};}
const actorId='resident:music-console';
const at='2026-11-15T12:00:00.000Z';
const qualified=(model:string,passed=8,latencyMs=100):agents.AgentEvaluation=>{
 const cases=['reasoning','programming','evidence','memory'].flatMap(domain=>[0,1].map(i=>({id:domain+i,domain:domain as 'reasoning'|'programming'|'evidence'|'memory',passed:!(passed===7&&domain==='reasoning'&&i===0),split:i?'heldout' as const:'development' as const,expected:'synthetic fixture'})));
 return{model,version:agents.AGENT_EVAL_VERSION,status:'qualified',at,latencyMs,score:{total:8,passed,cases}};
};
const proposal=(title='Órbitas de acordes')=>contract.validateLivingProposal({title,goal:'Presentar intervalos musicales mediante una escultura suspendida.',colors:['#163b54','#67e8da','#f3be69'],objects:[{shape:'sphere',x:-1,y:.4,z:0,size:.35,color:0},{shape:'torus',x:1,y:.6,z:0,size:.4,color:1},{shape:'helix',x:0,y:.8,z:1,size:.3,color:2},{shape:'crystal',x:0,y:.5,z:-1,size:.25,color:2}],program:[{op:'rotate',target:0,speed:.5,amount:0},{op:'float',target:1,speed:.8,amount:.06}],music:{bpm:112,swing:.12,kick:[0,8],snare:[4,12],hat:[0,2,4,6,8,10,12,14],bass:[0,4,8,12],notes:Array.from({length:16},(_,i)=>[36,43,39,46][i%4])},film:{rooms:['music','cinema'],seconds:8},environment:{style:'observatory',floor:'rings',intensity:.5},walk:true});
type InferenceCall={model:string;messages:Array<{role:string;content:string}>;options:{maxTokens?:number;purpose?:string}};

async function fixture(){
 assert.equal(typeof vm.SourceTextModule,'function','Run with --experimental-vm-modules.');
 const db=new D1(),calls:{inference:InferenceCall[];evaluations:agents.AgentEvaluation[];experiments:number;gate?:Gate;reviewDecision?:'accept'|'reject';afterCreator?:()=>void;afterReview?:()=>void;creatorError?:Error&{code:string};creatorOutputs?:unknown[];reserveBudget?:boolean}={inference:[],experiments:0,evaluations:[qualified('qwen/qwen3.8-27b',7,10),qualified('openai/gpt-oss-120b',8,30),qualified('openai/gpt-oss-20b',8,50)]};
 class ClockDate extends Date{constructor(value?:string|number){super(value===undefined?at:value);}static now(){return Date.parse(at);}}
 const context=vm.createContext({Date:ClockDate,crypto:globalThis.crypto,structuredClone,URL,console,TextEncoder,TextDecoder,Uint8Array,setTimeout,clearTimeout});
 const modules:Record<string,Record<string,unknown>>={
  'cloudflare:workers':{env:{DB:db}},
  './living-tools.mjs':tools,'./living-lab.mjs':{...lab,proposeLivingExperiment:(...args:Parameters<typeof lab.proposeLivingExperiment>)=>{calls.experiments++;return lab.proposeLivingExperiment(...args);}},'./living-policy':policy,'./world':world,'../../public/house/layout.js':layout,'../../public/house/living-contract.js':contract,'../research/web':web,
  '../cloud/agents':agents,'../cloud/agents.ts':agents,
  '../collaboration/missions':missions,'../collaboration/missions.ts':missions,
  '../cloud/agent-registry':{agentEvaluations:async()=>calls.evaluations},
  '../cloud/inference':{CLOUD_MODEL:'qwen/qwen3.8-27b',inferModel:async(model:string,messages:InferenceCall['messages'],options:InferenceCall['options'])=>{if(calls.reserveBudget)await reserveInference(db,Date.parse(at),options.purpose);calls.inference.push({model,messages,options});if(calls.inference.length===1&&calls.gate){calls.gate.signal();await calls.gate.wait;}if(messages[0].content.startsWith('Revisa')){calls.afterReview?.();return{decision:calls.reviewDecision||'accept',reason:'La intervención respeta los límites declarados; falta revisión visual.'};}calls.afterCreator?.();if(calls.creatorError)throw calls.creatorError;return calls.creatorOutputs?.length?calls.creatorOutputs.shift():proposal();}},
 };
 const source=stripTypeScriptTypes(await readFile(new URL('../lib/evolution/living-server.ts',import.meta.url),'utf8'),{mode:'strip'}),module=new vm.SourceTextModule(source,{context,identifier:'living-server.ts'}),linked=new Map<string,vm.Module>();
 await module.link(async specifier=>{if(linked.has(specifier))return linked.get(specifier)!;const exports=modules[specifier];assert.ok(exports,'Unexpected dependency: '+specifier);const synthetic=new vm.SyntheticModule(Object.keys(exports),function(){for(const[key,value]of Object.entries(exports))this.setExport(key,value);},{context});linked.set(specifier,synthetic);return synthetic;});
 await module.evaluate();
 const api=module.namespace as unknown as{livingPayload:()=>Promise<any>;buildLiving:(input:{requestId:string;actorId?:string;contextActorId?:string;trigger?:'manual'|'schedule';shouldContinue?:()=>Promise<boolean>})=>Promise<LivingResult>};
 await api.livingPayload();
 const state=()=>JSON.parse(db.raw.prepare("SELECT content FROM living_world WHERE id='main'").get()!.content as string);
 const saveState=(value:unknown)=>db.raw.prepare("UPDATE living_world SET content=? WHERE id='main'").run(JSON.stringify(value));
 const previous=()=>{const s=state(),p=proposal('Obra anterior conservada');s.artifacts.music={id:'living-'+('a'.repeat(24)),room:'music',actorId,actorName:'Noa',at,origin:'model',proposal:p};saveState(s);return p;};
 return{db,calls,api,state,saveState,previous};
}

test('fresh installation selects the qualified creator and a different qualified reviewer without requiring memory tables',async()=>{
 const f=await fixture();try{
  const result=await f.api.buildLiving({requestId:'fresh',actorId,trigger:'schedule'});
  assert.equal(result.status,'applied');assert.equal(result.creator,'openai/gpt-oss-120b');assert.equal(result.reviewer,'openai/gpt-oss-20b');
  assert.equal(f.calls.inference.length,2);assert.equal(f.calls.inference[0].options.maxTokens,3000);assert.equal(f.calls.inference[1].options.maxTokens,1200);assert.ok(f.calls.inference.every(c=>c.options.purpose==='research'));
  assert.deepEqual(JSON.parse(f.calls.inference[0].messages[1].content).evidence.sources,[]);
  assert.match(f.calls.inference[0].messages[0].content,/suspendid/i);assert.match(f.calls.inference[0].messages[0].content,/no.*(?:remodel|colision|pared)/i);
 }finally{f.db.close();}
});

test('large personal history carries bounded real evidence and the complete preceding scene to both models',async()=>{
 const f=await fixture();try{
  const previous=f.previous(),s=f.state(),large='"texto\\\n'.repeat(6000);s.history.music=Array.from({length:6},(_,i)=>({...s.artifacts.music,id:'living-'+String(i).repeat(24),proposal:{...previous,title:'Historial '+i,goal:large}}));f.saveState(s);
  f.db.raw.exec('CREATE TABLE research_control(id TEXT PRIMARY KEY,content TEXT NOT NULL);CREATE TABLE research_sources(id TEXT PRIMARY KEY,content TEXT NOT NULL,fetched_at TEXT NOT NULL);CREATE TABLE research_runs(id TEXT PRIMARY KEY,content TEXT NOT NULL,date TEXT);CREATE TABLE icarus_consultations(request_id TEXT PRIMARY KEY,id TEXT UNIQUE,content TEXT NOT NULL,created_at TEXT NOT NULL);');
  const source={id:'source-read',title:'Referencia leída',url:'https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode',text:'Los intervalos se conservan al transponer todas las notas por la misma cantidad. '+large,provider:'MDN',kind:'Documento web · contenido por contrastar',fetchedAt:at,runId:'research-1'};
  f.db.raw.prepare('INSERT INTO research_sources VALUES(?,?,?)').run(source.id,JSON.stringify(source),at);
  f.db.raw.prepare('INSERT INTO research_sources VALUES(?,?,?)').run('other-source',JSON.stringify({...source,id:'other-source',title:'OTHER_ACTOR_SECRET'}),at);
  const consultedSource={id:'consult-read',title:'Intervalos',url:'https://en.wikipedia.org/wiki/Interval_(music)',excerpt:'Una octava equivale a doce semitonos.',readAt:at};
  const consultation={id:'icarus-1',actorId,targetProject:'atlas',status:'proposed',at,completedAt:at,question:'¿Cómo representar intervalos?',sources:[consultedSource],proposal:{change:'Representar intervalos con separación y altura.',reason:'La referencia describe semitonos.',validation:['Comparar las notas y posiciones.'],sourceIds:['consult-read']}};
  f.db.raw.prepare('INSERT INTO icarus_consultations VALUES(?,?,?,?)').run('consult',consultation.id,JSON.stringify(consultation),at);
  f.db.raw.prepare('INSERT INTO icarus_consultations VALUES(?,?,?,?)').run('other','icarus-2',JSON.stringify({...consultation,id:'icarus-2',actorId:'resident:games-desk',proposal:{...consultation.proposal,change:'OTHER_ACTOR_SECRET'}}),at);
  const memory={question:'¿Cómo conservar los intervalos? '+large,conclusion:'Una conclusión registrada '+large,grounding:'source-linked',uncertainties:[large,large,large],sourceIds:['source-read','missing-source'],updatedAt:at,creation:{title:'Obra registrada',goal:large,review:large},consultation:{id:'icarus-1',status:'proposed',sourceIds:['consult-read'],at}};
  f.db.raw.prepare('INSERT INTO research_control VALUES(?,?)').run('main',JSON.stringify({spiral:{world:{memories:{[actorId]:memory,'resident:games-desk':{conclusion:'OTHER_ACTOR_SECRET'}}}}}));
  for(let i=0;i<4;i++)f.db.raw.prepare('INSERT INTO living_builds VALUES(?,?)').run('history-'+i,JSON.stringify({id:'prior-'+i,actorId,title:'Intento '+i,goal:large,status:'rejected',review:large,at}));
  const result=await f.api.buildLiving({requestId:'with-memory',actorId});assert.equal(result.status,'applied');assert.equal(f.calls.inference.length,2);
  for(const call of f.calls.inference){assert.ok(call.messages.reduce((n,m)=>n+m.content.length,0)<=16000);assert.ok(!call.messages.some(m=>m.content.includes('OTHER_ACTOR_SECRET')));}
  const brief=JSON.parse(f.calls.inference[0].messages[1].content),review=JSON.parse(f.calls.inference[1].messages[1].content);
  assert.deepEqual(brief.previous,previous);assert.deepEqual(review.brief.previous,previous);assert.deepEqual(review.brief.evidence,brief.evidence);assert.deepEqual(review.brief.constraints,brief.constraints);assert.equal(brief.actor.id,actorId);assert.ok(brief.constraints);
  const sources=brief.evidence.sources as Array<{id:string;text:string;url:string}>;assert.ok(sources.some(doc=>doc.id==='source-read'&&doc.text.startsWith('Los intervalos')));assert.ok(sources.some(doc=>doc.id==='consult-read'));assert.ok(!sources.some(doc=>['missing-source','other-source'].includes(doc.id)));
  assert.equal(brief.evidence.consultation.id,'icarus-1');assert.equal(brief.evidence.consultation.proposal.change,consultation.proposal.change);assert.deepEqual(brief.evidence.consultation.proposal.sourceIds,['consult-read']);
 }finally{f.db.close();}
});

test('a memory pointer cannot import another resident consultation as evidence',async()=>{
 const f=await fixture();try{
  f.db.raw.exec('CREATE TABLE research_control(id TEXT PRIMARY KEY,content TEXT NOT NULL);CREATE TABLE icarus_consultations(request_id TEXT PRIMARY KEY,id TEXT UNIQUE,content TEXT NOT NULL,created_at TEXT NOT NULL);');
  f.db.raw.prepare('INSERT INTO research_control VALUES(?,?)').run('main',JSON.stringify({spiral:{world:{memories:{[actorId]:{question:'Representar ritmo',consultation:{id:'icarus-foreign'},sourceIds:['unread']}}}}}));
  f.db.raw.prepare('INSERT INTO icarus_consultations VALUES(?,?,?,?)').run('foreign','icarus-foreign',JSON.stringify({id:'icarus-foreign',actorId:'resident:games-desk',targetProject:'atlas',status:'proposed',sources:[{id:'foreign-source',excerpt:'FOREIGN_EVIDENCE',url:'https://developer.mozilla.org/',readAt:at}],proposal:{change:'FOREIGN_EVIDENCE',sourceIds:['foreign-source']}}),at);
  const result=await f.api.buildLiving({requestId:'foreign',actorId});assert.equal(result.status,'applied');const brief=JSON.parse(f.calls.inference[0].messages[1].content);assert.deepEqual(brief.evidence.sources,[]);assert.ok(!brief.evidence.consultation);assert.ok(!JSON.stringify(brief).includes('FOREIGN_EVIDENCE'));
 }finally{f.db.close();}
});

test('the active lease blocks another request and a stored receipt replays without inference',async()=>{
 const f=await fixture();try{
  f.calls.gate=gate();const running=f.api.buildLiving({requestId:'first',actorId});await Promise.race([f.calls.gate.entered,running.then(()=>{throw Error('Build ended before gated inference.');})]);
  await assert.rejects(f.api.buildLiving({requestId:'second',actorId}),/BUSY/);assert.equal(f.calls.inference.length,1);f.calls.gate.release();const first=await running,replay=await f.api.buildLiving({requestId:'first',actorId,shouldContinue:async()=>false});assert.equal(replay.id,first.id);assert.equal(replay.status,'applied');assert.equal(f.calls.inference.length,2);assert.equal(f.db.raw.prepare('SELECT count(*) AS n FROM living_builds').get()!.n,1);
 }finally{f.db.close();}
});

test('a concurrent revision change prevents stale artifacts and receipts from being committed',async()=>{
 const f=await fixture();try{
  const previous=f.previous();f.calls.gate=gate();const running=f.api.buildLiving({requestId:'stale',actorId});await Promise.race([f.calls.gate.entered,running.then(()=>{throw Error('Build ended before gated inference.');})]);
  f.db.raw.prepare("UPDATE living_world SET revision=revision+1,lease_id=NULL,lease_until=0 WHERE id='main'").run();f.calls.gate.release();await assert.rejects(running,/CONFLICT/);
  assert.deepEqual(f.state().artifacts.music.proposal,previous);assert.equal(f.db.raw.prepare("SELECT count(*) AS n FROM living_builds WHERE request_id='stale'").get()!.n,0);
 }finally{f.db.close();}
});

test('unqualified models cannot publish a new scene or consume inference calls',async()=>{
 const f=await fixture();try{
  const previous=f.previous();f.calls.evaluations=f.calls.evaluations.map(e=>({...e,status:'rejected'}));const result=await f.api.buildLiving({requestId:'unqualified',actorId});assert.equal(result.status,'rejected');assert.equal(f.calls.inference.length,0);assert.deepEqual(f.state().artifacts.music.proposal,previous);
  f.calls.evaluations=[qualified('openai/gpt-oss-120b')];const single=await f.api.buildLiving({requestId:'no-reviewer',actorId});assert.equal(single.status,'rejected');assert.equal(f.calls.inference.length,0);assert.deepEqual(f.state().artifacts.music.proposal,previous);
 }finally{f.db.close();}
});

const inactiveReview='La sesión dejó de estar activa o se pausó el trabajo; no se inicia otra etapa y se conserva la obra.';
test('an inactive foreground session starts no creator call and publishes no artifact',async()=>{
 const f=await fixture();try{
  const result=await f.api.buildLiving({requestId:'inactive-start',actorId,shouldContinue:async()=>false});assert.equal(result.status,'waiting');assert.equal(result.review,inactiveReview);assert.equal(f.calls.inference.length,0);assert.deepEqual(f.state().artifacts,{});assert.equal(f.state().published,0);assert.equal(result.artifactIds.length,0);
 }finally{f.db.close();}
});
test('a session hidden while the creator runs starts no reviewer call and keeps the prior scene',async()=>{
 const f=await fixture();try{
  const previous=f.previous();let active=true;f.calls.gate=gate();const running=f.api.buildLiving({requestId:'hidden-after-creator',actorId,shouldContinue:async()=>active});await Promise.race([f.calls.gate.entered,running.then(()=>{throw Error('Build ended before gated inference.');})]);active=false;f.calls.gate.release();const result=await running;
  assert.equal(result.status,'waiting');assert.equal(result.review,inactiveReview);assert.equal(f.calls.inference.length,1);assert.equal(f.calls.experiments,0);assert.deepEqual(f.state().artifacts.music.proposal,previous);assert.equal(f.state().published,0);assert.equal(result.artifactIds.length,0);
 }finally{f.db.close();}
});
test('a session hidden after review cannot apply an accepted candidate',async()=>{
 const f=await fixture();try{
  const previous=f.previous();let active=true;f.calls.afterReview=()=>{active=false;};const result=await f.api.buildLiving({requestId:'hidden-after-review',actorId,shouldContinue:async()=>active});
  assert.equal(result.status,'waiting');assert.equal(result.review,inactiveReview);assert.equal(f.calls.inference.length,2);assert.deepEqual(f.state().artifacts.music.proposal,previous);assert.equal(f.state().published,0);assert.equal(result.artifactIds.length,0);
 }finally{f.db.close();}
});
test('quota fallback cannot apply a tool experiment after its foreground session ends',async()=>{
 const f=await fixture();try{
  const previous=f.previous();let active=true;f.calls.afterCreator=()=>{active=false;};f.calls.creatorError=Object.assign(Error('La inferencia espera cuota.'),{code:'quota'});const result=await f.api.buildLiving({requestId:'inactive-quota-fallback',actorId,shouldContinue:async()=>active});
  assert.equal(result.status,'waiting');assert.equal(result.review,inactiveReview);assert.equal(f.calls.inference.length,1);assert.equal(f.calls.experiments,0);assert.deepEqual(f.state().artifacts.music.proposal,previous);assert.equal(f.state().published,0);assert.equal(result.artifactIds.length,0);
 }finally{f.db.close();}
});

test('a graphics mission keeps its own evidence while the registered resident performs the scene work',async()=>{
 const f=await fixture();try{
  const ownerId='module:graphics',delegateId='resident:games-desk',owner=missions.missionFor(ownerId)!;assert.equal(owner.targetProject,'atlas');assert.equal('resident:'+owner.residentId,delegateId);
  f.db.raw.exec('CREATE TABLE research_control(id TEXT PRIMARY KEY,content TEXT NOT NULL);CREATE TABLE icarus_consultations(request_id TEXT PRIMARY KEY,id TEXT UNIQUE,content TEXT NOT NULL,created_at TEXT NOT NULL);');
  const source={id:'graphics-read',title:'Instancias de geometría',url:'https://threejs.org/docs/#api/en/objects/InstancedMesh',excerpt:'InstancedMesh permite reutilizar geometría con transformaciones por instancia.',readAt:at},consultation={id:'icarus-graphics',actorId:ownerId,targetProject:'atlas',status:'proposed',at,completedAt:at,question:'¿Cómo conservar geometría compartida?',sources:[source],proposal:{change:'Representar una misma forma con posiciones y escalas distintas.',reason:'La fuente documenta transformaciones por instancia.',validation:['Conservar legibilidad y posiciones acotadas.'],sourceIds:[source.id]}};
  f.db.raw.prepare('INSERT INTO icarus_consultations VALUES(?,?,?,?)').run('graphics',consultation.id,JSON.stringify(consultation),at);
  f.db.raw.prepare('INSERT INTO research_control VALUES(?,?)').run('main',JSON.stringify({spiral:{world:{memories:{[ownerId]:{question:consultation.question,consultation:{id:consultation.id},sourceIds:[source.id]},[delegateId]:{question:'DELEGATE_PRIVATE_QUESTION',sourceIds:['not-read']}}}}}));
  const result=await f.api.buildLiving({requestId:'graphics-delegation',actorId:delegateId,contextActorId:ownerId});assert.equal(result.status,'applied');assert.equal(result.actorId,delegateId);assert.equal(f.state().artifacts.games.actorId,delegateId);
  const brief=JSON.parse(f.calls.inference[0].messages[1].content);assert.equal(brief.actor.id,ownerId);assert.equal(brief.delegate.id,delegateId);assert.equal(brief.personalMemory.question,consultation.question);assert.equal(brief.evidence.consultation.id,consultation.id);assert.equal(brief.evidence.consultation.proposal.change,consultation.proposal.change);assert.deepEqual(brief.evidence.consultation.proposal.sourceIds,[source.id]);assert.ok(brief.evidence.sources.some((s:{id:string;text:string})=>s.id===source.id&&s.text===source.excerpt));assert.ok(!JSON.stringify(brief).includes('DELEGATE_PRIVATE_QUESTION'));
 }finally{f.db.close();}
});
test('an internal mission cannot use a different resident as its delegate',async()=>{
 const f=await fixture();try{
  const result=await f.api.buildLiving({requestId:'invalid-delegate',actorId,contextActorId:'module:graphics'}).catch(error=>({status:'blocked',error}));assert.notEqual(result.status,'applied');assert.equal(f.calls.inference.length,0);assert.deepEqual(f.state().artifacts,{});assert.equal(f.state().published,0);
 }finally{f.db.close();}
});

const invalidProposal=()=>{const p=proposal();p.music.notes[0]=12;return p;};
test('one contract repair uses the same creator and persists its attempt before a separate review',async()=>{
 const f=await fixture();try{
  const repaired=proposal('Órbitas corregidas');f.calls.creatorOutputs=[invalidProposal(),repaired];const result=await f.api.buildLiving({requestId:'repair-valid',actorId});
  assert.equal(result.status,'applied');assert.equal(result.repairAttempted,true);assert.deepEqual(f.calls.inference.map(c=>c.model),['openai/gpt-oss-120b','openai/gpt-oss-120b','openai/gpt-oss-20b']);assert.deepEqual(f.calls.inference.map(c=>c.options.maxTokens),[3000,3000,1200]);assert.equal(f.state().artifacts.music.proposal.title,repaired.title);assert.equal(JSON.parse(f.db.raw.prepare("SELECT content FROM living_builds WHERE request_id='repair-valid'").get()!.content as string).repairAttempted,true);
  assert.ok(f.calls.inference.every(c=>c.messages.reduce((n,m)=>n+m.content.length,0)<=16000));assert.equal(JSON.parse(f.calls.inference[2].messages[1].content).proposal.title,repaired.title);
 }finally{f.db.close();}
});
test('a second invalid contract stops without another repair or reviewer',async()=>{
 const f=await fixture();try{
  f.calls.creatorOutputs=[invalidProposal(),invalidProposal(),proposal()];const result=await f.api.buildLiving({requestId:'repair-invalid',actorId});assert.equal(result.status,'rejected');assert.equal(result.repairAttempted,true);assert.equal(f.calls.inference.length,2);assert.ok(f.calls.inference.every(c=>c.model==='openai/gpt-oss-120b'));assert.equal(f.calls.creatorOutputs.length,1);assert.deepEqual(f.state().artifacts,{});assert.equal(result.artifactIds.length,0);
 }finally{f.db.close();}
});
test('an inactive session after invalid output starts no repair',async()=>{
 const f=await fixture();try{
  let active=true;f.calls.creatorOutputs=[invalidProposal(),proposal()];f.calls.afterCreator=()=>{active=false;};const result=await f.api.buildLiving({requestId:'repair-inactive',actorId,shouldContinue:async()=>active});assert.equal(result.status,'waiting');assert.equal(result.review,inactiveReview);assert.equal(result.repairAttempted,undefined);assert.equal(f.calls.inference.length,1);assert.deepEqual(f.state().artifacts,{});
 }finally{f.db.close();}
});
test('repair preserves the reserved reviewer request under both daily budget limits',async()=>{
 for(const scenario of [{trigger:'schedule' as const,used:45,allowed:true,final:48},{trigger:'schedule' as const,used:46,allowed:false,final:47},{trigger:'manual' as const,used:57,allowed:true,final:60},{trigger:'manual' as const,used:58,allowed:false,final:59}]){
  const f=await fixture();try{
   f.calls.reserveBudget=true;f.calls.creatorOutputs=[invalidProposal(),proposal()];f.db.raw.prepare('INSERT INTO cloud_inference_budget VALUES(?,?,0)').run(at.slice(0,10),scenario.used);const result=await f.api.buildLiving({requestId:'repair-budget-'+scenario.used,actorId,trigger:scenario.trigger});
   assert.equal(result.status,scenario.allowed?'applied':'rejected');assert.equal(result.repairAttempted,scenario.allowed?true:undefined);assert.equal(f.calls.inference.length,scenario.allowed?3:1);assert.equal(f.db.raw.prepare('SELECT requests FROM cloud_inference_budget WHERE day=?').get(at.slice(0,10))!.requests,scenario.final);assert.equal(result.artifactIds.length,scenario.allowed?1:0);
  }finally{f.db.close();}
 }
});
test('a provider pause discovered after invalid output prevents repair despite spare daily quota',async()=>{
 const f=await fixture();try{
  f.calls.reserveBudget=true;f.calls.creatorOutputs=[invalidProposal(),proposal()];f.calls.afterCreator=()=>{f.db.raw.prepare('UPDATE cloud_inference_budget SET blocked_until=? WHERE day=?').run(Date.parse(at)+60000,at.slice(0,10));};const result=await f.api.buildLiving({requestId:'repair-provider-paused',actorId});assert.equal(result.status,'rejected');assert.equal(result.repairAttempted,undefined);assert.equal(f.calls.inference.length,1);assert.deepEqual(f.state().artifacts,{});
 }finally{f.db.close();}
});
test('transport errors do not enter the contract repair path',async()=>{
 const f=await fixture();try{
  f.calls.creatorError=Object.assign(Error('La red no completó la inferencia.'),{code:'timeout'});const result=await f.api.buildLiving({requestId:'repair-transport',actorId});assert.equal(result.status,'rejected');assert.equal(result.repairAttempted,undefined);assert.equal(f.calls.inference.length,1);assert.deepEqual(f.state().artifacts,{});
 }finally{f.db.close();}
});
