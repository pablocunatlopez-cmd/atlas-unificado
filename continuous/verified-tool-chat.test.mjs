import test from 'node:test';
import assert from 'node:assert/strict';
import {chat} from './chat.mjs';
const run={used:true,toolId:'private-runtime-id',name:'Planificar dependencias de proyectos',curriculumTaskId:'dag-dependency-plan',at:'2026-11-01T17:52:05.115Z',input:{tasks:[{id:'release',dependsOn:['test']},{id:'docs',dependsOn:[]},{id:'test',dependsOn:['build']},{id:'build',dependsOn:[]}]},result:{order:['build','docs','test','release'],blocked:[]}};
test('a verified dependency result uses the coordinator without another model generation or private context',async()=>{
 let requests=0;
 const result=await chat({messages:[{role:'user',content:'Planifica las dependencias de este proyecto.'}],internet:false,external:false,refute:false},[{text:'private context must remain absent'}],async()=>{requests++;throw Error('No model call expected');},'private-local-key','',run,'private mandate',[],'',{sharedSession:true});
 assert.equal(requests,0);assert.equal(result.model,'atlas-coordinator');assert.equal(result.trained,false);assert.equal(result.reflectionMemoryUsed,0);assert.deepEqual(result.sources,[]);assert.deepEqual(result.performance.generations,[]);assert.equal(result.toolRun,run);
 assert.match(result.answer,/build/);assert.match(result.answer,/release/);assert.doesNotMatch(result.answer,/private|runtime-id|2026-11-01|óptim|optimal|mermaid/i);
});
test('an explicit review request still follows the requested model review path',async()=>{
 await assert.rejects(chat({messages:[{role:'user',content:'Revisa y explica este plan de dependencias.'}],refute:true},[],async()=>{throw Error('Requested model review reached');},'', '',run),/Requested model review reached/);
});
