import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectCommand,answerProjectCommand} from './project-actions.mjs';
test('ordinary conversation and quoted commands never launch a process',()=>{
 for(const text of ['quiero un prototipo','Explica /atlas aprender','`/atlas aprender`','/atlas aprender ahora','/prototipo','/atlas borrar'])assert.equal(projectCommand(text),null);
});
test('explicit commands retain content without interpreting shell characters',()=>{
 assert.deepEqual(projectCommand('/prototipo una ciudad\n$(whoami)'),{action:'game',input:{prompt:'una ciudad\n$(whoami)'}});
 assert.deepEqual(projectCommand('/laboratorio ¿Esto tiene fuente?'),{action:'decision',input:{question:'¿Esto tiene fuente?'}});
 for(const [word,action] of [['estado','status'],['aprender','train'],['parar','stop']])assert.equal(projectCommand('/atlas '+word).action,action);
});
test('only generated local artifacts can become executable links',async()=>{
 for(const artifactUrl of ['https://evil.invalid/a','/project/artifacts/../key','/project/artifacts/a/%2e%2e','javascript:alert(1)']){
  await assert.rejects(answerProjectCommand({action:'game',input:{}},{run:async()=>({artifactUrl})}),/artefacto válido/);
 }
 const result=await answerProjectCommand({action:'game',input:{}},{run:async()=>({artifactUrl:'/project/artifacts/game-1/index.html'})});
 assert.match(result.answer,/http:\/\/127\.0\.0\.1:8788\/project\/artifacts\/game-1\/index.html/);
 assert.match(result.answer,/plantillas y reglas/);assert.equal(result.model,'atlas-coordinator');
});
test('errors and cancellation never become success reports',async()=>{
 await assert.rejects(answerProjectCommand({action:'train',input:{}},{run:async()=>{throw Error('falló');}}),/falló/);
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(answerProjectCommand({action:'train',input:{}},{run:async()=>{calls++;},signal:controller.signal}));assert.equal(calls,0);
});
