import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createExperienceLab,generateExperienceCases,experienceEvidenceHash} from './experience-lab.mjs';
import {executePure} from './extensions.mjs';import {getAutonomousTask} from './autonomy-curriculum.mjs';

const families=['dag-dependency-plan','json-pointer-resolve','numeric-statistics','stable-dedupe','merge-intervals','lor-omega-schema'];
const sources={
 'dag-dependency-plan':'function transform(input){if(!input||typeof input!=="object"||Array.isArray(input)||!Array.isArray(input.tasks))return {error:"invalid_tasks"};const ids=new Set(),byId=new Map();for(const task of input.tasks){if(!task||typeof task!=="object"||Array.isArray(task)||typeof task.id!=="string"||!task.id||ids.has(task.id)||!Array.isArray(task.dependsOn)||task.dependsOn.some(id=>typeof id!=="string"))return {error:"invalid_tasks"};ids.add(task.id);byId.set(task.id,task.dependsOn);}for(const deps of byId.values())if(deps.some(id=>!ids.has(id)))return {error:"invalid_tasks"};const pending=[...ids].sort(),order=[],done=new Set();while(pending.length){const index=pending.findIndex(id=>byId.get(id).every(dep=>done.has(dep)));if(index<0)break;const id=pending.splice(index,1)[0];order.push(id);done.add(id);}return {order,blocked:pending};}',
 'json-pointer-resolve':'function transform(input){if(!input||typeof input!=="object"||Array.isArray(input)||!Object.hasOwn(input,"document")||typeof input.pointer!=="string")return {found:false,error:"invalid_input"};const p=input.pointer;if(p!==""&&p[0]!=="/"||/~(?![01])/.test(p))return {found:false,error:"invalid_pointer"};if(p==="")return {found:true,value:input.document};let v=input.document;for(const part of p.slice(1).split("/")){const token=part.replaceAll("~1","/").replaceAll("~0","~");if(Array.isArray(v)){if(!/^(0|[1-9][0-9]*)$/.test(token)||!Number.isSafeInteger(Number(token))||Number(token)>=v.length)return {found:false,error:"not_found"};v=v[Number(token)];}else if(v&&typeof v==="object"&&Object.hasOwn(v,token))v=v[token];else return {found:false,error:"not_found"};}return {found:true,value:v};}',
 'numeric-statistics':'function transform(input){if(!input||!Array.isArray(input.values)||input.values.some(v=>typeof v!=="number"||!Number.isFinite(v)))return {error:"invalid_numbers"};let sum=0;for(const v of input.values){sum+=v;if(!Number.isFinite(sum))return {error:"invalid_numbers"};}const a=[...input.values].sort((x,y)=>x-y),count=a.length,m=Math.floor(count/2);return {count,sum,min:count?a[0]:null,max:count?a[count-1]:null,mean:count?sum/count:null,median:count?(count%2?a[m]:(a[m-1]+a[m])/2):null};}',
 'stable-dedupe':'function transform(input){if(!input||!Array.isArray(input.values)||input.values.some(v=>v!==null&&typeof v!=="string"&&typeof v!=="boolean"&&!(typeof v==="number"&&Number.isFinite(v))))return {error:"invalid_values"};return {values:Array.from(new Set(input.values))};}',
 'merge-intervals':'function transform(input){if(!input||!Array.isArray(input.intervals)||input.intervals.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>typeof v!=="number"||!Number.isFinite(v))))return {error:"invalid_intervals"};const a=input.intervals.map(p=>[Math.min(...p),Math.max(...p)]).sort((x,y)=>x[0]-y[0]),out=[];for(const p of a){const last=out[out.length-1];if(last&&p[0]<=last[1])last[1]=Math.max(last[1],p[1]);else out.push(p);}return {intervals:out};}',
 'lor-omega-schema':'function transform(input){const required=["O","A","X","R","T","I","C","E","M","P","F","Σ"],s=input&&typeof input==="object"&&!Array.isArray(input)?input.S:null;if(!s||typeof s!=="object"||Array.isArray(s))return {valid:false,missing:required,extra:[]};const missing=required.filter(k=>!Object.hasOwn(s,k)),extra=Object.keys(s).filter(k=>!required.includes(k)).sort();return {valid:missing.length===0&&extra.length===0,missing,extra};}',
};
const tool=(taskId,extra={})=>({id:'verified-'+taskId,curriculumTaskId:taskId,passed:true,source:sources[taskId],at:'2026-11-01T12:00:00Z',...extra});
async function fixture(t,options={}){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-experience-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));return {directory,lab:createExperienceLab({directory,...options})};}

test('six fixed families produce deterministic eight-case batches with content hashes independent of order or IDs',()=>{
 for(const taskId of families){
  const cases=generateExperienceCases(taskId,124);assert.equal(cases.length,8);assert.equal(new Set(cases.map(item=>item.id)).size,8);assert.deepEqual(generateExperienceCases(taskId,124),cases);
  const hash=experienceEvidenceHash(taskId,cases);assert.equal(hash,experienceEvidenceHash(taskId,[...cases].reverse().map(item=>({...item,id:'unrelated-new-uuid'}))));assert.notEqual(hash,experienceEvidenceHash(taskId,generateExperienceCases(taskId,125)));
  const canonical=getAutonomousTask(taskId).acceptanceTests;for(const item of cases)assert.ok(!canonical.some(prior=>JSON.stringify(prior.input)===JSON.stringify(item.input)&&JSON.stringify(prior.expected)===JSON.stringify(item.expected)));
  for(const seed of [0,1,4294967295])assert.equal(generateExperienceCases(taskId,seed).length,8);
 }
 assert.throws(()=>generateExperienceCases('private-task',0),/no admitida/);for(const seed of [-1,1.5,4294967296,NaN])assert.throws(()=>generateExperienceCases(families[0],seed),/uint32/);
});

test('DAG oracles preserve newly unlocked lexical choices and distinguish cycles from invalid references',()=>{
 const cases=generateExperienceCases('dag-dependency-plan',124),first=cases[0];assert.equal(first.expected.order[0][0],'b');assert.equal(first.expected.order[1][0],'a');assert.equal(first.expected.order[2][0],'c');
 for(const item of cases.slice(0,6)){
  const deps=new Map(item.input.tasks.map(task=>[task.id,task.dependsOn])),done=new Set(),blocked=new Set(item.expected.blocked);
  assert.equal(new Set([...item.expected.order,...blocked]).size,deps.size);
  for(const id of item.expected.order){assert.ok(deps.get(id).every(dep=>done.has(dep)));const ready=[...deps.keys()].filter(candidate=>!done.has(candidate)&&deps.get(candidate).every(dep=>done.has(dep))).sort();assert.equal(id,ready[0]);done.add(id);}
  for(const id of blocked)assert.ok(deps.get(id).some(dep=>blocked.has(dep)));
 }
 assert.ok(cases[4].expected.blocked.length>=3);assert.ok(cases[5].expected.blocked.length>=2);assert.deepEqual(cases[6].expected,{error:'invalid_tasks'});assert.deepEqual(cases[7].expected,{error:'invalid_tasks'});
});

test('JSON Pointer scenarios keep escaping order, literal percent keys, empty tokens and full syntax validation',()=>{
 const cases=generateExperienceCases('json-pointer-resolve',124);
 assert.deepEqual(cases[0].expected,{found:true,value:cases[0].input.document});assert.equal(cases[1].expected.found,true);assert.equal(cases[2].input.pointer,'/~01');assert.deepEqual(cases[2].expected,{found:true,value:cases[2].input.document['~1']});
 assert.deepEqual(cases[4].expected,{found:false,error:'not_found'});assert.deepEqual(cases[5].expected,{found:false,error:'invalid_pointer'});assert.deepEqual(cases[6].expected,{found:true,value:cases[6].input.document.outer['']});assert.equal(cases[7].expected.found,true);
});

test('prepare is non-executing and a missing capability is an explicit unmet gap with no invented pass',async t=>{
 const {lab,directory}=await fixture(t,{execute:async()=>assert.fail('No available tool may execute')});
 const preview=lab.prepare({taskId:'dag-dependency-plan',seed:124});await assert.rejects(fs.access(path.join(directory,'experience-lab.json')));
 const result=await lab.experiment({taskId:preview.taskId,seed:124,tools:[]});assert.equal(result.evidenceHash,preview.evidenceHash);assert.deepEqual(result.cases,preview.cases);assert.equal(result.reason,'unmet_gap');assert.equal(result.executed,false);assert.equal(result.newEvidence,false);assert.equal(result.passed,null);assert.equal(result.baselinePassed,null);assert.equal(result.toolId,null);assert.deepEqual(result.regressionCases,[]);
 const status=await lab.status();assert.equal(status.executedExperiments,0);assert.equal(status.newEvidenceCount,0);assert.equal(status.unmetGapRequests,1);
});

test('independent reference implementations actually pass canonical and new cases in the real CPU QuickJS sandbox',async t=>{
 const {lab}=await fixture(t);for(const taskId of families){const result=await lab.experiment({taskId,seed:124,tools:[tool(taskId)]});assert.equal(result.executed,true,taskId);assert.equal(result.baselinePassed,8,taskId);assert.equal(result.passed,8,taskId);assert.equal(result.total,8);assert.equal(result.newEvidence,true);assert.deepEqual(result.failures,[]);}
 const status=await lab.status();assert.equal(status.executedExperiments,6);assert.equal(status.newEvidenceCount,6);assert.equal(status.counterexampleExperiments,0);
});

test('a novel counterexample refutes an historically approved tool without hiding the eight passing baseline cases',async t=>{
 const {lab}=await fixture(t),correct=sources['json-pointer-resolve'].replace('function transform(input)','function correct(input)');
 const bad=correct+'\nfunction transform(input){if(input&&input.document&&Object.hasOwn(input.document,"items"))return {found:false,error:"not_found"};return correct(input);}';
 const result=await lab.experiment({taskId:'json-pointer-resolve',seed:124,tools:[tool('json-pointer-resolve',{source:bad})]});assert.equal(result.baselinePassed,8);assert.ok(result.passed<8);assert.equal(result.reason,'counterexample_found');assert.equal(result.newEvidence,true);assert.ok(result.failures.some(failure=>failure.reason==='wrong_output'));assert.deepEqual(result.regressionCases,result.failures.map(({input,expected})=>({input,expected})));
});

test('mutation is independently observed even when returned values match the output oracle',async t=>{
 const {lab}=await fixture(t),correct=sources['json-pointer-resolve'].replace('function transform(input)','function correct(input)'),mutating=correct+'\nfunction transform(input){const out=correct(input);if(input&&typeof input==="object")input.mutated=true;return out;}';
 const result=await lab.experiment({taskId:'json-pointer-resolve',seed:125,tools:[tool('json-pointer-resolve',{source:mutating})]});assert.equal(result.executed,true);assert.equal(result.passed,0);assert.ok(result.failures.every(failure=>failure.reason==='input_mutation'&&failure.inputUnchanged===false));assert.equal((await lab.status()).counterexampleExperiments,1);
});

test('new tool UUIDs do not replay identical evidence, while a changed source can be compared without inventing new scenarios',async t=>{
 let calls=0;const {lab}=await fixture(t,{execute:async(...args)=>{calls++;return executePure(...args);}}),taskId='dag-dependency-plan';
 const first=await lab.experiment({taskId,seed:124,tools:[tool(taskId)]});assert.equal(calls,16);
 const replay=await lab.experiment({taskId,seed:124,tools:[tool(taskId,{id:'a-new-uuid',at:'2026-11-01T13:00:00Z'})]});assert.equal(replay.reason,'repeated_evidence');assert.equal(replay.evidenceHash,first.evidenceHash);assert.equal(replay.executed,false);assert.equal(replay.passed,null);assert.equal(replay.newEvidence,false);assert.equal(calls,16);
 const changed=await lab.experiment({taskId,seed:124,tools:[tool(taskId,{source:sources[taskId]+'\n// revised source',at:'2026-11-01T14:00:00Z'})]});assert.equal(changed.executed,true);assert.equal(changed.passed,8);assert.equal(changed.newEvidence,false);assert.equal(calls,32);assert.equal((await lab.status()).newEvidenceCount,1);
});

test('cancellation records no completed evidence, execution failures remain negative and stored jobs are bounded',async t=>{
 const controller=new AbortController(),cancelled=await fixture(t,{execute:async()=>{controller.abort(Error('foreground'));throw controller.signal.reason;}});
 await assert.rejects(cancelled.lab.experiment({taskId:'stable-dedupe',seed:124,tools:[tool('stable-dedupe')],signal:controller.signal}),/foreground/);assert.equal((await cancelled.lab.status()).requests,0);assert.equal((await cancelled.lab.status()).newEvidenceCount,0);
 const failed=await fixture(t,{execute:async()=>{throw Error('C:/private/error details');}}),result=await failed.lab.experiment({taskId:'stable-dedupe',seed:124,tools:[tool('stable-dedupe')]});assert.equal(result.executed,true);assert.equal(result.passed,0);assert.equal(result.baselinePassed,0);assert.ok(result.failures.every(item=>item.reason==='execution_error'));assert.doesNotMatch(JSON.stringify(result),/C:\/private/);
 const bounded=await fixture(t,{execute:async()=>assert.fail('No tool')});for(let seed=0;seed<101;seed++)await bounded.lab.experiment({taskId:'stable-dedupe',seed,tools:[]});assert.equal((await bounded.lab.status()).jobsStored,100);assert.equal((await bounded.lab.status()).newEvidenceCount,0);
});

test('the newest passed source is experimentally checked and returned status cannot rewrite its evidence',async t=>{
 const {lab}=await fixture(t),taskId='merge-intervals';
 const old=tool(taskId,{id:'older-approved',at:'2026-11-01T10:00:00Z'}),latest=tool(taskId,{id:'latest-approved',at:'2026-11-01T11:00:00Z',source:'function transform(input){return {error:"invalid_intervals"};}',privateNote:'PRIVATE_OWNER_NOTE'}),rejected=tool(taskId,{id:'newest-failed',at:'2026-11-01T12:00:00Z',passed:false});
 const result=await lab.experiment({taskId,seed:124,tools:[latest,old,rejected]});assert.equal(result.toolId,'latest-approved');assert.ok(result.passed<8);assert.ok(result.baselinePassed<8);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_OWNER_NOTE|function transform/);
 const status=await lab.status();status.last.passed=999;status.last.cases[0].input.intervals=[];const untouched=await lab.status();assert.equal(untouched.last.passed,result.passed);assert.deepEqual(untouched.last.cases,result.cases);
});

test('three complete distinct batches saturate one source and coverage without testing a fourth seed or UUID',async t=>{
 let calls=0;const {lab,directory}=await fixture(t,{execute:async(...args)=>{calls++;return executePure(...args);}}),taskId='stable-dedupe',tools=[tool(taskId)];
 const first=lab.prepare({taskId,seed:1}),other=lab.prepare({taskId,seed:2});assert.equal(first.coverageHash,other.coverageHash);assert.notEqual(first.evidenceHash,other.evidenceHash);
 assert.equal((await lab.eligibility({taskId,tools})).eligible,true);assert.equal(calls,0);
 for(const seed of [1,2,3]){const result=await lab.experiment({taskId,seed,tools});assert.equal(result.passed,8);assert.equal(result.baselinePassed,8);}
 const eligible=await lab.eligibility({taskId,tools});assert.equal(eligible.eligible,false);assert.equal(eligible.reason,'coverage_saturated');assert.equal(eligible.successfulBatches,3);assert.equal(eligible.contradictoryBatches,0);assert.equal(calls,48);
 const skipped=await lab.experiment({taskId,seed:999,tools:[tool(taskId,{id:'different-uuid'})]});assert.equal(skipped.executed,false);assert.equal(skipped.reason,'coverage_saturated');assert.equal(skipped.newEvidence,false);assert.equal(calls,48);
 const resumed=createExperienceLab({directory,execute:async()=>assert.fail('No replay after restart')});assert.equal((await resumed.eligibility({taskId,tools})).reason,'coverage_saturated');
 const changed=[tool(taskId,{source:sources[taskId]+'\n// changed source'})];assert.equal((await lab.eligibility({taskId,tools:changed})).eligible,true);assert.equal((await lab.experiment({taskId,seed:4,tools:changed})).passed,8);assert.equal(calls,64);
 for(let seed=1000;seed<1101;seed++)await lab.experiment({taskId:'lor-omega-schema',seed,tools:[]});
 assert.equal((await lab.status()).jobsStored,100);assert.equal((await lab.eligibility({taskId,tools})).reason,'coverage_saturated');assert.equal(calls,64,'evicting detailed jobs must not erase the coverage ledger');
});

test('refuted batches and arbitrary regression strings cannot manufacture clean saturation or new coverage',async t=>{
 const {lab}=await fixture(t),taskId='json-pointer-resolve',correct=sources[taskId].replace('function transform(input)','function correct(input)'),bad=correct+'\nfunction transform(input){if(input&&input.document&&Object.hasOwn(input.document,"items"))return {found:false,error:"not_found"};return correct(input);}';
 for(const seed of [11,12,13]){const result=await lab.experiment({taskId,seed,tools:[tool(taskId,{source:bad})]});assert.ok(result.failures.length>0);}
 const failed=await lab.eligibility({taskId,tools:[tool(taskId,{source:bad})]});assert.equal(failed.eligible,true);assert.equal(failed.successfulBatches,0);assert.equal(failed.contradictoryBatches,3);
 const clean=[tool(taskId)];for(const seed of [21,22,23])await lab.experiment({taskId,seed,tools:clean});
 const saturated=await lab.eligibility({taskId,tools:clean}),unwitnessed={input:{document:{new:'seed-only'},pointer:'/new'},expected:{found:true,value:'seed-only'}};
 const invented=await lab.eligibility({taskId,tools:[tool(taskId,{regressionTests:[unwitnessed]})]});assert.equal(invented.coverageHash,saturated.coverageHash);assert.equal(invented.reason,'coverage_saturated');
});

test('a witnessed noncanonical counterexample expands directed coverage and is actually rechecked with the baseline',async t=>{
 const {lab}=await fixture(t),taskId='json-pointer-resolve',correct=sources[taskId].replace('function transform(input)','function correct(input)'),bad=correct+'\nfunction transform(input){if(input&&input.document&&Object.hasOwn(input.document,"items"))return {found:false,error:"not_found"};return correct(input);}';
 const refuted=await lab.experiment({taskId,seed:41,tools:[tool(taskId,{source:bad})]});assert.ok(refuted.failures.length);
 for(const seed of [42,43,44])await lab.experiment({taskId,seed,tools:[tool(taskId)]});
 const before=await lab.eligibility({taskId,tools:[tool(taskId)]});assert.equal(before.reason,'coverage_saturated');
 const regression=refuted.regressionCases[0],inherited=[tool(taskId,{regressionTests:[regression]})],after=await lab.eligibility({taskId,tools:inherited});
 assert.equal(after.sourceHash,before.sourceHash);assert.notEqual(after.coverageHash,before.coverageHash);assert.equal(after.eligible,true);
 const result=await lab.experiment({taskId,seed:45,tools:inherited});assert.equal(result.executed,true);assert.equal(result.baselineTotal,9);assert.equal(result.baselinePassed,9);assert.equal(result.passed,8);
 for(let seed=2000;seed<2101;seed++)await lab.experiment({taskId:'lor-omega-schema',seed,tools:[]});
 const retained=await lab.eligibility({taskId,tools:inherited});assert.equal(retained.coverageHash,after.coverageHash);assert.equal(retained.eligible,true);assert.ok((await lab.status()).counterexamplesStored>0);
 const next=await lab.experiment({taskId,seed:46,tools:inherited});assert.equal(next.baselineTotal,9);assert.equal(next.baselinePassed,9);
});

test('legacy jobs migrate conservatively without losing previous evidence, counters or fields',async t=>{
 const {lab,directory}=await fixture(t),taskId='lor-omega-schema',tools=[tool(taskId)];for(const seed of [61,62,63])await lab.experiment({taskId,seed,tools});
 const file=path.join(directory,'experience-lab.json'),legacy=JSON.parse(await fs.readFile(file,'utf8'));delete legacy.coverageLedger;delete legacy.coverageSkipped;for(const job of legacy.jobs){delete job.coverageHash;delete job.coverageVersion;}legacy.unrelatedPreserved={value:17};
 await fs.writeFile(file,JSON.stringify(legacy));const before=structuredClone(legacy),resumed=createExperienceLab({directory,execute:async()=>assert.fail('Metadata migration must not run code')});
 assert.equal((await resumed.eligibility({taskId,tools})).reason,'coverage_saturated');
 const saved=JSON.parse(await fs.readFile(file,'utf8'));assert.deepEqual(saved.jobs,before.jobs);assert.deepEqual(saved.executedPairs,before.executedPairs);assert.deepEqual(saved.evidenceHashes,before.evidenceHashes);assert.equal(saved.executedExperiments,before.executedExperiments);assert.deepEqual(saved.unrelatedPreserved,before.unrelatedPreserved);
});

test('passing a new batch cannot hide a failed baseline or count toward saturation',async t=>{
 const {lab}=await fixture(t),taskId='stable-dedupe',correct=sources[taskId].replace('function transform(input)','function correct(input)'),bad=correct+'\nfunction transform(input){if(input&&Array.isArray(input.values)&&input.values.length===0)return {values:["wrong"]};return correct(input);}';
 for(const seed of [71,72,73]){const result=await lab.experiment({taskId,seed,tools:[tool(taskId,{source:bad})]});assert.equal(result.passed,8);assert.equal(result.baselinePassed,7);assert.equal(result.reason,'counterexample_found');}
 const value=await lab.eligibility({taskId,tools:[tool(taskId,{source:bad})]});assert.equal(value.successfulBatches,0);assert.equal(value.contradictoryBatches,3);assert.equal(value.eligible,true);
});

test('unbacked stored counters cannot fabricate saturation and invalid legacy batch hashes do not count',async t=>{
 const {lab,directory}=await fixture(t),taskId='stable-dedupe',tools=[tool(taskId)];await lab.experiment({taskId,seed:81,tools});
 const file=path.join(directory,'experience-lab.json'),stored=JSON.parse(await fs.readFile(file,'utf8'));stored.coverageLedger[0].successfulBatches=3;stored.coverageLedger[0].batchHashes=[];
 await fs.writeFile(file,JSON.stringify(stored));const resumed=createExperienceLab({directory,execute:async()=>assert.fail('Unverified counters cannot authorize code')});
 const result=await resumed.eligibility({taskId,tools});assert.equal(result.reason,'coverage_unverified');assert.equal(result.successfulBatches,0);assert.equal((await resumed.experiment({taskId,seed:82,tools})).executed,false);
 const legacy={...stored,coverageLedger:undefined};legacy.jobs[0].evidenceHash='0'.repeat(64);await fs.writeFile(file,JSON.stringify(legacy));
 const repaired=createExperienceLab({directory,execute:async()=>assert.fail('Metadata only')});const verified=await repaired.eligibility({taskId,tools});assert.equal(verified.reason,'ready');assert.equal(verified.successfulBatches,0);
});
