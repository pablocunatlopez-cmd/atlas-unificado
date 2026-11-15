import test from 'node:test';
import assert from 'node:assert/strict';
import {coachingCases,gradeCoaching} from '../lib/evolution/coaching.ts';
import {agentPlan,qualifiedScore,runSpecialists,AGENT_EVAL_VERSION,type AgentEvaluation} from '../lib/cloud/agents.ts';
const cases=coachingCases(1761),full=gradeCoaching(cases,{answers:cases.map(c=>({id:c.id,value:c.expected}))});
const roster:AgentEvaluation[]=[{model:'qwen/qwen3.8-27b',version:AGENT_EVAL_VERSION,status:'qualified',at:'now',latencyMs:400,score:full},{model:'openai/gpt-oss-120b',version:AGENT_EVAL_VERSION,status:'qualified',at:'now',latencyMs:600,score:full}];
test('only actual current qualified scores can activate another model',()=>{
 assert.equal(qualifiedScore(full),true);assert.equal(qualifiedScore({...full,cases:[]}),false);
 const pending=roster.map(r=>({...r,status:'pending' as const}));
 assert.equal(agentPlan('Implementa código JavaScript',pending).reviewer,undefined);
 assert.equal(agentPlan('Hola',roster).reviewer,undefined);
 const plan=agentPlan('Implementa código JavaScript',roster);assert.notEqual(plan.primary,plan.reviewer);
 const stale=roster.map(r=>({...r,version:'old'}));assert.equal(agentPlan('Implementa código',stale).reviewer,undefined);
});
test('a model with known failures in a domain cannot review that domain',()=>{
 const weak=gradeCoaching(cases,{answers:cases.filter(c=>c.domain!=='reasoning').map(c=>({id:c.id,value:c.expected}))});
 const evaluations=[{...roster[0],score:weak},roster[1]];
 const logic=agentPlan('Razona con lógica',evaluations);assert.equal(logic.primary,'openai/gpt-oss-120b');assert.equal(logic.reviewer,undefined);
 assert.equal(agentPlan('Implementa código',evaluations).reviewer,'qwen/qwen3.8-27b');
});
test('conversation selects the strongest qualified observed score instead of forcing Qwen',()=>{
 const qwenSix=gradeCoaching(cases,{answers:cases.filter(c=>c.domain!=='programming').map(c=>({id:c.id,value:c.expected}))});
 assert.equal(qualifiedScore(qwenSix),true);
 const plan=agentPlan('Recuerda lo que acordamos y ayúdame a decidir',[{...roster[0],score:qwenSix},roster[1]]);
 assert.equal(plan.role,'conversation');assert.equal(plan.primary,'openai/gpt-oss-120b');assert.equal(plan.reviewer,undefined);
 assert.match(plan.scope,/ocho casos sintéticos/);
});
test('specialist and reviewer make distinct calls and store actual completion rather than a role fiction',async()=>{
 const models:string[]=[];
 const result=await runSpecialists({question:'Implementa código JavaScript',messages:[{role:'user',content:'Implementa código JavaScript'}],system:'Contexto',evaluations:roster,generate:async(model,_messages,options)=>{models.push(model);return options.json?{decision:'revise',answer:'Código corregido propuesto.',issues:['Entrada inválida no controlada.']}:'Borrador';}});
 assert.equal(new Set(models).size,2);assert.match(result.answer,/Código corregido/);assert.equal(result.trace.filter(s=>s.status==='completed').length,2);assert.match(result.answer,/no una prueba de ejecución/);
});
test('an unavailable reviewer leaves the draft and a truthful incomplete trace',async()=>{
 const result=await runSpecialists({question:'Razona con lógica',messages:[],system:'Contexto',evaluations:roster,generate:async(_model,_messages,options)=>{if(options.json)throw Error('quota');return 'Borrador conservado';}});
 assert.match(result.answer,/Borrador conservado/);assert.equal(result.trace.at(-1)?.status,'unavailable');
});
test('a reviewer cannot introduce a new external citation or empty invented correction',async()=>{
 const result=await runSpecialists({question:'Depura código',messages:[],system:'Fuente https://docs.python.org/',evaluations:roster,generate:async(_model,_messages,options)=>options.json?{decision:'revise',answer:'Cita https://other.invalid/fake',issues:['algo']}:'Borrador'});
 assert.equal(result.trace.at(-1)?.status,'unavailable');assert.doesNotMatch(result.answer,/other.invalid/);
});
test('review is skipped when the background deadline has insufficient time remaining',async()=>{
 let calls=0;const result=await runSpecialists({question:'Depura código',messages:[],system:'Contexto',evaluations:roster,deadline:2000,now:()=>0,generate:async()=>{calls++;return 'Borrador';}});
 assert.equal(calls,1);assert.equal(result.trace.at(-1)?.status,'skipped');
});
test('primary has room for a useful answer and reviewer receives actual prior constraints under the transport limit',async()=>{
 const question='Implementa código JavaScript respetando los acuerdos. '+ 'Detalle. '.repeat(600);
 const preference={role:'user',content:'Prefiero JavaScript sin dependencias externas y sin coste. Mantén los nombres en español.'};
 const messages=[preference,{role:'assistant',content:'De acuerdo, usaré JavaScript sin paquetes.'},...Array.from({length:10},(_,i)=>({role:i%2?'assistant':'user',content:'Turno '+i})),{role:'user',content:question}];
 let reviewSeen=false;
 const result=await runSpecialists({question,messages,system:'Identidad y datos revisables. '+ 'Contexto largo. '.repeat(480),evaluations:roster,generate:async(_model,input,options)=>{
  if(!options.json){assert.equal(options.maxTokens,3500);assert.equal(options.timeoutMs,22000);assert.ok(input.reduce((n,m)=>n+m.content.length,0)<=16000);return 'function propuesta() { return 42; }';}
  reviewSeen=true;assert.ok(input.reduce((n,m)=>n+m.content.length,0)<=16000);
  const report=JSON.parse(input[1].content);assert.equal(report.question,question);assert.equal(report.draft,'function propuesta() { return 42; }');
  assert.ok(report.history.some((message:{role:string;content:string})=>message.role==='user'&&message.content===preference.content));
  assert.equal(report.history.at(-1).content,'Turno 9');assert.equal(report.contextPartial,true);
  return {decision:'keep',answer:'',issues:[]};
 }});
 assert.equal(reviewSeen,true);assert.equal(result.trace.at(-1)?.status,'completed');
});
test('a complete long draft survives instead of sending the reviewer a clipped prefix',async()=>{
 const draft='Respuesta completa. '+ 'x'.repeat(18000);let calls=0;
 const result=await runSpecialists({question:'Implementa código',messages:[{role:'user',content:'Implementa código'}],system:'Contexto',evaluations:roster,generate:async()=>{calls++;return draft;}});
 assert.equal(calls,1);assert.ok(result.answer.startsWith(draft));assert.equal(result.trace.at(-1)?.status,'skipped');assert.ok(result.answer.length<=26000);
});
