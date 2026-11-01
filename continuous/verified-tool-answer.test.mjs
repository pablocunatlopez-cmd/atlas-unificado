import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatVerifiedToolAnswer} from './verified-tool-answer.mjs';

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
