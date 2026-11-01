import test from 'node:test';
import assert from 'node:assert/strict';
import {buildExtension} from './extensions.mjs';
import {reviewCapabilities as reviewAllCapabilities} from './autonomous-review.mjs';
import {getAutonomousTask} from './autonomy-curriculum.mjs';

const task = 'Devuelve {doubled: input.value * 2} para entradas numéricas.';
const contract = [
  {input: {value: 2}, expected: {doubled: 4}},
  {input: {value: -3}, expected: {doubled: -6}},
  {input: {value: 0}, expected: {doubled: 0}}
];
const source = 'function transform(input) {\n  return {doubled: input.value * 2};\n}';
const mergeSource = 'function transform(input) { if (!input || !Array.isArray(input.intervals) || input.intervals.some(x => !Array.isArray(x) || x.length !== 2 || x.some(v => typeof v !== "number" || !Number.isFinite(v)))) return {error:"invalid_intervals"}; const ranges=input.intervals.map(x => [Math.min(...x),Math.max(...x)]).sort((a,b) => a[0]-b[0]); const out=[]; for(const range of ranges) { const last=out[out.length-1]; if(last && range[0]<=last[1]) last[1]=Math.max(last[1],range[1]); else out.push(range); } return {intervals:out}; }';
const diagnosis = {diagnosis: 'Contratos ejecutados.', limitations: 'No es una prueba general.', nextAction: 'Conservar evidencia.', intervalMinutes: 10};
function approvedLor(){
 const item=getAutonomousTask('lor-omega-schema');
 return {id:'known-lor-tool',curriculumTaskId:item.id,passed:true,name:item.name,source:'function transform(input){const required=["O","A","X","R","T","I","C","E","M","P","F","Σ"],s=input&&typeof input==="object"&&!Array.isArray(input)?input.S:null;if(!s||typeof s!=="object"||Array.isArray(s))return{valid:false,missing:required,extra:[]};const keys=Object.keys(s),missing=required.filter(k=>!keys.includes(k)),extra=keys.filter(k=>!required.includes(k)).sort();return{valid:!missing.length&&!extra.length,missing,extra};}',tests:item.acceptanceTests.slice(0,2),acceptanceTests:item.acceptanceTests};
}

// Keep the older generation/repair regressions on their original tasks.
// New priorities are temporarily cooling down only in these fixtures.
function reviewCapabilities(extensions,key,options={}){
 const newerHistory=['json-pointer-resolve','dag-dependency-plan'].map(taskId=>({taskId,passed:false,at:new Date().toISOString()}));
 return reviewAllCapabilities(extensions,key,{...options,history:[...newerHistory,...(options.history||[])]});
}

function offline(t) {
  return t.mock.method(globalThis, 'fetch', async () => { throw new Error('Esta prueba prohíbe solicitudes de red.'); });
}

for (const [label, wrap] of [
  ['plain JavaScript', value => value],
  ['javascript fence', value => '```javascript\n' + value + '\n```'],
  ['js fence', value => '```js\n' + value + '\n```']
]) {
  test(`code mode executes ${label} against independent contracts in QuickJS`, async t => {
    const request = offline(t);
    let calls = 0;
    const candidate = await buildExtension(task, 'test-local-key', contract, async (input, documents, _request, key) => {
      calls++;
      assert.equal(input.json, false);
      assert.equal(input.refute, true);
      assert.match(input.messages[0].content, /No lo envuelvas en JSON/);
      assert.deepEqual(documents, []);
      assert.equal(key, 'test-local-key');
      return {answer: wrap(source)};
    }, {format: 'code', name: 'Duplicar número'});
    assert.equal(calls, 1);
    assert.equal(candidate.passed, true);
    assert.equal(candidate.source, source);
    assert.equal(candidate.name, 'Duplicar número');
    assert.equal(candidate.testOrigin, 'external-contract');
    assert.deepEqual(candidate.tests, contract.slice(0, 2));
    assert.equal(candidate.results.length, 2);
    assert.equal(candidate.acceptanceResults.length, contract.length);
    for (const result of candidate.acceptanceResults) {
      assert.equal(result.passed, true);
      assert.deepEqual(result.actual, result.expected);
    }
    assert.equal(request.mock.callCount(), 0);
  });
}

test('repair receives the complete previous code and real failed input, expected and actual values', async t => {
  const request = offline(t);
  // This is permitted by the 16000-character sandbox limit and detects silent
  // truncation of the assistant's previous answer at the old 6500-character cap.
  const wrongSource = 'function transform(input) { /*' + ' retained code '.repeat(510) + '*/ return {doubled: input.value + 1}; }';
  assert.ok(wrongSource.length > 6500 && wrongSource.length < 16000);
  const prompts = [];
  const candidate = await buildExtension(task, 'test-local-key', contract, async input => {
    prompts.push(structuredClone(input));
    return {answer: prompts.length === 1 ? wrongSource : source};
  }, {format: 'code', name: 'Duplicar número'});
  assert.equal(candidate.passed, true);
  assert.equal(candidate.attempts.length, 2);
  assert.equal(candidate.attempts[0].passed, false);
  assert.equal(candidate.attempts[1].passed, true);
  assert.equal(prompts[1].messages.length, 3);
  assert.equal(prompts[1].messages[1].role, 'assistant');
  assert.equal(prompts[1].messages[1].content.length, wrongSource.length, 'repair must receive the entire previous source');
  assert.equal(prompts[1].messages[1].content, wrongSource);
  assert.match(prompts[1].messages[2].content, /"input":\{"value":2\}/);
  assert.match(prompts[1].messages[2].content, /"expected":\{"doubled":4\}/);
  assert.match(prompts[1].messages[2].content, /"actual":\{"doubled":3\}/);
  assert.equal(request.mock.callCount(), 0);
});

test('syntax errors are measured in the sandbox and supplied to the next repair', async t => {
  const request = offline(t);
  const broken = 'function transform(input) { return { doubled: ; }';
  const prompts = [];
  const candidate = await buildExtension(task, '', contract, async input => {
    prompts.push(input);
    return {answer: prompts.length === 1 ? broken : source};
  }, {format: 'code'});
  assert.equal(candidate.passed, true);
  assert.equal(candidate.attempts.length, 2);
  assert.equal(candidate.attempts[0].passed, false);
  assert.ok(candidate.attempts[0].acceptanceResults.every(result => !result.passed && result.error));
  assert.equal(prompts[1].messages[1].content, broken);
  assert.match(prompts[1].messages[2].content, /Ejecución aislada/);
  assert.equal(request.mock.callCount(), 0);
});

test('code mode rejects missing independent acceptance before invoking generation', async t => {
  const request = offline(t);
  let generated = 0;
  await assert.rejects(buildExtension(task, '', [], async () => {
    generated++;
    return {answer: source};
  }, {format: 'code'}), /requiere casos de aceptación externos/);
  assert.equal(generated, 0);
  assert.equal(request.mock.callCount(), 0);
});

test('the default JSON path keeps model-example provenance and its existing response contract', async t => {
  const request = offline(t);
  const candidate = await buildExtension(task, '', contract, async input => {
    assert.equal(input.json, true);
    assert.equal(input.refute, undefined);
    return {answer: JSON.stringify({name: 'Doblar JSON', source, tests: contract.slice(0, 1)})};
  });
  assert.equal(candidate.passed, true);
  assert.equal(candidate.testOrigin, 'model-examples');
  assert.equal(candidate.tests.length, 1);
  assert.equal(candidate.acceptanceResults.length, 3);
  assert.equal(request.mock.callCount(), 0);
});

test('reviewCapabilities codeGeneration creates and verifies a plain-code curriculum candidate', async t => {
  const request = offline(t);
  let generated = 0, assessed = 0;
  const result = await reviewCapabilities([approvedLor()], 'test-local-key', {
    allowCreation: true,
    codeGeneration: true,
    generate: async input => {
      generated++;
      assert.equal(input.json, false);
      assert.equal(input.refute, true);
      return {answer: mergeSource};
    },
    assess: async evidence => {
      assessed++;
      assert.equal(evidence.candidate.passed, true);
      assert.equal(evidence.capabilities.corePolicyEditing, true);
      assert.equal(evidence.capabilities.arbitraryServerEditing, false);
      assert.equal(evidence.capabilities.qwenWeightCandidates, true);
      assert.equal(evidence.capabilities.activeQwenAdapter, false);
      return diagnosis;
    }
  });
  assert.equal(generated, 1);
  assert.equal(assessed, 1);
  assert.equal(result.candidate.origin, 'autonomous-local-programming');
  assert.equal(result.candidate.curriculumTaskId, 'merge-intervals');
  assert.equal(result.candidate.testOrigin, 'external-contract');
  assert.equal(result.candidate.name, getAutonomousTask('merge-intervals').name);
  assert.equal(result.candidate.acceptanceResults.length, 8);
  assert.ok(result.candidate.acceptanceResults.every(item => item.passed));
  assert.equal(request.mock.callCount(), 0);
});

test('codeGeneration alone does not authorize creation without a selected contract', async t => {
  const request = offline(t);
  let generated = 0;
  const review = await reviewCapabilities([approvedLor()], '', {
    codeGeneration: true,
    generate: async () => { generated++; return {answer: source}; },
    assess: async () => diagnosis
  });
  assert.equal(generated, 0);
  assert.equal(review.candidate, null);
  assert.equal(review.curriculum, null);
  assert.equal(request.mock.callCount(), 0);
});

for (const testOrigin of ['external-contract', 'model-examples']) {
  test(`periodic repair preserves the generation mode and regressions of ${testOrigin} tools`, async t => {
    const request = offline(t);
    const previous = {
      id: 'previous-tool', task, name: 'Duplicar', passed: true, testOrigin,
      source: 'function transform(input) { return {doubled: input.value}; }',
      tests: contract.slice(0, 2), acceptanceTests: contract
    };
    const original = structuredClone(previous);
    let generated = 0;
    const review = await reviewCapabilities([previous], '', {
      allowCreation: true,
      codeGeneration: true,
      generate: async input => {
        generated++;
        assert.equal(input.json, testOrigin !== 'external-contract');
        return {answer: testOrigin === 'external-contract' ? source : JSON.stringify({name: 'Duplicar reparado', source, tests: contract.slice(0, 2)})};
      },
      assess: async () => diagnosis
    });
    assert.equal(generated, 1);
    assert.equal(review.checks[0].passed, false, 'the real sandbox audit must detect the broken parent');
    assert.equal(review.candidate.passed, true);
    assert.equal(review.candidate.parentId, previous.id);
    assert.equal(review.candidate.origin, 'autonomous-local-review');
    assert.equal(review.candidate.testOrigin, testOrigin);
    assert.equal(review.candidate.contractCheck.passed, true);
    assert.ok(review.candidate.regressionTests.length >= 3);
    assert.deepEqual(previous, original, 'a repair must preserve the previous tool');
    assert.equal(request.mock.callCount(), 0);
  });
}
