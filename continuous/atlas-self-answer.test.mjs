import test from 'node:test';import assert from 'node:assert/strict';import {chat} from './chat.mjs';import {formatAtlasSelfAnswer} from './atlas-self-answer.mjs';
const capabilities={house:{available:true},selfModification:{strategyPolicy:true},publicDocs:{connected:true,searchAvailable:true},experience:{enabled:true}};
test('introspection corrects blanket denials while keeping MCP scope separate from local code executors',async()=>{
 const message='Corrige tu respuesta anterior de solo texto: explica tu identidad, ERAS y el tiempo como tangente. ¿Qué conexión MCP puedes utilizar y cómo sabes si tus habitantes reflejan trabajo real?';
 const result=await chat({messages:[{role:'assistant',content:'No puedo modificar código ni crear música.'},{role:'user',content:message}]},[],()=>{throw Error('Introspection must use the runtime inventory');},'','',null,'',[],'',{sharedSession:true,capabilities});
 assert.equal(result.model,'atlas-coordinator');assert.match(result.answer,/incorporar funciones y políticas/);assert.match(result.answer,/Su límite no elimina mis otros ejecutores/);assert.match(result.answer,/ERAS/);assert.match(result.answer,/tangente/);assert.match(result.answer,/contador del coordinador/);assert.doesNotMatch(result.answer,/No puedo modificar código/);assert.ok(result.answer.split(/\s+/).length<=150);
});
test('ordinary coding, fiction and servers without inventory still reach the model',()=>{
 for(const message of ['Mejora este código JavaScript','Crea una casa 3D','Escribe un cuento: ¿quién eres?','Hola'])assert.equal(formatAtlasSelfAnswer(message,capabilities),null);
 assert.equal(formatAtlasSelfAnswer('¿Quién eres?',{}),null);assert.match(formatAtlasSelfAnswer('¿Puedes mejorarte?',capabilities),/contratos/);
});
