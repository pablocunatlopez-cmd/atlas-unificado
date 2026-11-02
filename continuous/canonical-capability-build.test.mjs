import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCanonicalCapability,selectCapabilitySeed} from './canonical-capability-build.mjs';
import {getAutonomousTask} from './autonomy-curriculum.mjs';

const id='5bec18b0-c21a-4a4f-a754-5f3ce4d7c4ce',at='2026-11-02T08:00:00.000Z';
const source='function transform(input){if(!input||typeof input!=="object"||Array.isArray(input)||!Array.isArray(input.values)||input.values.some(v=>v!==null&&(typeof v==="object"||!["number","string","boolean"].includes(typeof v)||typeof v==="number"&&!Number.isFinite(v))))return{error:"invalid_values"};const seen=new Set();const values=[];for(const value of input.values){if(!seen.has(value)){seen.add(value);values.push(value);}}return{values};}';
const built=(changes={})=>({id,at,name:'Model supplied name',task:'Untrusted task',source,passed:true,acceptanceTests:[],acceptanceResults:[{actual:'invented',passed:true}],contractCheck:{passed:true},...changes});

test('a canonical build fixes its contract and records only real sandbox results',async()=>{
 const task=getAutonomousTask('stable-dedupe');let calls=0;
 const candidate=await buildCanonicalCapability(task.id,{build:async(description,cases,options)=>{calls++;assert.equal(description,task.task);assert.deepEqual(cases,task.acceptanceTests);assert.deepEqual(options,{signal:undefined,format:'code',name:task.name,curriculumTaskId:task.id});return built();}});
 assert.equal(calls,1);assert.equal(candidate.passed,true);assert.equal(candidate.id,id);assert.equal(candidate.at,at);
 assert.equal(candidate.name,task.name);assert.equal(candidate.task,task.task);assert.equal(candidate.curriculumTaskId,task.id);
 assert.equal(candidate.origin,'coordinator-curriculum-build');assert.equal(candidate.requestedBy,'local-user');assert.equal(candidate.testOrigin,'external-contract');
 assert.deepEqual(candidate.acceptanceTests,task.acceptanceTests);assert.equal(candidate.acceptanceResults.length,8);
 for(const [index,result] of candidate.acceptanceResults.entries()){assert.equal(result.passed,true);assert.deepEqual(result.actual,task.acceptanceTests[index].expected);assert.deepEqual(result.input,task.acceptanceTests[index].input);}
 assert.equal(candidate.results.length,2);assert.equal(candidate.contractCheck.passed,true);assert.doesNotMatch(JSON.stringify(candidate.acceptanceResults),/invented/);
});

test('claimed eight-for-eight success cannot promote an incorrect function',async()=>{
 const task=getAutonomousTask('stable-dedupe');
 const candidate=await buildCanonicalCapability(task.id,{build:async()=>built({source:'function transform(){return {values:[]};}',acceptanceResults:task.acceptanceTests.map(test=>({...test,actual:test.expected,passed:true}))})});
 assert.equal(candidate.passed,false);assert.equal(candidate.contractCheck.passed,false);assert.equal(candidate.acceptanceResults.length,8);
 assert.ok(candidate.acceptanceResults.some(result=>result.passed===false));assert.deepEqual(candidate.acceptanceResults[1].actual,{values:[]});
});

test('a builder rejection stays rejected even if its source now passes canonical checks',async()=>{
 const candidate=await buildCanonicalCapability('stable-dedupe',{build:async()=>built({passed:false})});
 assert.equal(candidate.passed,false);assert.equal(candidate.contractCheck.passed,true);
});

test('canonical acceptance data is isolated from mutation by the injected builder',async()=>{
 const task=getAutonomousTask('stable-dedupe');
 const candidate=await buildCanonicalCapability(task.id,{build:async(_task,cases)=>{cases[1].expected={values:[]};cases.length=1;return built({acceptanceTests:cases});}});
 assert.equal(candidate.passed,true);assert.deepEqual(candidate.acceptanceTests,task.acceptanceTests);assert.equal(candidate.acceptanceResults.length,8);
});

test('the latest matching history contributes exact regression cases, never unrelated records or mutations',async()=>{
 const task=getAutonomousTask('stable-dedupe'),regression={input:{values:['new-value',false,'new-value']},expected:{values:['new-value',false]}},previous={id:'previous-source',curriculumTaskId:task.id,regressionTests:[regression,regression],tests:[task.acceptanceTests[0]],acceptanceTests:task.acceptanceTests};
 const tools=[{id:'older',curriculumTaskId:task.id,regressionTests:[{input:{values:['old']},expected:{values:['old']}}]},previous,{id:'unrelated',curriculumTaskId:'other',regressionTests:[{input:null,expected:999}]}],before=structuredClone(tools);
 const faulty=source.replace('const seen=new Set();','if(input.values.includes("new-value"))return{values:[]};const seen=new Set();');
 const candidate=await buildCanonicalCapability(task.id,{tools,build:async()=>built({source:faulty})});
 assert.equal(candidate.acceptanceResults.every(item=>item.passed),true);assert.equal(candidate.passed,false);assert.equal(candidate.parentId,previous.id);
 assert.equal(candidate.regressionTests.length,1);assert.deepEqual(candidate.regressionTests[0],regression);assert.ok(candidate.contractCheck.contractResults.slice(8).some(item=>item.passed===false));
 assert.deepEqual(tools,before);
});

test('cancellation before or immediately after building returns no candidate',async()=>{
 const before=new AbortController();before.abort(Error('cancel before'));let builds=0,reads=0;
 await assert.rejects(buildCanonicalCapability('stable-dedupe',{signal:before.signal,build:async()=>{builds++;return built();}}),/cancel before/);assert.equal(builds,0);
 const after=new AbortController();
 await assert.rejects(buildCanonicalCapability('stable-dedupe',{signal:after.signal,build:async()=>{builds++;after.abort(Error('cancel after'));return {get source(){reads++;return source;},passed:true};}}),/cancel after/);
 assert.equal(builds,1);assert.equal(reads,0);
});

test('unknown tasks and invalid builders are rejected before generation; build failures propagate',async()=>{
 let calls=0;
 await assert.rejects(buildCanonicalCapability('unreviewed-task',{build:async()=>{calls++;return built();}}),/desconocida/);assert.equal(calls,0);
 await assert.rejects(buildCanonicalCapability('stable-dedupe'),/constructor/);
 await assert.rejects(buildCanonicalCapability('stable-dedupe',{tools:null,build:async()=>built()}),/lista/);
 await assert.rejects(buildCanonicalCapability('stable-dedupe',{build:async()=>{throw Error('model unavailable');}}),/model unavailable/);
});

test('malformed source or inherited contracts remain refuted records without fabricated execution results',async()=>{
 for(const generated of [undefined,built({source:null}),built({source:'function transform('})]){
  const result=await buildCanonicalCapability('stable-dedupe',{build:async()=>generated});assert.equal(result.passed,false);assert.equal(result.contractCheck.passed,false);assert.ok(result.acceptanceResults.every(item=>item.passed===false));
 }
 const result=await buildCanonicalCapability('stable-dedupe',{tools:[{curriculumTaskId:'stable-dedupe',regressionTests:'bad'}],build:async()=>built()});
 assert.equal(result.passed,false);assert.match(result.contractCheck.error,/contratos anteriores/);assert.deepEqual(result.acceptanceResults,[]);
});

test('independent confirmation can reject a candidate that passes all eight visible development contracts',async()=>{
 const confirmation={input:{values:[13,13]},expected:{values:[13]}};
 const good='function transform(input){if(!input||!Array.isArray(input.values)||input.values.some(v=>v!==null&&typeof v!=="string"&&typeof v!=="boolean"&&!(typeof v==="number"&&Number.isFinite(v))))return {error:"invalid_values"};if(input.values.includes(13))return {values:[]};return {values:[...new Set(input.values)]};}';
 const record=await buildCanonicalCapability('stable-dedupe',{confirmationTests:[confirmation],build:async(_task,cases)=>{assert.equal(cases.length,8);assert.ok(!cases.some(item=>JSON.stringify(item.input)===JSON.stringify(confirmation.input)));return{id:'candidate',at:'2026-11-02T00:00:00Z',source:good,passed:true};}});
 assert.equal(record.passed,false);assert.equal(record.acceptanceResults.filter(item=>item.passed).length,8);assert.ok(record.contractCheck.contractResults.some(item=>item.passed===false&&JSON.stringify(item.input)===JSON.stringify(confirmation.input)));assert.deepEqual(record.regressionTests,[confirmation]);
});

test('a repair starts from the strongest measured source and preserves the latest regression history',async()=>{
 const task=getAutonomousTask('stable-dedupe'),extra={input:{values:[13,13]},expected:{values:[13]}};
 const measured=(code,count)=>task.acceptanceTests.map((t,i)=>({...structuredClone(t),actual:i<count?structuredClone(t.expected):{wrong:true},passed:i<count}));
 const stronger={id:'stronger',curriculumTaskId:task.id,source,passed:false,acceptanceTests:task.acceptanceTests,contractCheck:{contractResults:[...measured(source,8),{...extra,actual:{wrong:true},passed:false}]}};
 const weaker={id:'newer-but-weaker',curriculumTaskId:task.id,source:'function transform(input){return {};}',passed:false,acceptanceTests:task.acceptanceTests,regressionTests:[extra],contractCheck:{contractResults:measured('',7)}};
 const lying={id:'unmeasured',curriculumTaskId:task.id,source:'function transform(input){return null;}',passed:true,acceptanceResults:task.acceptanceTests.map(t=>({...t,passed:true}))};
 const seed=selectCapabilitySeed(task.id,[stronger,weaker,lying]);assert.equal(seed.id,'stronger');assert.equal(seed.initialSource,source);assert.match(seed.initialFeedback,/13/);
 const record=await buildCanonicalCapability(task.id,{tools:[stronger,weaker],build:async(_task,_cases,options)=>{assert.equal(options.initialSource,source);assert.match(options.initialFeedback,/Refutaciones ejecutadas/);return built();}});
 assert.equal(record.passed,true);assert.equal(record.parentId,'newer-but-weaker');assert.equal(record.seedParentId,'stronger');assert.ok(record.regressionTests.some(t=>JSON.stringify(t)===JSON.stringify(extra)));assert.equal(selectCapabilitySeed('unknown',[]),null);
});

test('a confirmation failure feeds a bounded repair automatically and cannot be accepted on development scores alone',async()=>{
 const extra={input:{values:[13,13]},expected:{values:[13]}},bad=source.replace('const seen=new Set();','if(input.values.includes(13))return {values:[]};const seen=new Set();');let calls=0;
 const record=await buildCanonicalCapability('stable-dedupe',{confirmationTests:[extra],build:async(_task,cases,options)=>{calls++;assert.equal(cases.length,8);if(calls===1)return built({id:'first-refuted',source:bad});assert.equal(options.initialSource,bad);assert.match(options.initialFeedback,/13/);return built({id:'repaired',source});}});
 assert.equal(calls,2);assert.equal(record.passed,true);assert.equal(record.repairRounds.length,2);assert.equal(record.repairRounds[0].passed,false);assert.equal(record.repairRounds[0].developmentPassed,8);assert.equal(record.repairRounds[1].passed,true);assert.deepEqual(record.regressionTests,[extra]);
 await assert.rejects(buildCanonicalCapability('stable-dedupe',{maxRounds:4,build:async()=>assert.fail('Invalid budget must not generate')}),/tres rondas/);
});
