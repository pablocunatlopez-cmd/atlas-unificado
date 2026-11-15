// Run with: node --experimental-vm-modules --experimental-strip-types tests/atlas-house-work-server.test.mts
// The Worker module runs against real SQLite and real specialist tools. Only
// remote consultation/model/render services are replaced at its import boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {stripTypeScriptTypes} from 'node:module';
import {readFile} from 'node:fs/promises';
import * as vm from 'node:vm';
import * as workPolicy from '../lib/collaboration/house-work-policy.ts';
import * as tools from '../lib/collaboration/foreground-tools.ts';
import * as missions from '../lib/collaboration/missions.ts';
import * as houseEvidence from '../lib/collaboration/house-evidence.ts';
import * as identity from '../lib/core/identity.ts';
import * as receiptPolicy from '../lib/collaboration/policy.ts';
import * as world from '../lib/evolution/world.ts';
import * as spiral from '../lib/evolution/spiral.ts';
import * as engine from '../lib/research/engine.ts';
import * as web from '../lib/research/web.ts';

class Statement {
 readonly db:DatabaseSync;readonly sql:string;readonly values:unknown[];
 constructor(db:DatabaseSync,sql:string,values:unknown[]=[]){this.db=db;this.sql=sql;this.values=values;}
 bind(...values:unknown[]){return new Statement(this.db,this.sql,values);}
 async first(column?:string){const result=this.db.prepare(this.sql).get(...this.values as any[]) as Record<string,unknown>|undefined;return result?(column?result[column]:result):null;}
 async all(){return{results:this.db.prepare(this.sql).all(...this.values as any[]),success:true};}
 async run(){const result=this.db.prepare(this.sql).run(...this.values as any[]);return{success:true,meta:{changes:result.changes,last_row_id:result.lastInsertRowid}};}
}
class D1 {
 raw=new DatabaseSync(':memory:');
 constructor(){this.raw.exec("CREATE TABLE research_control(id TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 0,content TEXT NOT NULL,lease_id TEXT,lease_until INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);CREATE TABLE research_sources(id TEXT PRIMARY KEY,url TEXT NOT NULL,title TEXT NOT NULL,hash TEXT NOT NULL,content TEXT NOT NULL,fetched_at TEXT NOT NULL,run_id TEXT NOT NULL);");}
 prepare(sql:string){return new Statement(this.raw,sql);}
 async batch(statements:Statement[]){this.raw.exec('BEGIN IMMEDIATE');try{const results=[];for(const statement of statements){if(/\bRETURNING\b/i.test(statement.sql)||/^\s*SELECT\b/i.test(statement.sql))results.push(await statement.all());else results.push({...await statement.run(),results:[]});}this.raw.exec('COMMIT');return results;}catch(error){this.raw.exec('ROLLBACK');throw error;}}
 close(){this.raw.close();}
}
type Gate={entered:Promise<void>;release:()=>void;wait:Promise<void>;signal:()=>void};
function gate():Gate{let release!:()=>void,signal!:()=>void;const entered=new Promise<void>(r=>signal=r),wait=new Promise<void>(r=>release=r);return{entered,release,wait,signal};}

async function fixture(){
 assert.equal(typeof vm.SourceTextModule,'function','Pass --experimental-vm-modules to exercise the Worker module.');
 const db=new D1(),clock={now:Date.parse('2026-11-14T20:00:00Z')},calls:{tools:string[];consults:any[];gate?:Gate;enableProgram?:boolean;programMutation?:()=>void;programCalls:number;livingBuilds:any[];livingArtifacts:Record<string,unknown>;livingBudget:{day:string;used:number;automaticLimit:number;manualLimit:number;backgroundAvailable:boolean;manualAvailable:boolean};consultMutation?:(value:any)=>void;livingGate?:Gate}={tools:[],consults:[],programCalls:0,livingBuilds:[],livingArtifacts:{},livingBudget:{day:'2026-11-14',used:0,automaticLimit:48,manualLimit:60,backgroundAvailable:true,manualAvailable:true}};
 class ClockDate extends Date{constructor(value?:string|number){super(value===undefined?clock.now:value);}static now(){return clock.now;}}
 const context=vm.createContext({Date:ClockDate,crypto:globalThis.crypto,structuredClone,URL,console,TextEncoder,TextDecoder,Uint8Array,setTimeout,clearTimeout});
 const modules:Record<string,Record<string,unknown>>={
  'cloudflare:workers':{env:{DB:db}},
  './house-work-policy':workPolicy,'./house-evidence':houseEvidence,
  './foreground-tools':{...tools,performHouseTool:(mission:missions.Mission,previous?:any)=>{calls.tools.push(mission.id);return tools.performHouseTool(mission,previous);}},
  './missions':missions,'../core/identity':identity,'./policy':receiptPolicy,'../evolution/world':world,'../evolution/spiral':spiral,'../research/engine':engine,'../research/web':web,
  './server':{consultIcarus:async(input:any)=>{calls.consults.push(input);if(calls.gate){calls.gate.signal();await calls.gate.wait;}const m=missions.missionFor(input.actorId)!;const consultation={id:'icarus-'+calls.consults.length,requestId:input.requestId,residentId:m.residentId,actorId:m.id,actorName:m.name,domain:m.domain,title:m.title,question:m.question,targetProject:m.targetProject,targetFiles:[...m.targetFiles],application:m.application,validation:[...m.validation],status:'proposed',at:new ClockDate().toISOString(),completedAt:new ClockDate().toISOString(),sources:[{id:'source-read',url:'https://developer.mozilla.org/en-US/docs/Web/API/AbortController',title:'Read reference',excerpt:'Actual request was mocked for this integration test.',readAt:new ClockDate().toISOString()}],attempts:[],proposal:{change:'A tested proposal',reason:'Visible reference',validation:['Actual tests'],sourceIds:['source-read']},agents:[{role:'proposer',model:'test-model',status:'completed'},{role:'reviewer',model:'test-reviewer',status:'completed'}]};calls.consultMutation?.(consultation);return consultation;}},
  '../evolution/living-server':{livingPayload:async()=>({enabled:true,artifacts:calls.livingArtifacts,budget:calls.livingBudget}),buildLiving:async(input:any)=>{const control=JSON.parse(db.raw.prepare("SELECT content FROM research_control WHERE id='main'").get()!.content as string);calls.livingBuilds.push({input,memories:structuredClone(control.spiral?.world?.memories)});if(calls.livingGate){calls.livingGate.signal();await calls.livingGate.wait;}const active=!input.shouldContinue||await input.shouldContinue();calls.livingBuilds.at(-1).continued=active;return{id:'living-build-'+calls.livingBuilds.length,actorId:input.actorId,actorName:missions.missionFor(input.actorId)?.name||'Fixture specialist',room:input.room,status:active?'applied':'waiting',origin:input.mode==='auto'?'model':'tool-experiment',title:'Scene candidate',goal:'A bounded suspended scene',checks:[{name:'Mock contract boundary',passed:true}],creator:'fixture-model',artifactIds:active?['living-fixture']:[],at:new ClockDate().toISOString(),review:active?'Scene candidate accepted by fixture.':'Session stopped; previous scene retained.'};}},
  '../evolution/program-server':{programDue:()=>calls.enableProgram===true,evolveProgram:async(previous:any,at:number,actorId:string)=>{calls.programCalls++;calls.programMutation?.();return{state:{cursor:1,attempts:1,projects:{},nextAttemptAt:new ClockDate(clock.now+3600000).toISOString()},trial:{id:'program-trial-1',actorId,taskId:'positive-total',at:new ClockDate().toISOString(),decision:'installed',artifactId:'program-test-installed',reason:'Mocked model candidate, actual persistence guard under test.'}};}}
 };
 const source=stripTypeScriptTypes(await readFile(new URL('../lib/collaboration/house-work-server.ts',import.meta.url),'utf8'),{mode:'strip'});
 const module=new vm.SourceTextModule(source,{context,identifier:'house-work-server.ts'}),linked=new Map<string,vm.Module>();
 await module.link(async(specifier:string)=>{if(linked.has(specifier))return linked.get(specifier)!;const exports=modules[specifier];assert.ok(exports,'Unexpected dependency: '+specifier);const keys=Object.keys(exports);const synthetic=new vm.SyntheticModule(keys,function(){for(const key of keys)this.setExport(key,exports[key]);},{context});linked.set(specifier,synthetic);return synthetic;});
 await module.evaluate();
 const api=module.namespace as unknown as {houseWorkPayload:()=>Promise<any>;stepHouseWork:(requestId:string,sessionId?:string,epoch?:number)=>Promise<any>;houseWorkVisibility:(id:string,epoch:number,visible:boolean)=>Promise<any>;rollbackHouseArtifact:(kind:string)=>Promise<any>;houseWorkControl:(enabled:boolean)=>Promise<any>};
 const control=()=>JSON.parse(db.raw.prepare("SELECT content FROM research_control WHERE id='main'").get()!.content as string);
 return{db,clock,calls,api,control,advance:(ms=workPolicy.HOUSE_WORK_INTERVAL+1)=>clock.now+=ms};
}
async function selectResearch(f:Awaited<ReturnType<typeof fixture>>,focus:'3d'|'music'|'games'='3d'){
 await f.api.houseWorkPayload();const state=JSON.parse(f.db.raw.prepare("SELECT content FROM house_work WHERE id='main'").get()!.content as string);
 const mission=missions.MISSION_ROTATION.find(m=>m.targetProject==='atlas'&&m.focus===focus)!;assert.ok(mission,'An Atlas mission exists for '+focus);
 state.cursor=0;state.researchCursor=missions.MISSION_ROTATION.indexOf(mission);state.nextResearchMs=0;f.db.raw.prepare("UPDATE house_work SET content=? WHERE id='main'").run(JSON.stringify(state));return mission;
}

test('first house read bootstraps state and a real music artefact reaches persistent world memory',async()=>{
 const f=await fixture();try{const initial=await f.api.houseWorkPayload();assert.equal(initial.enabled,true);assert.equal(initial.counts.runs,0);const result=await f.api.stepHouseWork('first');assert.ok(result.artifacts.music);const pattern=result.artifacts.music.value;assert.equal(pattern.bassNotes.length,16);assert.ok(result.recent.some((w:any)=>w.actorId==='resident:music-console'&&w.status==='applied'));const memory=f.control().spiral.world.memories['resident:music-console'];assert.ok(memory.work||memory.houseWork||memory.lastWork,'The real work receipt must reach the existing world memory.');assert.equal(result.busy,false);assert.equal(result.active,null);}finally{f.db.close();}
});
test('same request replays its stored receipt without another tool or consultation',async()=>{
 const f=await fixture();try{const first=await f.api.stepHouseWork('same'),toolCount=f.calls.tools.length,consultCount=f.calls.consults.length;f.advance(60000);const replay=await f.api.stepHouseWork('same');assert.equal(replay.counts.runs,first.counts.runs);assert.equal(replay.cursor,first.cursor);assert.equal(f.calls.tools.length,toolCount);assert.equal(f.calls.consults.length,consultCount);assert.equal(replay.result.id,first.result.id);}finally{f.db.close();}
});
test('foreground pause and global research pause prevent new work',async()=>{
 const f=await fixture();try{await f.api.houseWorkPayload();await f.api.houseWorkControl(false);const paused=await f.api.stepHouseWork('paused');assert.equal(paused.enabled,false);assert.equal(f.calls.tools.length,0);await f.api.houseWorkControl(true);const control=f.control();control.enabled=false;f.db.raw.prepare("UPDATE research_control SET content=? WHERE id='main'").run(JSON.stringify(control));const globallyPaused=await f.api.stepHouseWork('global-pause');assert.equal(globallyPaused.enabled,false);assert.equal(f.calls.tools.length,0);assert.equal(f.calls.consults.length,0);}finally{f.db.close();}
});
test('two tabs cannot own the same pulse while remote work is in flight',async()=>{
 const f=await fixture();try{f.calls.gate=gate();const first=f.api.stepHouseWork('tab-a');await f.calls.gate.entered;const second=await f.api.stepHouseWork('tab-b');assert.equal(second.busy,true);assert.equal(f.calls.consults.length,1);f.calls.gate.release();const done=await first;assert.ok(done.counts.runs>=3&&done.counts.runs<=4);assert.equal(f.calls.consults.length,1);assert.equal(f.db.raw.prepare('SELECT count(*) AS n FROM house_work_runs').get()!.n,1);}finally{f.db.close();}
});
test('twelve pulses reach every physical specialist and consultation uses the automatic budget gate',async()=>{
 const f=await fixture();try{const seen=new Set<string>();for(let i=0;i<12;i++){const result=await f.api.stepHouseWork('pulse-'+i);for(const w of result.result.works)if(w.actorId.startsWith('resident:'))seen.add(w.actorId);f.advance();}assert.deepEqual(seen,new Set(missions.MISSIONS.filter(m=>m.kind==='resident').map(m=>m.id)));assert.ok(f.calls.consults.length>=1);assert.ok(f.calls.consults.every(c=>c.trigger==='schedule'));assert.ok(f.calls.consults.length<=2,'The two-minute gate must suppress per-pulse model consultations.');const before=f.calls.consults.length;f.advance(workPolicy.HOUSE_RESEARCH_INTERVAL+1);await f.api.stepHouseWork('later-research');assert.equal(f.calls.consults.length,before+1);}finally{f.db.close();}
});

test('a program candidate cannot be announced installed after a concurrent research configuration revision',async()=>{
 const f=await fixture();try{
  await f.api.houseWorkPayload();const state=JSON.parse(f.db.raw.prepare("SELECT content FROM house_work WHERE id='main'").get()!.content as string);
  state.cursor=Array.from({length:48},(_,i)=>i).find(i=>workPolicy.houseMission(i).id==='resident:body-console')!;
  f.db.raw.prepare("UPDATE house_work SET content=? WHERE id='main'").run(JSON.stringify(state));
  f.calls.enableProgram=true;f.calls.programMutation=()=>{const control=f.control();control.enabled=false;f.db.raw.prepare("UPDATE research_control SET revision=revision+1,content=? WHERE id='main'").run(JSON.stringify(control));};
  const result=await f.api.stepHouseWork('program-config-race'),program=result.result.works.find((w:any)=>w.actorId==='resident:body-console');
  assert.equal(f.calls.programCalls,1);assert.notEqual(program.status,'applied');assert.notEqual(program.artifactId,'program-test-installed');assert.equal(f.control().programming,undefined);
  const lease=f.db.raw.prepare("SELECT lease_id,lease_until FROM research_control WHERE id='main'").get()!;assert.equal(lease.lease_id,null);assert.equal(lease.lease_until,0);
 }finally{f.db.close();}
});

test('an existing research lease blocks program evolution and pending work memory is reconciled later',async()=>{
 const f=await fixture();try{
  await f.api.houseWorkPayload();const state=JSON.parse(f.db.raw.prepare("SELECT content FROM house_work WHERE id='main'").get()!.content as string);
  state.cursor=Array.from({length:48},(_,i)=>i).find(i=>workPolicy.houseMission(i).id==='resident:body-console')!;
  f.db.raw.prepare("UPDATE house_work SET content=? WHERE id='main'").run(JSON.stringify(state));f.calls.enableProgram=true;
  f.db.raw.prepare("UPDATE research_control SET lease_id='other-worker',lease_until=? WHERE id='main'").run(f.clock.now+60000);
  const result=await f.api.stepHouseWork('busy-research');assert.equal(f.calls.programCalls,0);assert.equal(f.calls.consults.length,0);assert.ok(result.result.works.every((w:any)=>w.memoryPending));
  assert.ok(Number(f.db.raw.prepare('SELECT count(*) AS n FROM house_work_memory').get()!.n)>0);
  f.calls.enableProgram=false;f.db.raw.prepare("UPDATE research_control SET lease_id=NULL,lease_until=0 WHERE id='main'").run();f.advance();
  await f.api.stepHouseWork('after-research');assert.equal(f.db.raw.prepare('SELECT count(*) AS n FROM house_work_memory').get()!.n,0);
  assert.ok(f.control().spiral.world.memories['resident:body-console'].work);
 }finally{f.db.close();}
});

test('a hidden session stops later stages and an older visible epoch cannot revive it',async()=>{
 const f=await fixture(),id='11111111-1111-4111-8111-111111111111';try{f.calls.gate=gate();const running=f.api.stepHouseWork('session-start',id,1);await f.calls.gate.entered;await f.api.houseWorkVisibility(id,2,false);f.calls.gate.release();const done=await running;assert.equal(f.calls.tools.length,3,'A completed network lookup must not start another tool after hide.');assert.equal(done.result.works.at(-1).status,'waiting');f.advance();const stale=await f.api.stepHouseWork('late-old-visible',id,1);assert.equal(stale.sessionInactive,true);const count=f.calls.tools.length;await f.api.stepHouseWork('visible-again',id,3);assert.ok(f.calls.tools.length>count);}finally{f.db.close();}
});
test('shared artifacts retain lineage and can restore the preceding valid revision',async()=>{
 const f=await fixture();try{let latest:any;for(let i=0;i<16;i++){latest=await f.api.stepHouseWork('history-'+i);if(latest.rollbackKinds.length)break;f.advance();}assert.ok(latest.rollbackKinds.length);const kind=latest.rollbackKinds[0],current=latest.artifacts[kind];assert.ok(current.parentId);const restored=await f.api.rollbackHouseArtifact(kind);assert.equal(restored.artifacts[kind].id,current.parentId);assert.notEqual(restored.artifacts[kind].fingerprint,current.fingerprint);assert.equal(restored.artifacts[kind].evidence.claim,'reported');assert.equal(restored.artifacts[kind].evidence.reportedImprovement,false);}finally{f.db.close();}
});

test('fresh reviewed 3D research is remembered before the first automatic scene is requested',async()=>{
 const f=await fixture();try{
  const mission=await selectResearch(f);assert.equal(f.calls.livingArtifacts[mission.room],undefined);f.calls.livingBudget.used=46;
  const response=await f.api.stepHouseWork('fresh-scene');const builds=f.calls.livingBuilds.filter(b=>b.input.mode==='auto');assert.equal(builds.length,1);assert.equal(builds[0].input.actorId,'resident:'+mission.residentId);assert.equal(builds[0].input.contextActorId,mission.id);assert.equal(builds[0].input.room,missions.missionFor('resident:'+mission.residentId)!.room);assert.equal(builds[0].input.trigger,'schedule');assert.equal(typeof builds[0].input.shouldContinue,'function');
  assert.equal(builds[0].memories[mission.id].consultation.id,'icarus-1');assert.deepEqual(builds[0].memories[mission.id].consultation.sourceIds,['source-read']);assert.equal(builds[0].continued,true);assert.equal(await builds[0].input.shouldContinue(),false,'The completed pulse no longer owns its lease.');assert.equal(response.result.works.at(-1).artifactId,'living-fixture');assert.ok(response.result.works.at(-1).summary.includes(missions.missionFor('resident:'+mission.residentId)!.name));
 }finally{f.db.close();}
});

test('ordinary 3D work keeps its deterministic experiment rather than calling the automatic model',async()=>{
 const f=await fixture();try{
  await f.api.houseWorkPayload();const state=JSON.parse(f.db.raw.prepare("SELECT content FROM house_work WHERE id='main'").get()!.content as string),cursor=Array.from({length:192},(_,i)=>i).find(i=>{const m=workPolicy.houseMission(i);return m.targetProject==='atlas'&&m.focus==='3d';})!;
  const mission=workPolicy.houseMission(cursor),delegate=missions.missionFor('resident:'+mission.residentId)!;state.cursor=cursor;state.nextResearchMs=f.clock.now+workPolicy.HOUSE_RESEARCH_INTERVAL;f.db.raw.prepare("UPDATE house_work SET content=? WHERE id='main'").run(JSON.stringify(state));f.calls.livingArtifacts[mission.room]={id:'existing-scene'};f.calls.livingArtifacts[delegate.room]={id:'existing-scene'};
  await f.api.stepHouseWork('ordinary-scene');assert.ok(f.calls.livingBuilds.some(b=>[mission.id,delegate.id].includes(b.input.actorId)&&b.input.mode==='experiment'));assert.ok(f.calls.livingBuilds.every(b=>b.input.mode!=='auto'));assert.equal(f.calls.consults.length,0);
 }finally{f.db.close();}
});

test('a new scene needs two automatic calls remaining and an applicable cited proposal',async()=>{
 const cases=[{name:'one-call-left',mutate:(f:Awaited<ReturnType<typeof fixture>>)=>{f.calls.livingBudget.used=47;}},{name:'budget-paused',mutate:(f:Awaited<ReturnType<typeof fixture>>)=>{f.calls.livingBudget.backgroundAvailable=false;}},{name:'rejected',mutate:(f:Awaited<ReturnType<typeof fixture>>)=>{f.calls.consultMutation=c=>c.status='rejected';}},{name:'unread',mutate:(f:Awaited<ReturnType<typeof fixture>>)=>{f.calls.consultMutation=c=>c.sources=[];}},{name:'invented-citation',mutate:(f:Awaited<ReturnType<typeof fixture>>)=>{f.calls.consultMutation=c=>c.proposal.sourceIds=['not-read'];}}];
 for(const item of cases){const f=await fixture();try{await selectResearch(f);item.mutate(f);await f.api.stepHouseWork(item.name);assert.equal(f.calls.livingBuilds.filter(b=>b.input.mode==='auto').length,0,item.name);}finally{f.db.close();}}
});

test('other specialties keep their own tools after a fresh consultation',async()=>{
 const f=await fixture();try{const mission=await selectResearch(f,'music');await f.api.stepHouseWork('fresh-music');assert.equal(f.calls.consults[0].actorId,mission.id);assert.equal(f.calls.livingBuilds.filter(b=>b.input.mode==='auto').length,0);assert.ok(f.calls.tools.includes(mission.id));}finally{f.db.close();}
});

test('a consultation that cannot reach memory cannot start an automatic scene',async()=>{
 const f=await fixture();try{await selectResearch(f);f.calls.consultMutation=()=>{f.db.raw.prepare("UPDATE research_control SET lease_id='concurrent-research',lease_until=? WHERE id='main'").run(f.clock.now+60000);};const result=await f.api.stepHouseWork('unpersisted-evidence');assert.equal(f.calls.livingBuilds.filter(b=>b.input.mode==='auto').length,0);assert.ok(result.result.works.at(-1).memoryPending);assert.ok(Number(f.db.raw.prepare('SELECT count(*) AS n FROM house_work_memory').get()!.n)>0);}finally{f.db.close();}
});

test('the continuation callback observes a hidden tab and global pause while a scene stage is running',async()=>{
 for(const action of ['hide','pause'] as const){const f=await fixture(),id='22222222-2222-4222-8222-222222222222';try{
  await selectResearch(f);f.calls.livingGate=gate();const running=f.api.stepHouseWork('scene-'+action,id,1);await Promise.race([f.calls.livingGate.entered,running.then(()=>{throw Error('Automatic scene was not started.');})]);
  if(action==='hide')await f.api.houseWorkVisibility(id,2,false);else{const control=f.control();control.enabled=false;f.db.raw.prepare("UPDATE research_control SET content=?,revision=revision+1 WHERE id='main'").run(JSON.stringify(control));}
  assert.equal(await f.calls.livingBuilds[0].input.shouldContinue(),false);f.calls.livingGate.release();const result=await running;assert.equal(result.result.works.at(-1).status,'waiting');assert.equal(result.result.works.at(-1).artifactId,undefined);
 }finally{f.db.close();}}
});
