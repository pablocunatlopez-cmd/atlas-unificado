import test from 'node:test';import assert from 'node:assert/strict';
import {sanitizeExperienceStatus} from './experience-status.mjs';
test('experience telemetry preserves events and unknowns without publishing private hypotheses',()=>{
 const value=sanitizeExperienceStatus({enabled:true,paused:false,running:true,phase:'constellation',objective:{question:'private hypothesis',prediction:'private prediction',kind:'tool-experiment',taskId:'dag-dependency-plan',revision:3},last:{at:'2026-11-01T18:00:00Z',taskId:'dag-dependency-plan',executed:true,cases:8,passed:7,acceptedChange:false,reason:'completed',epistemicStatus:'unexplained',unknownsCount:2,unknowns:['private unknown'],noveltyScope:'universal-new'},experiences:4,learningChanges:1,nextRun:null});
 assert.equal(value.running,true);assert.equal(value.objective.question,'Planificar dependencias de proyectos');assert.equal(value.last.unknownsCount,2);assert.equal(value.last.noveltyScope,'unresolved');assert.doesNotMatch(JSON.stringify(value),/private|universal-new/);assert.deepEqual(sanitizeExperienceStatus(value),value);
});
test('open inquiry is not restricted to six task families and never claims omniscience',()=>{
 const value=sanitizeExperienceStatus({enabled:true,running:true,phase:'mind',objective:{kind:'open-inquiry',taskId:null,question:'private free question'},experiences:2,learningChanges:3});
 assert.equal(value.objective.taskId,null);assert.equal(value.objective.question,'Explorar un suceso no explicado');assert.equal(value.learningChanges,2);
 for(const patch of [{paused:true},{enabled:false},{phase:'imaginary'},{phase:'waiting'}])assert.equal(sanitizeExperienceStatus({...value,...patch}).running,false);
 assert.equal(sanitizeExperienceStatus(null),null);
});
test('Dios / Suceso remains an optional public focus while private hypotheses and unknowns stay local',()=>{
 const value=sanitizeExperienceStatus({enabled:true,running:true,phase:'mind',objective:{kind:'open-inquiry',focus:'suceso',taskId:null,question:'private free question',prediction:'private prediction',revision:5},last:{at:'2026-11-01T18:00:00Z',focus:'suceso',taskId:null,executed:true,cases:0,passed:0,acceptedChange:false,reason:'completed',epistemicStatus:'unexplained',unknownsCount:1,unknowns:['private unknown'],noveltyScope:'unresolved'},experiences:1,learningChanges:0});
 assert.equal(value.objective.focus,'suceso');assert.equal(value.objective.question,'Observar límites del entendimiento');assert.equal(value.last.focus,'suceso');assert.equal(value.learningChanges,0);assert.equal(value.last.acceptedChange,false);
 assert.doesNotMatch(JSON.stringify(value),/private/);assert.deepEqual(sanitizeExperienceStatus(value),value);
});
