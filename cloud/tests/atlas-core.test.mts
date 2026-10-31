import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {calculate,deduce,retrieve,makeReply,memoryKnowledge,capabilityTests} from '../lib/atlas-core.ts';
import {initialState} from '../lib/atlas-types.ts';
import {TinyLanguageModel,encode,validateSnapshot,parameterCount} from '../public/core/language-model.mjs';

test('arithmetic precedence, unary signs, powers and percentages',()=>{
 for(const [expression,value] of [['(1000-250)*12',9000],['-2^2',-4],['2^3^2',512],['20% de 150',30],['calcula 7,5 / 2',3.75],['2 * -4',-8]] as const)assert.equal(calculate(expression)?.value,value);
 assert.throws(()=>calculate('2/0'));assert.throws(()=>calculate('1+'));assert.throws(()=>calculate('2(3)'));assert.equal(calculate('process.exit(1)'),null);
});
test('novel rules, negation, open world, and contradictions',()=>{
 const input='hecho: aster es mineral\nregla: si x es mineral entonces x es material\nregla: si x es material entonces x es observable\nconsulta: aster es observable';
 assert.equal(deduce(input)?.result,'demostrado bajo las premisas');
 assert.equal(deduce('hecho: aster no es líquido\nconsulta: aster es líquido')?.result,'negación demostrada bajo las premisas');
 assert.equal(deduce('hecho: aster es mineral\nconsulta: aster es conductor')?.result,'desconocido');
 assert.equal(deduce('hecho: aster es mineral\nhecho: aster no es mineral\nconsulta: aster es mineral')?.result,'contradicción');
 assert.throws(()=>deduce('hecho: código arbitrario'));
});
test('retrieval adds novel documents and declines missing evidence',()=>{
 const state=initialState(),docs=[{id:'new',title:'Proyecto Azahar',text:'El proyecto Azahar tiene un presupuesto provisional de 320 euros.',kind:'Documento aportado'}];
 assert.equal(retrieve('presupuesto Azahar',docs)[0]?.id,'new');
 assert.match(makeReply('presupuesto Azahar',state,docs).answer,/320/);
 assert.match(makeReply('isótopos plutonio',state,[]).answer,/No encuentro/);
 assert.equal(makeReply('calcula 19*17',state,[]).engine,'native');
});
test('withdrawn memories and corrected claims are not silently reused',()=>{
 const state=initialState();state.memories=[{id:'old',title:'Dato obsoleto',text:'Mi ciudad es Mercurio.',kind:'Contexto',domain:'general',status:'Retirado',date:'2026-01-01',versions:[]}];
 assert.equal(memoryKnowledge(state).length,0);
 state.memories[0].status='Aportado';state.corrections=[{id:'c',before:'Mi ciudad es Mercurio.',after:'Mi ciudad es Azahar.',reason:'Corrección explícita',date:'2026-10-19'}];
 assert.equal(memoryKnowledge(state).length,1);assert.match(memoryKnowledge(state)[0].text,/Azahar/);
});
test('protected capability checks actually pass',()=>{assert.ok(capabilityTests().length>=7);for(const c of capabilityTests())assert.equal(c.passed,true,c.name);});
test('own model: deterministic initialization, normalized distribution and checkpoint round trip',()=>{
 const a=new TinyLanguageModel(undefined,101),b=new TinyLanguageModel(undefined,101);
 assert.deepEqual(a.snapshot(),b.snapshot());assert.ok(validateSnapshot(a.snapshot()));
 const probs=a.forward(encode('atlas es'));assert.ok(Math.abs(Array.from(probs).reduce((s,n)=>s+n,0)-1)<1e-10);
 assert.equal(a.snapshot().parameters,parameterCount);
 assert.deepEqual(new TinyLanguageModel(a.snapshot()).generate('atlas',50,.7,12),a.generate('atlas',50,.7,12));
 const corrupt=a.snapshot();corrupt.weights.output[0]=NaN;assert.equal(validateSnapshot(corrupt),false);
});
test('backpropagation matches a numerical gradient',()=>{
 const m=new TinyLanguageModel(undefined,71),ctx=encode('el atlas'),target=encode('a')[0];
 const w=m.weights.hidden,ix=19,old=w[ix],epsilon=1e-5;
 w[ix]=old+epsilon;const plus=-Math.log(m.forward(ctx)[target]);w[ix]=old-epsilon;const minus=-Math.log(m.forward(ctx)[target]);w[ix]=old;
 const expected=(plus-minus)/(2*epsilon),rate=1e-6;m.trainOne(ctx,target,rate);const actual=(old-w[ix])/rate;
 assert.ok(Math.abs(actual-expected)<1e-5,`${actual} vs ${expected}`);
});
test('learning changes weights and improves a separate synthetic sequence',()=>{
 const m=new TinyLanguageModel(undefined,37),train=encode('la luna mira el cielo. el cielo tiene la luna. '.repeat(50)),heldout=encode('el cielo tiene la luna. la luna mira el cielo. '.repeat(10));
 const before=m.evaluate(heldout),weights=m.snapshot().weights.output.slice();m.train(train,5000,18);const after=m.evaluate(heldout);
 assert.ok(after<before-1,`${before} → ${after}`);assert.notDeepEqual(m.snapshot().weights.output,weights);assert.equal(m.steps,5000);
});
test('published seed is a real finite trained checkpoint with measured provenance',()=>{
 const seed=JSON.parse(readFileSync(new URL('../data/atlas-lm-seed.json',import.meta.url),'utf8'));
 assert.ok(validateSnapshot(seed.snapshot));assert.ok(seed.snapshot.steps>0);assert.ok(seed.metrics.after<seed.metrics.before);assert.match(seed.provenance.corpusSha256,/^[a-f0-9]{64}$/);
});
test('chat runtime has no model provider dependency',()=>{
 for(const path of ['../app/api/chat/route.ts','../app/api/mission/route.ts','../lib/atlas-core.ts']){
  const source=readFileSync(new URL(path,import.meta.url),'utf8');assert.doesNotMatch(source,/api\.openai|anthropic|x\.ai|OPENAI_API_KEY|generateAtlasReply|fetch\(/);
 }
});
test('training worker runs the actual browser training protocol',async()=>{
 const target=new URL('../public/atlas-training-worker.mjs',import.meta.url).href;
 const wrapper=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:m=>parentPort.postMessage(m)};await import(${JSON.stringify(target)});parentPort.on('message',data=>self.onmessage({data}));`;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(wrapper)));
 try{
  const result=await new Promise<{type:string;metrics:{attemptedSteps:number;before:number;after:number};snapshot:unknown}>((resolve,reject)=>{
   worker.on('message',message=>{if(message.type==='done')resolve(message);if(message.type==='error')reject(new Error(message.message));});worker.on('error',reject);
   worker.postMessage({snapshot:new TinyLanguageModel().snapshot(),corpus:'atlas mira la luna. la luna tiene luz. '.repeat(50),steps:1000});
  });
  assert.ok(validateSnapshot(result.snapshot));assert.equal(result.metrics.attemptedSteps,1000);assert.ok(result.metrics.after<result.metrics.before);
 }finally{await worker.terminate();}
});
