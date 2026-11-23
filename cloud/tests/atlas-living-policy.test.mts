import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {livingBuildInput,livingReviewer,LIVING_ACQUIRE} from '../lib/evolution/living-policy.ts';
import {initialWorld,rememberWorldCreation} from '../lib/evolution/world.ts';
import {AGENT_EVAL_VERSION,type AgentEvaluation} from '../lib/cloud/agents.ts';
import type {LivingResult} from '../lib/evolution/living-server.ts';
const score={total:8,passed:8,cases:['reasoning','programming','evidence','memory'].flatMap(domain=>[0,1].map(i=>({id:domain+i,domain,passed:true,split:i?'heldout':'development'})))} as AgentEvaluation['score'];
const qualified=(model:string):AgentEvaluation=>({model,version:AGENT_EVAL_VERSION,status:'qualified',at:'2026-11-11T00:00:00Z',score});
test('build request rejects empty IDs, invalid scope/room/trigger and preserves idempotency ID',()=>{
 assert.deepEqual(livingBuildInput({requestId:'same',scope:'house',trigger:'manual'}),{requestId:'same',scope:'house',room:undefined,trigger:'manual'});
 for(const value of [{requestId:''},{requestId:' '},{requestId:'x'.repeat(121)},{requestId:'x',scope:'everywhere'},{requestId:'x',room:'outside'},{requestId:'x',trigger:'free'}])assert.throws(()=>livingBuildInput(value));
});
test('reviewer must be a separately qualified model with both programming cases passed',()=>{
 const creator='qwen/qwen3.8-27b',other=qualified('openai/gpt-oss-120b');
 assert.equal(livingReviewer(creator,[qualified(creator)]),undefined);
 assert.equal(livingReviewer(creator,[qualified(creator),other]),other.model);
 assert.equal(livingReviewer(creator,[{...other,status:'rejected'}]),undefined);
 assert.equal(livingReviewer(creator,[{...other,version:'old'}]),undefined);
 assert.equal(livingReviewer(creator,[{...other,score:{...score!,cases:score!.cases.map(c=>c.id==='programming0'?{...c,passed:false}:c)}}]),undefined);
});
test('creation memory updates author room/module separately while keeping factual provenance and is idempotent',()=>{
 const world=initialWorld(),memory=world.memories['resident:music-console'];memory.grounding='source-linked';memory.sourceIds=['prior-source'];memory.conclusion='A prior documented claim';memory.reflections=3;memory.adjustments=2;
 const creation:LivingResult={id:'build-1',actorId:'resident:music-console',actorName:'Noa',room:'music',status:'applied',title:'New pulse',goal:'Variation',checks:[],creator:'qwen',artifactIds:['artifact'],at:'2026-11-11T00:00:00Z'};
 const next=rememberWorldCreation(world,creation,'run-1'),after=next.memories[creation.actorId];
 assert.equal(after.creation?.applied,1);assert.equal(after.creation?.attempts,1);assert.equal(after.conclusion,memory.conclusion);assert.deepEqual(after.sourceIds,memory.sourceIds);assert.equal(after.grounding,'source-linked');assert.equal(after.reflections,3);assert.equal(after.adjustments,2);
 assert.equal(next.memories['room:music'].creation?.lastBuildId,'build-1');assert.equal(next.memories['module:audio'].creation?.lastRunId,'run-1');assert.equal(world.memories['room:music'].creation,undefined);
 assert.deepEqual(rememberWorldCreation(next,creation,'retry'),next);
 const rejected=rememberWorldCreation(next,{...creation,id:'build-2',status:'rejected',artifactIds:[]},'run-2');assert.equal(rejected.memories[creation.actorId].creation?.applied,1);assert.equal(rejected.memories[creation.actorId].creation?.attempts,2);
});
test('atomic acquire prevents a stale duplicate request from starting more model calls',()=>{
 const db=new DatabaseSync(':memory:');
 try{db.exec("CREATE TABLE living_world(id TEXT PRIMARY KEY,revision INTEGER,content TEXT,lease_id TEXT,lease_until INTEGER);CREATE TABLE living_builds(request_id TEXT PRIMARY KEY,content TEXT);INSERT INTO living_world VALUES('main',1,'{}',NULL,0);INSERT INTO living_builds VALUES('same','{}');");
 const acquire=db.prepare(LIVING_ACQUIRE);
 assert.equal(acquire.get('{}','second',180000,1,1,'same'),undefined);
 assert.ok(acquire.get('{}','new',180000,1,1,'new'));
 assert.equal(acquire.get('{}','concurrent',180000,1,1,'another'),undefined);
 }finally{db.close();}
});
