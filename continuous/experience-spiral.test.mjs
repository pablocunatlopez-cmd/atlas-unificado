import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {createExperienceSpiral,canonicalInquiryQuery,canonicalInquiryKey} from './experience-spiral.mjs';
import {LOR_FIELDS,validateLorRecord} from './lor-omega.mjs';

const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const ids=['lor-omega-schema','json-pointer-resolve','dag-dependency-plan','merge-intervals','stable-dedupe','numeric-statistics'];
const goal={question:'¿Qué caso físico refuta esta herramienta?',rationale:'Existe un fallo reproducible que debe contrastarse.',kind:'tool-experiment',taskId:'lor-omega-schema'};
async function fixture(t,overrides={}){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-experience-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 let time=Date.parse('2026-11-01T12:00:00Z');const calls=[];
 const options={directory,now:()=>time,waitMs:5000,observe:async({ordinal})=>{calls.push('observe');return{facts:['Un contrato ejecutable necesita un contraejemplo.'],caseHash:digest('case-'+ordinal)};},proposeGoal:async()=>{calls.push('mind');return goal;},execute:async({ordinal})=>{calls.push('ion');return{executed:true,cases:3,passed:3,acceptedChange:true,invariantsPreserved:true,evidenceHash:digest('executed-'+ordinal),summary:'Tres contratos ejecutados.'};},reflect:async()=>{calls.push('constellation');return{consulted:true,independentModels:0,collaborators:[{id:'aider',free:true,available:true}],summary:'Contraste local; no modelo independiente.'};},formalize:async({lorFields})=>{calls.push('logic');assert.deepEqual(lorFields,LOR_FIELDS);return{acceptedChange:true,invariantsPreserved:true,summary:'Cambio acotado comprobado.',rule:'Conservar la corrección que supera los contratos.'};},...overrides};
 return {api:createExperienceSpiral(options),options,calls,advance:ms=>{time+=ms;},read:async()=>JSON.parse(await fs.readFile(path.join(directory,'experience-spiral.json'),'utf8'))};
}

test('a transient initialization failure can recover in the same spiral without a restart',async t=>{
 const parent=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-spiral-init-retry-'));t.after(()=>fs.rm(parent,{recursive:true,force:true}));
 const directory=path.join(parent,'temporarily-unavailable');await fs.writeFile(directory,'temporary obstruction');
 let observed=0;const api=createExperienceSpiral({directory,observe:async()=>{observed++;return {eligibleActions:[]};},execute:async()=>assert.fail('No action'),reflect:async()=>assert.fail('No reflection'),formalize:async()=>assert.fail('No promotion')});
 assert.equal((await api.tick()).status,'failed');assert.equal(observed,0);
 await fs.unlink(directory);await fs.mkdir(directory);
 const recovered=await api.tick();assert.equal(recovered.status,'waiting');assert.equal(recovered.reason,'no_eligible_goal');assert.equal(observed,1);assert.equal((await api.status()).attempts,1);
});

test('concurrent spiral status initialization shares one load and preserves invalid state until repaired',async t=>{
 const {options}=await fixture(t),file=path.join(options.directory,'experience-spiral.json'),invalid='{"version":1,"history":"invalid"}';await fs.writeFile(file,invalid);
 const api=createExperienceSpiral(options);let reads=0;const readFile=fs.readFile.bind(fs);t.mock.method(fs,'readFile',async(target,...args)=>{if(target===file)reads++;return readFile(target,...args);});
 const rejected=await Promise.allSettled([api.status(),api.status(),api.status()]);assert.ok(rejected.every(item=>item.status==='rejected'));assert.equal(reads,1);assert.equal(await readFile(file,'utf8'),invalid);
 await assert.rejects(api.status(),/Estado de espiral no válido/);assert.equal(await readFile(file,'utf8'),invalid);
 await fs.unlink(file);
 const recovered=await Promise.all([api.status(),api.status(),api.status()]);assert.ok(recovered.every(item=>item.attempts===0&&item.experiences===0));assert.equal(reads,3);
});

test('physical execution precedes constellation and original LOR logic; only accepted new evidence counts',async t=>{
 const {api,calls,read}=await fixture(t),result=await api.tick();
 assert.deepEqual(calls,['observe','mind','ion','constellation','logic']);
 assert.deepEqual(result.experience.phases.map(item=>item.phase),['mind','ion','constellation','logic','retained']);
 assert.equal(result.experience.L.countsAsLearning,true);assert.equal(result.experience.goal.changedQuestion,true);
 assert.equal(result.experience.goal.focus,'language');
 const language=validateLorRecord(result.experience.language);assert.deepEqual(Object.keys(language.S),Object.keys(LOR_FIELDS));
 assert.equal(language.S.E,'Una experiencia de software; no escala física ni prueba de una teoría');
 assert.equal(language.L.countsAsLearning,true);
 const state=await api.status();assert.equal(state.experiences,1);assert.equal(state.learningChanges,1);assert.equal(state.phase,'waiting');assert.equal(state.running,false);assert.equal(state.nextOrdinal,2);assert.equal(state.activeAdapter,false);
 assert.equal(state.last.cases,3);assert.equal(state.last.passed,3);assert.equal(state.last.reason,'completed');
 assert.equal((await read()).current,null);
});

test('new planned cases permit the same question, but repeated physical evidence never becomes new learning',async t=>{
 const fixed=digest('same-executed-case');
 const {api,advance}=await fixture(t,{execute:async()=>({executed:true,cases:2,passed:2,acceptedChange:true,invariantsPreserved:true,evidenceHash:fixed})});
 const first=await api.tick();advance(5000);const second=await api.tick();
 assert.equal(second.status,'retained');assert.equal(second.experience.goal.changedQuestion,false);
 assert.equal(second.experience.goal.objectiveRevision,first.experience.goal.objectiveRevision);
 assert.equal(second.experience.goal.parentExperienceId,first.experience.id);
 assert.equal(second.experience.L.newEvidence,false);assert.equal(second.experience.L.countsAsLearning,false);
 assert.equal((await api.status()).experiences,2);assert.equal((await api.status()).learningChanges,1);
});

test('changing wording alone cannot repeat a task; fallback follows a gap then open inquiry without cycling the catalogue',async t=>{
 let wording=0;
 const {api,advance}=await fixture(t,{observe:async()=>({facts:['El mismo hecho ejecutable.'],gaps:[{taskId:'json-pointer-resolve',reason:'Falta un caso de escapes.'}],caseHash:digest('fixed-case')}),proposeGoal:async()=>({...goal,question:'¿Qué pregunta textual número '+(++wording)+' debe evaluarse?'})});
 const results=[];
 for(let i=0;i<3;i++){results.push(await api.tick());advance(5000);}
 assert.equal(new Set(results.map(result=>result.experience.goal.taskId)).size,3);
 assert.equal(results[1].experience.goal.taskId,'json-pointer-resolve');
 assert.equal(results[2].experience.goal.kind,'open-inquiry');assert.equal(results[2].experience.goal.taskId,null);
 const exhausted=await api.tick();assert.equal(exhausted.status,'waiting');assert.equal(exhausted.reason,'no_new_evidence');
 assert.equal((await api.status()).experiences,3);
});

test('restart preserves objective lineage, evidence and monotonically increasing ordinals',async t=>{
 const {api,options,advance}=await fixture(t);const first=await api.tick();advance(5000);
 const resumed=createExperienceSpiral({...options,observe:async input=>{assert.equal((await resumed.status()).nextRun,null);return options.observe(input);},proposeGoal:async()=>({...goal,question:'¿Qué nuevo fallo requiere cambiar la pregunta del experimento?'})});
 assert.equal((await resumed.status()).nextOrdinal,2);
 const second=await resumed.tick();assert.equal(second.experience.ordinal,2);
 assert.equal(second.experience.goal.parentExperienceId,first.experience.id);assert.equal(second.experience.goal.changedQuestion,true);
 assert.equal(second.experience.goal.objectiveRevision,2);assert.equal((await resumed.status()).nextOrdinal,3);
});

test('cancellation yields resources, preserves partial physical facts and schedules a short honest wait',async t=>{
 const controller=new AbortController(),cancel=new Error('foreground'),events=[];
 const {api,read}=await fixture(t,{execute:async({signal})=>{events.push('ion');assert.equal(signal,controller.signal);return{executed:true,cases:1,passed:1,evidenceHash:digest('cancelled-physical'),acceptedChange:true,invariantsPreserved:true};},reflect:async()=>{events.push('constellation');controller.abort(cancel);return{};},formalize:async()=>{events.push('logic');return{};}});
 await assert.rejects(api.tick({signal:controller.signal}),error=>error===cancel);
 assert.deepEqual(events,['ion','constellation']);const state=await api.status();assert.equal(state.running,false);assert.equal(state.phase,'waiting');assert.equal(state.last.reason,'cancelled');assert.equal(state.learningChanges,0);assert.equal(state.nextRun,'2026-11-01T12:00:30.000Z');
 assert.equal((await read()).history[0].result.executed,true);
});

test('ticks serialize and cooldown polling does not push the next run into the future',async t=>{
 let release,entered;const gate=new Promise(resolve=>{release=resolve;}),ready=new Promise(resolve=>{entered=resolve;});
 const {api,advance}=await fixture(t,{execute:async()=>{entered();await gate;return{executed:true,cases:1,passed:1,evidenceHash:digest('serial')};}});
 const first=api.tick();await ready;assert.equal((await api.tick()).status,'busy');release();await first;
 const before=await api.status();advance(1000);assert.equal((await api.tick()).reason,'cooldown');
 assert.equal((await api.status()).nextRun,before.nextRun);assert.equal((await api.status()).attempts,1);
});

test('invalid model goals fall back to bounded observed gaps; zero cases or broken invariants do not teach',async t=>{
 const {api,read}=await fixture(t,{observe:async()=>({facts:['Una entrada pública falla.'],gaps:[{taskId:'dag-dependency-plan',reason:'Hay ciclos sin diagnosticar.'}],secret:'private',failures:[{taskId:'unknown',summary:'ignored'}]}),proposeGoal:async()=>({...goal,taskId:'server-root',question:'x'.repeat(601)}),execute:async()=>({executed:true,cases:0,passed:99,acceptedChange:true,invariantsPreserved:true,evidenceHash:digest('zero')}),formalize:async()=>({acceptedChange:true,invariantsPreserved:true,summary:'No sustituye la ejecución.'})});
 const result=await api.tick();assert.equal(result.experience.goal.taskId,'dag-dependency-plan');assert.equal(result.experience.result.passed,0);assert.equal(result.experience.L.countsAsLearning,false);
 assert.equal((await api.status()).learningChanges,0);assert.doesNotMatch(JSON.stringify((await read()).history),/private|server-root/);
});

test('empty observations do not create a ceremonial task cycle, and failed callbacks remain negative evidence',async t=>{
 const empty=await fixture(t,{observe:async()=>({}),proposeGoal:undefined});assert.equal((await empty.api.tick()).reason,'no_eligible_goal');assert.equal((await empty.api.status()).experiences,0);
 const failed=await fixture(t,{reflect:async()=>{throw new Error('private provider diagnostic');}});
 assert.equal((await failed.api.tick()).reason,'callback_failed');const state=await failed.api.status();assert.equal(state.learningChanges,0);assert.equal(state.last.executed,true);assert.equal(state.nextRun,'2026-11-01T12:00:30.000Z');
 assert.doesNotMatch(JSON.stringify(await failed.read()),/private provider/);
});

test('history is bounded while experience and unique ordinal counts survive many independent cases',async t=>{
 const {api,advance,read}=await fixture(t);
 for(let i=0;i<82;i++){assert.equal((await api.tick()).status,'retained');advance(5000);}
 const saved=await read();assert.equal(saved.history.length,80);assert.equal((await api.status()).experiences,82);assert.equal((await api.status()).nextOrdinal,83);
 assert.deepEqual(new Set(saved.history.map(item=>item.goal.taskId)),new Set([ids[0]]));
});

test('open inquiry preserves surprise and unresolved unknowns without turning reading into an accepted change',async t=>{
 let instance;const freeQuestion='¿Qué observación pública pondría en duda los límites de nuestra explicación actual?';
 instance=await fixture(t,{
  proposeGoal:async()=>({question:freeQuestion,rationale:'Un acontecimiento podría no ajustarse a nuestra explicación previa.',prediction:'Una fuente pública puede refutar la expectativa, o dejar la indagación abierta.',kind:'open-inquiry',taskId:null}),
  execute:async({goal})=>{const stored=await instance.read();assert.equal(stored.current.goal.prediction,goal.prediction);assert.equal(stored.phase,'ion');return{executed:true,cases:1,passed:1,acceptedChange:true,invariantsPreserved:true,evidenceHash:digest('public-reading'),summary:'Una fuente pública leída.'};},
  reflect:async({result})=>{const stored=await instance.read();assert.equal(stored.current.result.evidenceHash,result.evidenceHash);return{consulted:false,epistemicStatus:'unexplained',unknowns:Array.from({length:5},(_,i)=>'Incógnita '+i+': '+ 'x'.repeat(300)),possibilityBeyondModel:false,noveltyScope:'new-to-atlas',suggestedNextQuestion:'¿Qué otro dato acotado permitiría observar la incógnita?'};}
 });
 const result=await instance.api.tick(),experience=result.experience;
 assert.equal(experience.goal.kind,'open-inquiry');assert.equal(experience.goal.taskId,null);assert.equal(experience.goal.question,freeQuestion);
 assert.equal(experience.reflection.possibilityBeyondModel,true);assert.equal(experience.reflection.unknowns.length,4);assert.ok(experience.reflection.unknowns.every(item=>item.length<=250));
 assert.equal(experience.L.newEvidence,true);assert.equal(experience.L.acceptedChange,false);assert.equal(experience.L.countsAsLearning,false);
 assert.equal(experience.language.Gamma.Suceso.epistemicStatus,'unexplained');assert.equal(experience.language.S.P[0].declaredBeforeEvaluation,true);
 assert.deepEqual(experience.language.S.O,[{kind:'open-inquiry',focus:'programming',question:freeQuestion}]);
 assert.match(experience.language.S['Σ'][0].object,/open-inquiry \(programming\)/);assert.ok(experience.language.S['Σ'][0].object.includes(freeQuestion));assert.doesNotMatch(experience.language.S['Σ'][0].object,/null/);
 const status=await instance.api.status();assert.equal(status.last.unknownsCount,4);assert.equal(status.last.epistemicStatus,'unexplained');assert.equal(status.last.noveltyScope,'new-to-atlas');assert.equal(Object.hasOwn(status.last,'unknowns'),false);assert.equal(status.learningChanges,0);
});

test('unresolved events feed the next private goal without claims of universal novelty',async t=>{
 let received;
 const {api,advance}=await fixture(t,{proposeGoal:async input=>{received=input;return{...goal,kind:'open-inquiry',taskId:null};},reflect:async()=>({epistemicStatus:'unexpected',unknowns:['No sabemos explicar la diferencia observada.'],noveltyScope:'never-happened-in-universe',summary:'El dato no cabe todavía en el modelo.'})});
 await api.tick();advance(5000);await api.tick();
 assert.deepEqual(received.unknowns,['No sabemos explicar la diferencia observada.']);assert.equal(received.lastExperiences.length,1);
 assert.equal((await api.status()).last.noveltyScope,'unresolved');assert.equal((await api.status()).last.epistemicStatus,'unexpected');
});

test('restart recovers an interrupted episode without promoting its provisional language record',async t=>{
 const {api,options,read}=await fixture(t);await api.status();
 const interrupted=await read();interrupted.attempts=4;interrupted.phase='logic';
 interrupted.current={id:'experience-interrupted',ordinal:4,goal:{...goal,goalId:'goal-interrupted'},result:{executed:true,cases:1,passed:1},language:{L:{countsAsLearning:true}},L:{countsAsLearning:true}};
 await fs.writeFile(path.join(options.directory,'experience-spiral.json'),JSON.stringify(interrupted));
 const recovered=createExperienceSpiral(options),status=await recovered.status();
 assert.equal(status.nextOrdinal,5);assert.equal(status.phase,'waiting');assert.equal(status.last.reason,'interrupted');assert.equal(status.last.countsAsLearning,false);assert.equal(status.learningChanges,0);assert.equal(status.experiences,1);
 const saved=await read();assert.equal(saved.current,null);assert.equal(Object.hasOwn(saved.history[0],'language'),false);
});

test('3D goals execute outside curriculum IDs and persist their focus without counting an artifact as a policy improvement',async t=>{
 let recent;
 const {api,advance,read}=await fixture(t,{
  proposeGoal:async input=>{recent=input.lastExperiences;return{question:'¿Qué escena 3D permite refutar la escala de una habitación?',rationale:'La calidad espacial observada necesita una prueba ejecutable nueva.',prediction:'El validador rechazará una escena que supere los límites geométricos.',kind:'creative-experiment',taskId:null,focus:'3d'};},
  execute:async({goal,ordinal})=>{assert.equal(goal.focus,'3d');assert.equal(goal.kind,'creative-experiment');assert.equal(goal.taskId,null);return{executed:true,cases:4,passed:4,acceptedChange:false,invariantsPreserved:true,evidenceHash:digest('validated-scene-'+ordinal),summary:'Escena validada; política activa intacta.'};}
 });
 const result=await api.tick();assert.equal(result.experience.goal.focus,'3d');assert.equal(result.experience.L.newEvidence,true);assert.equal(result.experience.L.acceptedChange,false);assert.equal(result.experience.L.countsAsLearning,false);
 assert.equal(result.experience.language.S.O[0].kind,'creative-experiment');assert.equal(result.experience.language.S.O[0].focus,'3d');assert.equal(result.experience.language.S.O[0].question,result.experience.goal.question);assert.equal(Object.hasOwn(result.experience.language.S.O[0],'taskId'),false);
 assert.ok(result.experience.language.S['Σ'][0].object.includes(result.experience.goal.question));assert.doesNotMatch(result.experience.language.S['Σ'][0].object,/null/);
 assert.equal((await api.status()).objective.focus,'3d');assert.equal((await api.status()).last.focus,'3d');assert.equal((await read()).history[0].goal.focus,'3d');
 advance(5000);await api.tick();assert.equal(recent[0].goal.focus,'3d');assert.equal((await api.status()).experiences,2);assert.equal((await api.status()).learningChanges,0);
});

test('unknown focus keeps inquiries open beyond named capabilities while legacy tool goals derive programming',async t=>{
 const question='¿Qué evidencia situada puede revelar un acontecimiento que no cabe aún en nuestras categorías?';
 const open=await fixture(t,{proposeGoal:async()=>({question,rationale:'El modelo actual no delimita todas las posibilidades de la observación.',prediction:'La indagación podría dejar preguntas abiertas.',kind:'open-inquiry',taskId:null,focus:'unknown'})});
 const result=await open.api.tick();assert.equal(result.experience.goal.question,question);assert.equal(result.experience.goal.focus,'unknown');assert.equal(result.experience.goal.taskId,null);assert.equal((await open.api.status()).last.focus,'unknown');
 const legacy=await fixture(t,{proposeGoal:async()=>({...goal,taskId:'merge-intervals'})});
 assert.equal((await legacy.api.tick()).experience.goal.focus,'programming');
});

test('a successful public reading without contracts records absence of contractual contrast rather than an observation failure',async t=>{
 const {api}=await fixture(t,{proposeGoal:async()=>({...goal,kind:'open-inquiry',taskId:null,focus:'research'}),execute:async()=>({executed:true,cases:0,passed:0,acceptedChange:true,invariantsPreserved:true,evidenceHash:digest('read-source'),summary:'Fuente pública recuperada.'})});
 const result=await api.tick(),record=result.experience;
 assert.equal(record.result.executed,true);assert.equal(record.result.cases,0);
 assert.deepEqual(record.language.S.F[0],{condition:'No existe contraste con contratos o alguno falla.',observed:true});
 assert.equal(record.L.newEvidence,true);assert.equal(record.reason,'completed');assert.equal(record.language.S.F[1].observed,false);
 assert.match(record.language.L.scope,/no su verdad/);assert.equal((await api.status()).nextRun,'2026-11-01T12:00:05.000Z');
 assert.equal(record.L.acceptedChange,false);assert.equal(record.L.countsAsLearning,false);assert.equal((await api.status()).learningChanges,0);
 assert.equal(record.language.S.O[0].focus,'research');assert.doesNotMatch(record.language.S['Σ'][0].object,/null/);
});

test('repeated public content hashes are not new observations even when the question or planned case changes',async t=>{
 let question=0;const {api,advance}=await fixture(t,{proposeGoal:async()=>({...goal,question:'¿Qué lectura pública número '+(++question)+' queda por observar?',kind:'open-inquiry',taskId:null,focus:'research'}),execute:async()=>({executed:true,cases:0,passed:0,acceptedChange:true,invariantsPreserved:true,evidenceHash:digest('same-public-content')})});
 const first=await api.tick();assert.equal(first.experience.L.newEvidence,true);advance(5000);
 const second=await api.tick();assert.equal(second.experience.goal.changedQuestion,true);assert.equal(second.experience.L.newEvidence,false);assert.equal(second.reason,'no_new_evidence');assert.equal(second.experience.L.countsAsLearning,false);
 assert.equal((await api.status()).learningChanges,0);assert.equal((await api.status()).nextRun,'2026-11-01T12:00:35.000Z');
});

test('an executed reading without a real content hash cannot claim new evidence or learning',async t=>{
 const {api}=await fixture(t,{proposeGoal:async()=>({...goal,kind:'open-inquiry',taskId:null,focus:'unknown'}),execute:async()=>({executed:true,cases:0,passed:0,acceptedChange:true,invariantsPreserved:true,summary:'Se afirma una lectura, sin huella verificable.'})});
 const result=await api.tick();assert.equal(result.experience.L.newEvidence,false);assert.equal(result.experience.L.acceptedChange,false);assert.equal(result.experience.L.countsAsLearning,false);assert.equal(result.reason,'no_new_evidence');assert.equal((await api.status()).learningChanges,0);
});

test('Atlas can choose Dios / Suceso as an open focus and preserve the experience without claiming a measured improvement',async t=>{
 const {api,options,read}=await fixture(t,{
  proposeGoal:async()=>({question:'¿Qué contraste observable revelaría un límite de mi entendimiento actual?',rationale:'La sorpresa observada deja una explicación abierta que merece investigar.',prediction:'Una fuente puede aportar otro contraste o mantener la incógnita sin resolver.',kind:'open-inquiry',taskId:null,focus:'suceso'}),
  execute:async()=>({executed:true,cases:0,passed:0,acceptedChange:true,invariantsPreserved:true,evidenceHash:digest('suceso-public-observation'),summary:'Una referencia pública ofrece un contraste aún sin resolver.'}),
  reflect:async()=>({consulted:true,epistemicStatus:'unexplained',unknowns:['¿Qué observación permitiría distinguir las explicaciones?'],noveltyScope:'unresolved'})
 });
 const result=await api.tick();assert.equal(result.experience.goal.focus,'suceso');assert.equal(result.experience.goal.kind,'open-inquiry');assert.equal(result.experience.goal.taskId,null);
 assert.equal(result.experience.L.newEvidence,true);assert.equal(result.experience.L.acceptedChange,false);assert.equal(result.experience.L.countsAsLearning,false);
 assert.equal(result.experience.language.S.O[0].focus,'suceso');assert.equal((await read()).history[0].goal.focus,'suceso');
 const restored=createExperienceSpiral(options),status=await restored.status();assert.equal(status.objective.focus,'suceso');assert.equal(status.last.focus,'suceso');assert.equal(status.last.epistemicStatus,'unexplained');assert.equal(status.experiences,1);assert.equal(status.learningChanges,0);
});

test('canonical public inquiries share spelling and punctuation while excluding private additions',()=>{
 const base='¿Qué documentación pública de gráficos 3D falta?';
 assert.equal(canonicalInquiryKey(base),canonicalInquiryKey(' QUE DOCUMENTACION   PUBLICA de GRAFICOS 3D falta!!! '));
 assert.equal(canonicalInquiryKey(base),canonicalInquiryKey(base+' https://example.org/private somebody@example.org C:\\private\\file.txt'));
 assert.equal(canonicalInquiryQuery(' https://example.org/alone '),'');
});

test('volatile prose and unrelated planned cases do not reopen a repair, but measured source or failure changes do',async t=>{
 let source='source-a',failure='failure-a',executions=0;
 const task='csv-parse';
 const {api,advance}=await fixture(t,{
  observe:async({ordinal})=>({facts:['Último resultado número '+ordinal],unknowns:['Pregunta narrativa '+ordinal],gaps:[{taskId:task,reason:'Texto de diagnóstico '+ordinal}],failures:Array.from({length:ordinal%2+1},()=>({taskId:task,summary:'Resumen '+ordinal,caseHash:digest(failure)})),caseHash:digest('unrelated-'+ordinal),eligibleActions:[{kind:'curriculum-repair',taskId:task,key:digest(source)}]}),
  proposeGoal:async({ordinal})=>({...goal,kind:'curriculum-repair',taskId:task,question:'¿Qué reparación textual '+ordinal+' debe revisarse ahora?'}),
  execute:async()=>{executions++;return{executed:false,cases:0,passed:0,invariantsPreserved:true,summary:'No se ejecutaron casos.'};}
 });
 assert.equal((await api.tick()).status,'retained');
 for(let index=0;index<3;index++){advance(30000);assert.equal((await api.tick()).status,'waiting');}
 assert.equal(executions,1);
 failure='failure-b';advance(30000);assert.equal((await api.tick()).status,'retained');
 source='source-b';advance(30000);assert.equal((await api.tick()).status,'retained');
 assert.equal(executions,3);assert.equal((await api.status()).learningChanges,0);
});

test('an explicit empty eligibility contract prevents historical failures and cached model goals from forcing work',async t=>{
 let eligible=true,planned=0,executions=0;
 const {api,advance}=await fixture(t,{
  observe:async()=>({facts:['Una reparación anterior quedó refutada.'],failures:[{taskId:'json-pointer-resolve',caseHash:digest('old-failure'),summary:'Fallo histórico.'}],eligibleActions:eligible?[{kind:'curriculum-repair',taskId:'json-pointer-resolve',key:digest('repair-source')}]:[]}),
  proposeGoal:async()=>{planned++;return{...goal,kind:'curriculum-repair',taskId:'json-pointer-resolve'};},
  execute:async()=>{executions++;return{executed:false,cases:0,passed:0,summary:'Fallo sin casos.'};}
 });
 await api.tick();eligible=false;advance(30000);
 const waiting=await api.tick();assert.equal(waiting.status,'waiting');assert.equal(waiting.reason,'no_eligible_goal');
 assert.equal(planned,1);assert.equal(executions,1);assert.equal((await api.status()).experiences,1);
});

test('explicit fallback keeps the executable kind instead of turning a missing-function gap into a tool trial',async t=>{
 const {api}=await fixture(t,{
  observe:async()=>({facts:['Falta una función contrastada.'],gaps:[{taskId:'json-pointer-resolve',reason:'Requiere construcción.'}],failures:[{taskId:'merge-intervals',summary:'Un fallo anterior ya no es elegible.'}],eligibleActions:[{kind:'curriculum-repair',taskId:'json-pointer-resolve',key:digest('eligible-repair')}]}),
  proposeGoal:async()=>({...goal,taskId:'merge-intervals'})
 });
 const result=await api.tick();assert.equal(result.experience.goal.kind,'curriculum-repair');assert.equal(result.experience.goal.taskId,'json-pointer-resolve');
});

test('inquiry retryAt replaces the provisional lease, survives restart and expires without synthetic fallback',async t=>{
 let executions=0,turn=0;const question='¿Qué documentación pública de gráficos falta?';
 const setup=await fixture(t,{
  observe:async({ordinal})=>({facts:['Última área '+ordinal],caseHash:digest('volatile-'+ordinal),eligibleActions:[{kind:'open-inquiry',taskId:null,focus:'research'}]}),
  proposeGoal:async()=>({...goal,kind:'open-inquiry',taskId:null,focus:'research',question:++turn%2?question:' QUE DOCUMENTACION PUBLICA DE GRAFICOS FALTA!!! '}),
  execute:async()=>{executions++;return{executed:false,cases:0,passed:0,retryAt:setup.options.now()+90000,summary:'Proveedor en espera.'};}
 });
 await setup.api.tick();setup.advance(30000);
 assert.equal((await setup.api.tick()).status,'waiting');assert.equal(executions,1);
 const resumed=createExperienceSpiral(setup.options);setup.advance(30000);assert.equal((await resumed.tick()).status,'waiting');
 setup.advance(30000);assert.equal((await resumed.tick()).status,'retained');assert.equal(executions,2);
 assert.equal((await resumed.status()).learningChanges,0);
});

test('observed pending inquiries and general budgets are enforced before an executor can run',async t=>{
 const clock=Date.parse('2026-11-01T12:00:00Z'),question='¿Qué dato público distingue estas explicaciones?';let executions=0,budget=false;
 const {api,advance}=await fixture(t,{
  observe:async()=>({facts:['Consulta conocida en espera.'],eligibleActions:[{kind:'open-inquiry',taskId:null}],pendingInquiries:[{key:canonicalInquiryKey(question),retryAt:clock+600000}],inquiryBudgetRetryAt:budget?clock+600000:null}),
  proposeGoal:async()=>({...goal,kind:'open-inquiry',taskId:null,focus:'suceso',question:budget?'¿Qué otro dato público requiere una búsqueda diferente?':question}),
  execute:async()=>{executions++;return{};}
 });
 assert.equal((await api.tick()).status,'waiting');budget=true;advance(30000);assert.equal((await api.tick()).status,'waiting');assert.equal(executions,0);assert.equal((await api.status()).experiences,0);
});

test('legacy history migrates stable action leases without resetting counters or blocking the same evidence forever',async t=>{
 let executions=0;const source=digest('migration-source');
 const setup=await fixture(t,{
  observe:async()=>({facts:['Misma evidencia física.'],caseHash:digest('cases'),eligibleActions:[{kind:'curriculum-repair',taskId:'json-pointer-resolve',key:source}]}),
  proposeGoal:async()=>({...goal,kind:'curriculum-repair',taskId:'json-pointer-resolve'}),
  execute:async()=>{executions++;return{executed:false,cases:0,passed:0,summary:'No se produjo otra evidencia.'};}
 });
 await setup.api.tick();const saved=await setup.read();delete saved.actionAttempts;
 await fs.writeFile(path.join(setup.options.directory,'experience-spiral.json'),JSON.stringify(saved));
 setup.advance(30000);const resumed=createExperienceSpiral(setup.options);
 assert.equal((await resumed.tick()).status,'waiting');assert.equal(executions,1);assert.equal((await resumed.status()).experiences,1);
 const migrated=await setup.read();assert.equal(migrated.actionAttempts.length,1);assert.equal(migrated.history[0].id,saved.history[0].id);assert.equal(migrated.learningChanges,saved.learningChanges);
 setup.advance(24*3600000);assert.equal((await resumed.tick()).status,'retained');assert.equal(executions,2);
});

test('creative inquiries retain distinct design questions while narration does not repeat the same design',async t=>{
 let turn=0,executions=0;
 const {api,advance}=await fixture(t,{
  observe:async({ordinal})=>({facts:['Otro resumen '+ordinal],caseHash:digest('prose-'+ordinal),eligibleActions:[{kind:'creative-experiment',taskId:null,focus:'3d'}]}),
  proposeGoal:async()=>({...goal,kind:'creative-experiment',taskId:null,focus:'3d',question:++turn<3?'¿Qué banco 3D se puede construir con dos soportes?':'¿Qué lámpara 3D resulta legible junto a los puestos?'}),
  execute:async({ordinal})=>{executions++;return{executed:true,cases:6,passed:6,acceptedChange:false,invariantsPreserved:true,evidenceHash:digest('artwork-'+ordinal)};}
 });
 assert.equal((await api.tick()).status,'retained');advance(5000);assert.equal((await api.tick()).status,'waiting');advance(30000);assert.equal((await api.tick()).status,'retained');
 assert.equal(executions,2);assert.equal((await api.status()).learningChanges,0);
});
