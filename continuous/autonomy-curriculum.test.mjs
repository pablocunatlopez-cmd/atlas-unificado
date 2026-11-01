import test from 'node:test';
import assert from 'node:assert/strict';
import {getAutonomousTask, selectAutonomousTask as selectAllTasks} from './autonomy-curriculum.mjs';
import {checkToolContract} from './tool-contract.mjs';
import {validateAcceptance} from './extensions.mjs';

const ids = ['merge-intervals', 'stable-dedupe', 'numeric-statistics'];
const lorId = 'lor-omega-schema';
const allIds = [lorId, ...ids];
const now = Date.parse('2026-10-31T12:00:00.000Z');
const hour = 60 * 60 * 1000;
const accepted = id => ({curriculumTaskId: id, passed: true});
const failed = (id, hoursAgo = 25, extra = {}) => ({taskId: id, passed: false, at: new Date(now - hoursAgo * hour).toISOString(), ...extra});
// Preserve every pre-existing selector regression with the new priority task
// already completed. The original histories and failure budgets are unchanged.
const selectAutonomousTask = (extensions=[],history=[],options={}) => selectAllTasks(Array.isArray(extensions)?[accepted(lorId),...extensions]:extensions,history,options);

// Independent reference functions verify the manually specified JSON results
// in the real sandbox. These implementations are not given to the generator.
const references = {
  'lor-omega-schema': 'function transform(input) { const required=["O","A","X","R","T","I","C","E","M","P","F","Σ"]; const s=input && typeof input === "object" && !Array.isArray(input) ? input.S : null; if(!s || typeof s !== "object" || Array.isArray(s)) return {valid:false,missing:required,extra:[]}; const keys=Object.keys(s), missing=required.filter(key=>!keys.includes(key)), extra=keys.filter(key=>!required.includes(key)).sort(); return {valid:missing.length===0 && extra.length===0,missing,extra}; }',
  'merge-intervals': 'function transform(input) { if (!input || !Array.isArray(input.intervals) || input.intervals.some(x => !Array.isArray(x) || x.length !== 2 || x.some(v => typeof v !== "number" || !Number.isFinite(v)))) return {error:"invalid_intervals"}; const ranges=input.intervals.map(x => [Math.min(...x),Math.max(...x)]).sort((a,b) => a[0]-b[0]); const out=[]; for(const range of ranges) { const last=out[out.length-1]; if(last && range[0]<=last[1]) last[1]=Math.max(last[1],range[1]); else out.push(range); } return {intervals:out}; }',
  'stable-dedupe': 'function transform(input) { if(!input || !Array.isArray(input.values) || input.values.some(v => v !== null && !(typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))))) return {error:"invalid_values"}; return {values:input.values.filter((v,i,values) => values.indexOf(v)===i)}; }',
  'numeric-statistics': 'function transform(input) { if(!input || !Array.isArray(input.values) || input.values.some(v => typeof v !== "number" || !Number.isFinite(v))) return {error:"invalid_numbers"}; const a=input.values; let sum=0; for(const v of a) {sum+=v;if(!Number.isFinite(sum)) return {error:"invalid_numbers"};} if(!a.length) return {count:0,sum:0,min:null,max:null,mean:null,median:null}; const sorted=[...a].sort((a,b)=>a-b), n=sorted.length, m=Math.floor(n/2); return {count:n,sum,min:sorted[0],max:sorted[n-1],mean:sum/n,median:n%2?sorted[m]:(sorted[m-1]+sorted[m])/2}; }'
};

test('all tasks have bounded independent contracts and refutable learning plans', () => {
  for (const id of allIds) {
    const item = getAutonomousTask(id);
    assert.equal(item.id, id);
    assert.ok(item.task.length <= 4000);
    assert.match(item.task, /function transform\(input\)/);
    assert.equal(item.acceptanceTests.length, 8);
    assert.deepEqual(validateAcceptance(item.acceptanceTests), item.acceptanceTests);
    assert.ok(item.learningPlan.hypothesis);
    assert.ok(item.learningPlan.refutations.length >= 3);
    assert.match(item.learningPlan.scope, /no modifica/);
    assert.equal(Object.hasOwn(item, 'source'), false);
  }
  assert.equal(getAutonomousTask('unknown'), null);
});

test('callers cannot mutate the canonical tasks or acceptance cases', () => {
  const original = getAutonomousTask(ids[0]);
  const changed = getAutonomousTask(ids[0]);
  changed.acceptanceTests[0].expected.intervals.push([1, 99]);
  changed.learningPlan.refutations.length = 0;
  changed.task = 'changed';
  assert.deepEqual(getAutonomousTask(ids[0]), original);
});

for (const id of allIds) {
  test(`${id}: independently written reference satisfies every sandbox contract`, async () => {
    const item = getAutonomousTask(id);
    const result = await checkToolContract({name: item.name, source: references[id], tests: item.acceptanceTests.slice(0, 2), acceptanceTests: item.acceptanceTests});
    assert.equal(result.contractResults.length, 8);
    assert.equal(result.passed, true, JSON.stringify(result.contractResults.filter(t => !t.passed)));
  });
}

test('external cases refute a constant function despite its passing model examples', async () => {
  for (const id of allIds) {
    const item = getAutonomousTask(id);
    const first = item.acceptanceTests[0];
    const result = await checkToolContract({name: item.name, source: `function transform(input) { return ${JSON.stringify(first.expected)}; }`, tests: [first], acceptanceTests: item.acceptanceTests});
    assert.equal(result.modelResults[0].passed, true);
    assert.equal(result.passed, false);
    assert.ok(result.contractResults.some(t => !t.passed));
  }
});

test('LOR is the next pending priority while previous approvals, failures and exhaustion remain intact',()=>{
 assert.equal(selectAllTasks([],[],{now}).id,lorId);
 assert.equal(selectAllTasks(ids.map(accepted),[],{now}).id,lorId);
 assert.equal(selectAllTasks([accepted(lorId)],[],{now}).id,ids[0]);
 assert.equal(selectAllTasks([], [failed(lorId,1)], {now}).id,ids[0]);
 assert.equal(selectAllTasks([accepted(ids[0])], [failed(lorId,1)], {now}).id,ids[1]);
 const history=[failed(lorId,90),failed(lorId,60),failed(lorId,25)];
 assert.equal(selectAllTasks([],history,{now}).id,ids[0]);
 assert.equal(selectAllTasks(allIds.map(accepted),history,{now}),null);
});

test('LOR contracts preserve the original twelve symbols, null presence and deterministic diagnostics',()=>{
 const task=getAutonomousTask(lorId),fields=['O','A','X','R','T','I','C','E','M','P','F','Σ'];
 assert.deepEqual(Object.keys(task.acceptanceTests[0].input.S),fields);
 assert.deepEqual(task.acceptanceTests[0].expected,{valid:true,missing:[],extra:[]});
 assert.deepEqual(task.acceptanceTests[1].expected.missing,['E']);
 assert.deepEqual(task.acceptanceTests[2].expected.extra,['bar','foo']);
 for(const index of [3,4,5,6])assert.deepEqual(task.acceptanceTests[index].expected.missing,fields);
 assert.match(task.task,/E significa escala y A ambiente/);
 assert.match(task.learningPlan.scope,/no modifica.*pesos.*teoría física/);
 const before=getAutonomousTask(lorId);task.acceptanceTests[0].input.S.E='changed';
 assert.deepEqual(getAutonomousTask(lorId),before);
});

test('selects the first unapproved task and stops when every task is approved', () => {
  assert.equal(selectAutonomousTask([], [], {now}).id, ids[0]);
  assert.equal(selectAutonomousTask([accepted(ids[0])], [], {now}).id, ids[1]);
  assert.equal(selectAutonomousTask(ids.map(accepted), [], {now}), null);
  assert.equal(selectAutonomousTask([{taskId: ids[0], passed: false}], [], {now}).id, ids[0]);
});

test('recent failures pause only their task; exact 24h boundary allows retry', () => {
  assert.equal(selectAutonomousTask([], [failed(ids[0], 23.999)], {now}).id, ids[1]);
  assert.equal(selectAutonomousTask([], [failed(ids[0], 24)], {now}).id, ids[0]);
  assert.equal(selectAutonomousTask([], [failed(ids[0], 30), failed(ids[0], 1)], {now}).id, ids[1]);
  assert.equal(selectAutonomousTask([], ids.map(id => failed(id, 1)), {now}), null);
});

test('three attempts permanently exhaust one task even after cooldown', () => {
  const history = [failed(ids[0], 90), failed(ids[0], 60), failed(ids[0], 25)];
  assert.equal(selectAutonomousTask([], history.slice(0, 2), {now}).id, ids[0]);
  assert.equal(selectAutonomousTask([], history, {now}).id, ids[1]);
  assert.equal(selectAutonomousTask([accepted(ids[1]), accepted(ids[2])], history, {now}), null);
});

test('persisted review candidates count and duplicate candidate IDs count once', () => {
  const candidate = {id: 'attempt-1', curriculumTaskId: ids[0], passed: false};
  const record = {at: new Date(now - 25 * hour).toISOString(), candidate};
  assert.equal(selectAutonomousTask([], [record, record, record], {now}).id, ids[0]);
  assert.equal(selectAutonomousTask([], [record, {...record, candidate: {...candidate, id: 'attempt-2'}}, {...record, candidate: {...candidate, id: 'attempt-3'}}], {now}).id, ids[1]);
  assert.equal(selectAutonomousTask([], [{at: new Date(now - hour).toISOString(), candidate}], {now}).id, ids[1]);
});

test('invalid or future failure timestamps cannot bypass the cooldown', () => {
  for (const at of [undefined, 'invalid-date', new Date(now + hour).toISOString()]) {
    assert.equal(selectAutonomousTask([], [failed(ids[0], 25, {at})], {now}).id, ids[1]);
  }
});

test('unrelated history and reviews without a candidate do not consume attempts', () => {
  const history = [null, {candidate: null}, {at: new Date(now).toISOString(), checks: []}, failed('unknown', 1), {taskId: ids[0], note: 'planned, never attempted'}];
  assert.equal(selectAutonomousTask([], history, {now}).id, ids[0]);
  assert.throws(() => selectAutonomousTask([], [], {now: 'invalid-date'}), /fecha/);
  assert.throws(() => selectAutonomousTask({}, []), /listas/);
});

test('la rotación de informes no borra fallos ni límites de candidatas persistidas',()=>{
 const candidate={id:'persisted-failure',curriculumTaskId:ids[0],passed:false,at:new Date(now-hour).toISOString()};
 assert.equal(selectAutonomousTask([candidate],[],{now}).id,ids[1]);
 const older=[1,2,3].map((n)=>({...candidate,id:'persistent-'+n,at:new Date(now-30*hour).toISOString()}));
 assert.equal(selectAutonomousTask(older,[],{now}).id,ids[1]);
});
