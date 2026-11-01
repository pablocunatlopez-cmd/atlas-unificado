import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewCapabilities as reviewAllCapabilities} from './autonomous-review.mjs';
import {getAutonomousTask} from './autonomy-curriculum.mjs';

const mergeSource = 'function transform(input) { if (!input || !Array.isArray(input.intervals) || input.intervals.some(x => !Array.isArray(x) || x.length !== 2 || x.some(v => typeof v !== "number" || !Number.isFinite(v)))) return {error:"invalid_intervals"}; const ranges=input.intervals.map(x => [Math.min(...x),Math.max(...x)]).sort((a,b) => a[0]-b[0]); const out=[]; for(const range of ranges) { const last=out[out.length-1]; if(last && range[0]<=last[1]) last[1]=Math.max(last[1],range[1]); else out.push(range); } return {intervals:out}; }';
const correctSpec = {
  name: 'fusionar_intervalos',
  source: mergeSource,
  tests: [
    {input: {intervals: [[5, 1], [4, 7]]}, expected: {intervals: [[1, 7]]}},
    {input: {intervals: [[-4, -2], [2, 4]]}, expected: {intervals: [[-4, -2], [2, 4]]}}
  ]
};
const constantSpec = {
  name: 'constante_con_ejemplos_enganosos',
  source: 'function transform(input) { return {intervals:[]}; }',
  tests: [
    {input: {intervals: []}, expected: {intervals: []}},
    {input: {intervals: [[1, 2]]}, expected: {intervals: []}}
  ]
};
const answer = spec => ({answer: JSON.stringify(spec)});
const diagnosis = {diagnosis: 'Evaluación de prueba.', limitations: 'Solo contratos ejecutados.', nextAction: 'Conservar resultados.', intervalMinutes: 60};
function approvedLor(){
 const item=getAutonomousTask('lor-omega-schema');
 return {id:'known-lor-tool',curriculumTaskId:item.id,passed:true,name:item.name,source:'function transform(input){const required=["O","A","X","R","T","I","C","E","M","P","F","Σ"],s=input&&typeof input==="object"&&!Array.isArray(input)?input.S:null;if(!s||typeof s!=="object"||Array.isArray(s))return{valid:false,missing:required,extra:[]};const keys=Object.keys(s),missing=required.filter(k=>!keys.includes(k)),extra=keys.filter(k=>!required.includes(k)).sort();return{valid:!missing.length&&!extra.length,missing,extra};}',tests:item.acceptanceTests.slice(0,2),acceptanceTests:item.acceptanceTests};
}

// These regressions exercise the older interval curriculum. New priorities
// have recent failure fixtures here, preserving each original history intact.
function reviewCapabilities(extensions,key,options={}){
 const newerHistory=['json-pointer-resolve','dag-dependency-plan'].map(taskId=>({taskId,passed:false,at:new Date().toISOString()}));
 return reviewAllCapabilities(extensions,key,{...options,history:[...newerHistory,...(options.history||[])]});
}

function offline(t) {
  return t.mock.method(globalThis, 'fetch', async () => { throw new Error('La prueba no permite solicitudes de red.'); });
}

test('creation remains disabled unless explicitly enabled for the review', async t => {
  const request = offline(t);
  let generated = 0;
  const review = await reviewCapabilities([approvedLor()], 'test-local-key', {
    generate: async () => { generated++; return answer(correctSpec); },
    assess: async () => diagnosis
  });
  assert.equal(generated, 0);
  assert.equal(review.candidate, null);
  assert.equal(review.curriculum, null);
  assert.equal(review.nextTask, null);
  assert.equal(review.intervalMinutes, 60);
  assert.equal(request.mock.callCount(), 0);
});
test('repairing a curriculum tool preserves its identity and external contracts for later use',async t=>{
 offline(t);const original={...approvedLor(),task:getAutonomousTask('lor-omega-schema').task},broken={...original,source:'function transform(input){return null;}'};
 const review=await reviewCapabilities([broken],'test-local-key',{generate:async()=>answer({name:original.name,source:original.source,tests:original.tests}),assess:async()=>diagnosis});
 assert.equal(review.checks[0].passed,false);assert.equal(review.candidate.passed,true);
 assert.equal(review.candidate.parentId,original.id);assert.equal(review.candidate.curriculumTaskId,original.curriculumTaskId);
 assert.equal(review.candidate.origin,'autonomous-local-review');assert.deepEqual(review.candidate.acceptanceTests,original.acceptanceTests);
 assert.equal(review.candidate.contractCheck.passed,true);
});

test('autonomous creation accepts a real pure function after all eight independent sandbox contracts', async t => {
  const request = offline(t);
  const generationInputs = [];
  let evidence;
  const review = await reviewCapabilities([approvedLor()], 'test-local-key', {
    allowCreation: true,
    generate: async (input, documents, _request, key) => {
      generationInputs.push(input);
      assert.equal(input.json, true);
      assert.deepEqual(documents, []);
      assert.equal(key, 'test-local-key');
      return answer(correctSpec);
    },
    assess: async input => { evidence = input; return diagnosis; }
  });
  assert.equal(generationInputs.length, 1);
  assert.match(generationInputs[0].messages[0].content, /intervalos/);
  assert.equal(review.candidate.passed, true);
  assert.equal(review.candidate.origin, 'autonomous-local-programming');
  assert.equal(review.candidate.curriculumTaskId, 'merge-intervals');
  assert.equal(review.candidate.attempts.length, 1);
  assert.equal(review.candidate.results.length, 2);
  assert.ok(review.candidate.results.every(result => result.passed));
  assert.equal(review.candidate.acceptanceResults.length, 8);
  assert.ok(review.candidate.acceptanceResults.every(result => result.passed));
  assert.deepEqual(review.candidate.acceptanceTests, getAutonomousTask('merge-intervals').acceptanceTests);
  for (const result of review.candidate.acceptanceResults) assert.deepEqual(result.actual, result.expected);
  assert.equal(review.curriculum.taskId, 'merge-intervals');
  assert.equal(evidence.candidate.passed, true);
  assert.equal(evidence.capabilities.corePolicyEditing, true);
  assert.equal(evidence.capabilities.arbitraryServerEditing, false);
  assert.equal(evidence.capabilities.qwenWeightCandidates, true);
  assert.equal(evidence.capabilities.activeQwenAdapter, false);
  assert.equal(review.intervalMinutes, 5);
  assert.deepEqual(review.nextTask,{taskId:'stable-dedupe',name:getAutonomousTask('stable-dedupe').name});
  assert.equal(request.mock.callCount(), 0);
});

test('passing model examples cannot publish a constant candidate rejected by independent contracts', async t => {
  const request = offline(t);
  const prompts = [];
  let evidence;
  const review = await reviewCapabilities([approvedLor()], 'test-local-key', {
    allowCreation: true,
    generate: async input => { prompts.push(input.messages[0].content); return answer(constantSpec); },
    assess: async input => { evidence = input; return diagnosis; }
  });
  assert.equal(prompts.length, 3, 'buildExtension must stop after its three internal attempts');
  assert.equal(review.candidate.attempt, 3);
  assert.equal(review.candidate.attempts.length, 3);
  assert.equal(review.candidate.passed, false);
  assert.equal(evidence.candidate.passed, false);
  assert.deepEqual(review.nextTask,{taskId:'stable-dedupe',name:getAutonomousTask('stable-dedupe').name});
  assert.equal(review.intervalMinutes,5);
  for (const attempt of review.candidate.attempts) {
    assert.ok(attempt.modelResults.every(result => result.passed));
    assert.equal(attempt.acceptanceResults.length, 8);
    assert.equal(attempt.acceptanceResults.filter(result => result.passed).length, 1);
    assert.equal(attempt.passed, false);
  }
  assert.notEqual(prompts[0], prompts[1], 'a retry must include refutation feedback');
  assert.match(prompts[1], /expected/);
  assert.equal(request.mock.callCount(), 0);
});

test('a counterexample can repair the next candidate without discarding failed evidence', async t => {
  const request = offline(t);
  let generated = 0;
  const review = await reviewCapabilities([approvedLor()], 'test-local-key', {
    allowCreation: true,
    generate: async () => answer(++generated === 1 ? constantSpec : correctSpec),
    assess: async () => diagnosis
  });
  assert.equal(generated, 2);
  assert.equal(review.candidate.passed, true);
  assert.equal(review.candidate.attempts[0].passed, false);
  assert.equal(review.candidate.attempts[1].passed, true);
  assert.equal(review.candidate.attempts[0].acceptanceResults.length, 8);
  assert.equal(review.candidate.attempts[1].acceptanceResults.length, 8);
  assert.equal(request.mock.callCount(), 0);
});

test('persisted failures in cooldown prevent creation from restarting on the next review', async t => {
  const request = offline(t);
  let generated = 0;
  const history = ['merge-intervals', 'stable-dedupe', 'numeric-statistics'].map(curriculumTaskId => ({
    at: new Date().toISOString(),
    candidate: {curriculumTaskId, passed: false}
  }));
  const review = await reviewCapabilities([approvedLor()], 'test-local-key', {
    allowCreation: true,
    history,
    generate: async () => { generated++; return answer(correctSpec); },
    assess: async () => diagnosis
  });
  assert.equal(generated, 0);
  assert.equal(review.candidate, null);
  assert.equal(review.curriculum, null);
  assert.equal(review.nextTask, null);
  assert.equal(review.intervalMinutes, 15);
  assert.equal(request.mock.callCount(), 0);
});

test('a completed final selectable task closes the backlog without accelerating another review',async t=>{
 const request=offline(t);
 const history=['stable-dedupe','numeric-statistics'].map(taskId=>({taskId,passed:false,at:new Date().toISOString()}));
 const review=await reviewCapabilities([approvedLor()],'test-local-key',{
  allowCreation:true,history,generate:async()=>answer(correctSpec),assess:async()=>diagnosis
 });
 assert.equal(review.candidate.passed,true);
 assert.equal(review.candidate.curriculumTaskId,'merge-intervals');
 assert.equal(review.nextTask,null);
 assert.equal(review.intervalMinutes,15);
 assert.equal(request.mock.callCount(),0);
});

test('the current failed attempt enters cooldown before the next task is selected',async t=>{
 const request=offline(t);
 const history=['stable-dedupe','numeric-statistics'].map(taskId=>({taskId,passed:false,at:new Date().toISOString()}));
 const original=structuredClone(history);
 const review=await reviewCapabilities([approvedLor()],'test-local-key',{
  allowCreation:true,history,generate:async()=>answer(constantSpec),assess:async()=>diagnosis
 });
 assert.equal(review.candidate.passed,false);
 assert.equal(review.candidate.curriculumTaskId,'merge-intervals');
 assert.equal(review.nextTask,null);
 assert.equal(review.intervalMinutes,15);
 assert.deepEqual(history,original);
 assert.equal(request.mock.callCount(),0);
});

test('a failed current audit invalidates its old approval for backlog calculation',async t=>{
 const request=offline(t),at=new Date().toISOString();
 const history=['merge-intervals','stable-dedupe','numeric-statistics'].map(taskId=>({taskId,passed:false,at}));
 const broken={...approvedLor(),at:'2026-01-01T00:00:00.000Z',task:getAutonomousTask('lor-omega-schema').task,source:'function transform(input){return null;}'};
 const original=structuredClone(broken);
 const review=await reviewCapabilities([broken],'test-local-key',{
  allowCreation:true,history,generate:async()=>({answer:'invalid'}),assess:async()=>diagnosis
 });
 assert.equal(review.checks[0].passed,false);
 assert.equal(review.candidate.passed,false);
 assert.equal(review.candidate.curriculumTaskId,'lor-omega-schema');
 assert.equal(review.nextTask,null);
 assert.equal(review.intervalMinutes,15);
 assert.deepEqual(broken,original);
 assert.equal(request.mock.callCount(),0);
});

test('pre-cancelled review never generates or assesses and preserves the cancellation reason', async t => {
  const request = offline(t);
  const controller = new AbortController();
  const reason = new Error('El usuario ha detenido la revisión.');
  controller.abort(reason);
  let generated = 0, assessed = 0;
  await assert.rejects(reviewCapabilities([approvedLor()], 'test-local-key', {
    allowCreation: true,
    signal: controller.signal,
    generate: async () => { generated++; return answer(correctSpec); },
    assess: async () => { assessed++; return diagnosis; }
  }), error => error === reason);
  assert.equal(generated, 0);
  assert.equal(assessed, 0);
  assert.equal(request.mock.callCount(), 0);
});

test('cancellation during generation prevents retries, assessment, and a successful review result', async t => {
  const request = offline(t);
  const controller = new AbortController();
  const reason = new Error('Detenido mientras se generaba la candidata.');
  let generated = 0, assessed = 0;
  await assert.rejects(reviewCapabilities([approvedLor()], 'test-local-key', {
    allowCreation: true,
    signal: controller.signal,
    generate: async () => {
      generated++;
      controller.abort(reason);
      return answer(constantSpec);
    },
    assess: async () => { assessed++; return diagnosis; }
  }), error => error === reason);
  assert.equal(generated, 1, 'cancellation must not start the next internal repair attempt');
  assert.equal(assessed, 0, 'cancellation must not start a new assessment');
  assert.equal(request.mock.callCount(), 0);
});
