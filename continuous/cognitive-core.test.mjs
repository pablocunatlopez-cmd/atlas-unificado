import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {BASELINE_POLICY,validateStrategyPolicy,applyStrategyChange,decideStrategy,createCognitiveCore} from './cognitive-core.mjs';
import {freshEvaluationCases} from './cognitive-contracts.mjs';
const clone=value=>structuredClone(value);
const improved=()=>{const p=clone(BASELINE_POLICY);p.name='Definiciones concisas';p.rules.unshift({id:'definition',priority:99,when:{all:['definition'],none:['creative','research','recall']},then:{strategy:'direct',thinkingTokens:128,review:false,seekEvidence:false}});return p;};
const improvementChange=()=>({schema:'atlas-strategy-change/v1',name:'Definiciones concisas',rationale:'Reducir razonamiento innecesario en definiciones, conservando la depuración.',operation:'upsert-rule',rule:improved().rules[0]});
async function setup(t,options={}){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-core-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));return {directory,core:createCognitiveCore({directory,...options})};}
test('mutable policy cannot add code, unknown predicates or capabilities, and JSON transport remains fixed',()=>{
 for(const change of [p=>p.code='process.exit()',p=>p.rules[0].when.all=['readPrivateFiles'],p=>p.fallback.thinkingTokens=999999,p=>p.rules[0].then.run='shell']){const p=clone(BASELINE_POLICY);change(p);assert.throws(()=>validateStrategyPolicy(p));}
 const p=improved();p.rules[0].then.seekEvidence=true;
 const plain=decideStrategy(p,'¿Qué es una variable en Python?',{});assert.equal(plain.permissions.internet,false);assert.equal(plain.permissions.tools,false);
 const structured=decideStrategy(p,'Depura el videojuego y busca fuentes',{json:true,internet:true,tools:true});assert.equal(structured.thinkingTokens,0);assert.equal(structured.review,false);assert.deepEqual(structured.permissions,{internet:false,tools:false});
});
test('fresh external contracts promote a measured candidate, persist it and keep baseline rollback',async t=>{
 const {core,directory}=await setup(t),before=await core.status();let sent;
 const result=await core.propose(async prompt=>{sent=prompt;return JSON.stringify(improved());});
 assert.equal(result.accepted,true);assert.ok(result.evaluation.after.score>result.evaluation.before.score);assert.equal(result.evaluation.regressions.length,0);assert.equal(result.lor.L.countsAsLearning,true);assert.equal(result.qwenWeightsChanged,false);
 assert.equal(sent.includes('Me apetece hablar de una idea llamada'),false);assert.equal(sent.includes('Casos de desarrollo'),true);
 const reloaded=createCognitiveCore({directory});assert.equal((await reloaded.status()).activeId,result.id);assert.equal((await reloaded.decide('¿Qué es una variable en JavaScript?')).thinkingTokens,128);
 await reloaded.rollback(before.activeId);assert.equal((await reloaded.status()).activeId,before.activeId);assert.equal((await reloaded.decide('¿Qué es una variable en JavaScript?')).thinkingTokens,1024);
 const baseline=JSON.parse(await fs.readFile(path.join(directory,'baseline.json')));assert.equal(baseline.id,before.activeId);
});
test('one-rule patches improve measured behavior while preserving all other baseline rules, fallback and stage/raw evidence',async t=>{
 const {core,directory}=await setup(t),stages=[];let sent;
 const change=improvementChange(),raw=JSON.stringify(change),result=await core.propose(async prompt=>{sent=prompt;return raw;},{onStage:stage=>stages.push(stage)});
 assert.equal(result.accepted,true);assert.equal(result.proposalFormat,'single-rule-change');assert.deepEqual(result.change,{operation:'upsert-rule',ruleId:'definition'});assert.deepEqual(stages,['observe','connect','refute','retain']);
 assert.ok(result.evaluation.after.score>result.evaluation.before.score);assert.equal(result.evaluation.regressions.length,0);
 const state=JSON.parse(await fs.readFile(path.join(directory,'state.json'))),candidate=state.versions.find(item=>item.id===result.id).policy;
 assert.deepEqual(candidate.rules.filter(rule=>rule.id!=='definition'),BASELINE_POLICY.rules);assert.deepEqual(candidate.fallback,BASELINE_POLICY.fallback);
 assert.equal((await core.decide('Depura este algoritmo en JavaScript.')).thinkingTokens,1024);assert.equal((await core.decide('¿Qué es una variable en Python?')).thinkingTokens,128);
 assert.equal(JSON.parse(await fs.readFile(path.join(directory,result.id+'.json'))).rawProposal,raw);assert.match(sent,/UN cambio pequeño/);assert.match(sent,/atlas-strategy-change\/v1/);assert.equal(sent.includes('Me apetece hablar de una idea llamada'),false);
});
test('patches cannot delete rules, inject code, replace fallback or exceed the policy limit',()=>{
 for(const mutate of [change=>change.operation='delete-rule',change=>change.code='process.exit()',change=>change.fallback={strategy:'direct'},change=>change.rule.then.run='shell',change=>change.rule.priority=101]){const change=improvementChange();mutate(change);assert.throws(()=>applyStrategyChange(BASELINE_POLICY,change));}
 const large=clone(BASELINE_POLICY);for(let index=large.rules.length;index<12;index++)large.rules.push({...clone(large.rules[0]),id:'extra-'+index});assert.equal(large.rules.length,12);assert.throws(()=>applyStrategyChange(large,improvementChange()),/Política cognitiva inválida/);
 const replacement=improvementChange();replacement.rule.id='complex';const next=applyStrategyChange(BASELINE_POLICY,replacement);assert.equal(next.rules.length,BASELINE_POLICY.rules.length);assert.deepEqual(next.rules.filter(rule=>rule.id!=='complex'),BASELINE_POLICY.rules.filter(rule=>rule.id!=='complex'));assert.deepEqual(next.fallback,BASELINE_POLICY.fallback);
});
test('a superficially cheaper policy that regresses complex tasks is refuted and not activated',async t=>{
 const {core}=await setup(t),before=await core.status(),p=improved();p.rules.find(rule=>rule.id==='complex').then.thinkingTokens=0;
 const result=await core.propose(async()=>p);assert.equal(result.accepted,false);assert.equal(result.reason,'regression');assert.ok(result.evaluation.regressions.includes('programming'));assert.equal(result.lor.L.countsAsLearning,false);assert.equal((await core.status()).activeId,before.activeId);
});
test('identical metrics are not progress and a consumed evaluation cannot be reused',async t=>{
 const fixed=freshEvaluationCases(),{core}=await setup(t,{evaluationCases:()=>fixed});
 const first=await core.propose(async()=>improved());assert.equal(first.accepted,true);
 const second=await core.propose(async()=>improved());assert.equal(second.accepted,false);assert.match(second.error,/consumió/);assert.equal((await core.status()).accepted,1);
 const other=await setup(t),same=await other.core.propose(async()=>clone(BASELINE_POLICY));assert.equal(same.accepted,false);assert.equal(same.lor.L.countsAsLearning,false);
});
test('cancellation changes neither active version nor learning counters; corrupted state is preserved',async t=>{
 const {core,directory}=await setup(t),before=await core.status(),controller=new AbortController();
 await assert.rejects(core.propose(async()=>{controller.abort(Error('yield to chat'));return improved();},{signal:controller.signal}),/yield to chat/);assert.equal((await core.status()).attempts,0);
 const file=path.join(directory,'state.json'),state=JSON.parse(await fs.readFile(file));state.versions[0].policy.name='tampered';await fs.writeFile(file,JSON.stringify(state));await assert.rejects(createCognitiveCore({directory}).status(),/integridad/);assert.equal(JSON.parse(await fs.readFile(file)).versions[0].policy.name,'tampered');assert.equal(before.generation,0);
});

test('the next proposal receives the actual validated rule and public development deltas, never reserved evaluation data',async t=>{
 const {core,directory}=await setup(t),change=improvementChange(),first=await core.propose(async()=>change);
 assert.equal(first.accepted,true);assert.deepEqual(first.change,{operation:'upsert-rule',ruleId:'definition'});
 assert.deepEqual(first.proposedRule,{...change.rule,when:{all:['definition'],any:[],none:['creative','research','recall']}});
 assert.deepEqual(Object.keys(first.developmentMetrics.before).sort(),['passed','cases','score','meanThinkingTokens'].sort());assert.equal(first.developmentMetrics.after.passed,first.developmentMetrics.after.cases);assert.ok(first.developmentMetrics.after.score>first.developmentMetrics.before.score);
 const file=path.join(directory,'state.json'),state=JSON.parse(await fs.readFile(file,'utf8')),saved=state.history.at(-1);
 const reservedHash=first.evaluation.hash;
 saved.evaluation.before.results[0].family='HELDOUT_ONLY_FAMILY';saved.evaluation.after.results[0].question='HELDOUT_ONLY_QUESTION';saved.evaluation.secret='HELDOUT_ONLY_FIELD';saved.developmentMetrics.before.extra='PRIVATE_EXTRA_METRIC';await fs.writeFile(file,JSON.stringify(state));
 const noop={schema:'atlas-strategy-change/v1',name:'Mismo saludo',rationale:'No cambia la ejecución.',operation:'upsert-rule',rule:clone(BASELINE_POLICY.rules[0])};let sent;
 const second=await core.propose(async prompt=>{sent=prompt;return noop;});
 const historyPrefix='Resumen histórico y refutaciones de desarrollo, sin casos reservados: ',summary=JSON.parse(sent.split(historyPrefix)[1]);
 assert.equal(summary.length,1);assert.deepEqual(summary[0].proposedRule,first.proposedRule);assert.deepEqual(summary[0].developmentMetrics,first.developmentMetrics);
 assert.equal(sent.includes(reservedHash),false);assert.doesNotMatch(sent,/HELDOUT_ONLY|PRIVATE_EXTRA_METRIC/);assert.match(sent,/Todos los casos de desarrollo actuales pasan/);assert.match(sent,/NO inventes un fallo/);assert.match(sent,/No repitas una regla refutada/);
 assert.equal(second.accepted,false);assert.equal(second.reason,'no_measured_improvement');assert.deepEqual(second.proposedRule,BASELINE_POLICY.rules[0]);assert.deepEqual(second.developmentMetrics.before,second.developmentMetrics.after);
 let next;await core.propose(async prompt=>{next=prompt;return noop;});const feedback=JSON.parse(next.split(historyPrefix)[1]);
 assert.equal(feedback.length,2);assert.equal(feedback[1].reason,'no_measured_improvement');assert.deepEqual(feedback[1].proposedRule,second.proposedRule);assert.equal((await core.status()).accepted,1);
});
