import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createExperienceRuntime} from './experience-runtime.mjs';
import {ATLAS_SPECIALISTS} from './atlas-specialists.mjs';
import {createSpecialistTelemetry} from './specialists-status.mjs';

const goal={question:'¿Qué evidencia permite comprobar una escena SECRET-QUESTION?',rationale:'Contrastar una referencia pública antes de proponer una mejora.',prediction:'La consulta puede aportar una fuente sin acreditar una mejora.',kind:'open-inquiry',taskId:null,focus:'3d'};
const source={url:'https://example.org/reference',title:'Referencia pública',excerpt:'Una referencia SECRET-SOURCE para contrastar la escena.',fetchedAt:'2026-11-04T00:00:00Z'};
const reflection={summary:'La referencia necesita contraste.',epistemicStatus:'unassessed',unknowns:['¿Qué prueba falta?'],noveltyScope:'unresolved'};
async function temp(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-experience-specialists-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));return directory;}
const evidence={status:async()=>({documents:0}),recall:async()=>({sources:[source]}),remember:async()=>({stored:1,newDocuments:1})};
const common={getTools:async()=>[],setTools:async()=>assert.fail('No promotion expected'),build:async()=>assert.fail('No repair expected'),now:()=>Date.UTC(2026,10,4,1),evidence};

test('the experience loop executes ten checks at each review boundary without adding model calls or private telemetry',async t=>{
 const telemetry=createSpecialistTelemetry({catalog:ATLAS_SPECIALISTS,now:common.now}),reports=[],prompts=[];let lookups=0;
 const runtime=createExperienceRuntime({...common,directory:await temp(t),onSpecialistReview:report=>{reports.push(report);telemetry.record(report,'experience');},lookup:async()=>{lookups++;return{sources:[source],errors:[]};},generate:async prompt=>{prompts.push(prompt);return prompts.length===1?goal:reflection;}});
 const result=await runtime.tick();assert.equal(result.status,'retained');assert.equal(lookups,1);assert.equal(prompts.length,2,'planning and reflection retain their existing calls');assert.equal(result.experience.L.countsAsLearning,false);
 assert.equal(reports.length,3);assert(reports.every(report=>report.executedChecks===10&&report.modelCalls===0&&report.networkCalls===0));
 assert(prompts.every(prompt=>prompt.includes('Perspectivas de especialistas locales del mismo Qwen, sin inferencias adicionales:')));
 const status=await runtime.status(),metrics=telemetry.status();assert.equal(status.specialists.executedChecks,10);assert.equal(status.specialists.modelCalls,0);assert.equal(metrics.reviews,3);assert.equal(metrics.checks,30);assert.equal(metrics.independentModels,0);
 assert.doesNotMatch(JSON.stringify({reports,metrics,specialists:status.specialists}),/SECRET|https:\/\/example\.org/);
});

test('cancellation during recall prevents later checks, lookup and reflection from being counted or executed',async t=>{
 const controller=new AbortController(),reason=Error('cancelled while recalling experience');let recalls=0,calls=0,lookups=0;
 const telemetry=createSpecialistTelemetry({catalog:ATLAS_SPECIALISTS,now:common.now});
 const runtime=createExperienceRuntime({...common,directory:await temp(t),evidence:{...evidence,recall:async()=>{if(++recalls===2)controller.abort(reason);return{sources:[source]};}},onSpecialistReview:report=>telemetry.record(report,'experience'),lookup:async()=>{lookups++;return{sources:[source],errors:[]};},generate:async()=>{calls++;return goal;}});
 await assert.rejects(runtime.tick({signal:controller.signal}),error=>error===reason);
 assert.equal(recalls,2);assert.equal(calls,1);assert.equal(lookups,0);assert.equal(telemetry.status().reviews,1);assert.equal(telemetry.status().checks,10);
 const status=await runtime.status();assert.equal(status.learningChanges,0);assert.equal(status.last.reason,'cancelled');assert.equal(status.last.acceptedChange,false);
});
