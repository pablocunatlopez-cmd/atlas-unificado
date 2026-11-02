import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatVerifiedToolAnswer,formatExecutedToolAnswer} from './verified-tool-answer.mjs';
import {LEARNING_CATALOG} from './learning-status.mjs';

const run=(tasks,order,blocked=[],extra={})=>({used:true,curriculumTaskId:'dag-dependency-plan',input:{tasks},result:{order,blocked},...extra});
function payload(answer){const lines=answer.split('\n');assert.match(lines[2],/^`{3,}json$/);assert.equal(lines.at(-1),lines[2].slice(0,-4));return JSON.parse(lines.slice(3,-1).join('\n'));}
const graph=[{id:'release',dependsOn:['test','docs']},{id:'test',dependsOn:['build']},{id:'docs',dependsOn:[]},{id:'build',dependsOn:[]}];

test('a new verified graph is rendered exactly without inventing edges, optimality or task execution',()=>{
 const result={order:['build','docs','test','release'],blocked:[]},answer=formatVerifiedToolAnswer(run(graph,result.order));
 assert.deepEqual(payload(answer),result);assert.doesNotMatch(answer,/→|->|óptim|optimal|ejecut|UUID|2026/);
 const repeated=formatVerifiedToolAnswer(run(graph,result.order));assert.equal(repeated,answer);
});

test('cycles retain the exact partial order and blocked descendants, including self-dependencies',()=>{
 const tasks=[{id:'a',dependsOn:['b']},{id:'b',dependsOn:['a']},{id:'child',dependsOn:['b','root']},{id:'root',dependsOn:[]}];
 assert.deepEqual(payload(formatVerifiedToolAnswer(run(tasks,['root'],['a','b','child']))),{order:['root'],blocked:['a','b','child']});
 assert.deepEqual(payload(formatVerifiedToolAnswer(run([{id:'self',dependsOn:['self']},{id:'root',dependsOn:[]}],['root'],['self']))),{order:['root'],blocked:['self']});
 assert.deepEqual(payload(formatVerifiedToolAnswer(run([],[]))),{order:[],blocked:[]});
 assert.deepEqual(payload(formatVerifiedToolAnswer(run([{id:'a',dependsOn:[]},{id:'b',dependsOn:['a','a']}],['a','b']))),{order:['a','b'],blocked:[]});
});

test('a result must partition all input IDs once and respect the actual dependency predicates',()=>{
 for(const result of [
  {order:['build','docs','test'],blocked:[]},
  {order:['build','docs','test','release','extra'],blocked:[]},
  {order:['build','build','test','release'],blocked:[]},
  {order:['build','docs','test'],blocked:['test']},
  {order:['test','build','docs','release'],blocked:[]},
  {order:['build','test','release'],blocked:['docs']},
  {order:['build','docs','test'],blocked:['release']},
  {order:['build','docs','test',4],blocked:[]},
  {order:'build,docs,test,release',blocked:[]},
  {order:['build','docs','test','release'],blocked:[],explanation:'invented'}
 ])assert.equal(formatVerifiedToolAnswer({...run(graph,[]),result}),null);
 for(const tasks of [[{id:'x',dependsOn:['missing']}],[{id:'x',dependsOn:[]},{id:'x',dependsOn:[]}],[{id:'',dependsOn:[]}],[{id:'x',dependsOn:'root'}],[{id:4,dependsOn:[]}]])assert.equal(formatVerifiedToolAnswer(run(tasks,['x'])),null);
 assert.equal(formatVerifiedToolAnswer(run([{id:'x',dependsOn:['x']}],['x'])),null);
});

test('only the canonical used DAG tool and a present input can produce an answer',()=>{
 const valid=run(graph,['build','docs','test','release']);
 for(const changes of [{used:false},{used:'true'},{curriculumTaskId:'numeric-statistics'},{curriculumTaskId:undefined},{error:'sandbox_failed'},{result:null},{result:[]},{input:undefined}])assert.equal(formatVerifiedToolAnswer({...valid,...changes}),null);
 const missing={...valid};delete missing.input;assert.equal(formatVerifiedToolAnswer(missing),null);
 assert.equal(formatVerifiedToolAnswer(null),null);assert.equal(formatVerifiedToolAnswer({}),null);
});

test('only the recognised invalid_tasks result has a deterministic error answer',()=>{
 const toolRun={used:true,curriculumTaskId:'dag-dependency-plan',input:null,result:{error:'invalid_tasks'}};
 assert.equal(formatVerifiedToolAnswer(toolRun),'Datos de tareas no válidos. Revisa los ID únicos y las dependencias.');
 for(const result of [{error:'unknown'},{error:'invalid_tasks',order:[]},{message:'invalid_tasks'},'invalid_tasks'])assert.equal(formatVerifiedToolAnswer({...toolRun,result}),null);
 const missing={...toolRun};delete missing.input;assert.equal(formatVerifiedToolAnswer(missing),null);
});

test('task names remain exact JSON data even with Markdown fences, links, quotes and line breaks',()=>{
 const name='task\n``````\n[link](https://example.invalid) "quoted" \\ end';
 const answer=formatVerifiedToolAnswer(run([{id:name,dependsOn:[]}],[name]));
 assert.deepEqual(payload(answer),{order:[name],blocked:[]});assert.match(answer.split('\n')[2],/^`{7}json$/);
 const metadata=run([{id:'task',dependsOn:[],privateNote:'PRIVATE_TASK_NOTE'}],['task'],[],{toolId:'68a05686-1111-4111-8111-111111111111',at:'2026-11-01T12:00:00Z',name:'PRIVATE_TOOL_NAME',scope:'PRIVATE_SCOPE'});
 const text=formatVerifiedToolAnswer(metadata);assert.doesNotMatch(text,/68a05686|2026-11|PRIVATE_/);assert.deepEqual(payload(text),{order:['task'],blocked:[]});
});

test('formatting has bounded input and output and never mutates the measured run',()=>{
 const value=run(graph,['build','docs','test','release']),before=structuredClone(value);formatVerifiedToolAnswer(value);assert.deepEqual(value,before);
 const tooMany=Array.from({length:257},(_,i)=>({id:'task-'+i,dependsOn:[]}));assert.equal(formatVerifiedToolAnswer(run(tooMany,tooMany.map(task=>task.id))),null);
 const long='x'.repeat(257);assert.equal(formatVerifiedToolAnswer(run([{id:long,dependsOn:[]}],[long])),null);
 const oversized=run([{id:'task',dependsOn:[]}],['task']);oversized.input.extra='x'.repeat(30000);assert.equal(formatVerifiedToolAnswer(oversized),null);
 const cyclic=run([{id:'task',dependsOn:[]}],['task']);cyclic.input.self=cyclic.input;assert.equal(formatVerifiedToolAnswer(cyclic),null);
 const names=Array.from({length:80},(_,i)=>('task-'+i+'-').padEnd(205,'x'));const large=run(names.map(id=>({id,dependsOn:[]})),names);assert.equal(formatVerifiedToolAnswer(large),null);
});

const statistics={used:true,toolId:'PRIVATE_STATS_ID',name:'PRIVATE_STATS_NAME',curriculumTaskId:'numeric-statistics',input:{values:[1,2,4],privateNote:'PRIVATE_INPUT_NOTE'},result:{count:3,sum:7,min:1,max:4,mean:7/3,median:2},at:'2026-11-02T09:00:00.000Z'};
function executedPayload(answer){const lines=answer.split('\n'),start=lines.findIndex(line=>/^`{3,}json$/.test(line));assert.ok(start>=0);assert.equal(lines.at(-1),lines[start].slice(0,-4));return JSON.parse(lines.slice(start+1,-1).join('\n'));}
function pipeline(){
 const first={step:1,toolId:'PRIVATE_DEDUPE_ID',name:'PRIVATE_DEDUPE_NAME',curriculumTaskId:'stable-dedupe',inputSource:'literal',input:{values:[1,1,2,4]},result:{values:[1,2,4]},status:'completed',at:'PRIVATE_TIME'};
 const last={step:2,...statistics,inputSource:'previous',input:{values:[1,2,4]},status:'completed'};
 return {...statistics,input:last.input,steps:[first,last]};
}

test('canonical statistics render their exact measured JSON with a public name and no private metadata',()=>{
 const answer=formatExecutedToolAnswer(statistics);assert.deepEqual(executedPayload(answer),statistics.result);assert.match(answer,/Resultado de ejecución/);assert.ok(answer.includes(LEARNING_CATALOG['numeric-statistics'].name));assert.doesNotMatch(answer,/PRIVATE_|2026-11|valores|probado para todo|mejora/i);assert.deepEqual(statistics.input,{values:[1,2,4],privateNote:'PRIVATE_INPUT_NOTE'});
});

test('a valid pipeline shows the canonical step names and exact final result without reprinting inputs',()=>{
 const value=pipeline(),before=structuredClone(value),answer=formatExecutedToolAnswer(value);assert.deepEqual(executedPayload(answer),statistics.result);assert.match(answer,/Pasos ejecutados/);assert.ok(answer.includes('1. '+LEARNING_CATALOG['stable-dedupe'].name));assert.ok(answer.includes('2. '+LEARNING_CATALOG['numeric-statistics'].name));assert.doesNotMatch(answer,/PRIVATE_|2026-11|"values"/);assert.deepEqual(value,before);
});

test('partial, unknown, inconsistent or fabricated pipeline records never become an execution answer',()=>{
 for(const changes of [{used:false},{used:'true'},{partial:true},{failedStep:2},{error:'failed'},{curriculumTaskId:'custom-tool'},{toolId:null},{steps:[]},{steps:null},{result:undefined}])assert.equal(formatExecutedToolAnswer({...statistics,...changes}),null);
 for(const alter of [
  value=>value.steps[0].status='failed',value=>value.steps[0].curriculumTaskId='custom-tool',value=>value.steps[0].step=2,value=>value.steps[1].toolId='DIFFERENT_FINAL_ID',value=>value.steps[1].result={count:99},value=>value.steps[1].input={values:[999]},value=>value.steps[0].inputSource='previous',value=>value.steps[1].inputSource='previous.values',value=>value.steps.push(...value.steps)
 ]){const value=pipeline();alter(value);assert.equal(formatExecutedToolAnswer(value),null);}
});

test('single DAG answers retain their existing correctness checks while multi-step DAG results retain provenance',()=>{
 const dag=run(graph,['build','docs','test','release'],[],{toolId:'PRIVATE_DAG_ID'});assert.equal(formatExecutedToolAnswer(dag),formatVerifiedToolAnswer(dag));assert.equal(formatExecutedToolAnswer({...dag,result:{order:['test'],blocked:[]}}),null);
 const input={tasks:[{id:'one',dependsOn:[]}]},value={used:true,toolId:'PRIVATE_DAG_ID',curriculumTaskId:'dag-dependency-plan',input,result:{order:['one'],blocked:[]},steps:[{step:1,toolId:'PRIVATE_PREP_ID',curriculumTaskId:'json-pointer-resolve',inputSource:'literal',input:{value:'PRIVATE_INPUT'},result:input,status:'completed'},{step:2,toolId:'PRIVATE_DAG_ID',curriculumTaskId:'dag-dependency-plan',inputSource:'previous',input,result:{order:['one'],blocked:[]},status:'completed'}]};
 const answer=formatExecutedToolAnswer(value);assert.deepEqual(executedPayload(answer),value.result);assert.match(answer,/Pasos ejecutados/);assert.ok(answer.includes(LEARNING_CATALOG['dag-dependency-plan'].name));assert.doesNotMatch(answer,/PRIVATE_|"tasks"/);
});

test('executed JSON remains safely fenced and bounded without coercing non-JSON values',()=>{
 const result={found:true,value:'line\n```````\n[link](https://example.org) "quoted"'},value={used:true,toolId:'PRIVATE_POINTER',curriculumTaskId:'json-pointer-resolve',result},answer=formatExecutedToolAnswer(value);assert.deepEqual(executedPayload(answer),result);assert.ok(answer.includes('````````json'));
 for(const result of [Infinity,undefined,{number:NaN},{extra:undefined},{value:BigInt(3)},{large:'x'.repeat(16000)}])assert.equal(formatExecutedToolAnswer({...statistics,result}),null);
 const cyclic={};cyclic.self=cyclic;assert.equal(formatExecutedToolAnswer({...statistics,result:cyclic}),null);
});
