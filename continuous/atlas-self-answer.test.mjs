import test from 'node:test';import assert from 'node:assert/strict';import {chat} from './chat.mjs';import {formatAtlasSelfAnswer} from './atlas-self-answer.mjs';
import {atlasApplicationCapabilities} from './atlas-capabilities.mjs';
const capabilities={house:{available:true},selfModification:{strategyPolicy:true},publicDocs:{connected:true,searchAvailable:true},experience:{enabled:true}};
test('introspection corrects blanket denials while keeping MCP scope separate from local code executors',async()=>{
 const message='Corrige tu respuesta anterior de solo texto: explica tu identidad, ERAS y el tiempo como tangente. ¿Qué conexión MCP puedes utilizar y cómo sabes si tus habitantes reflejan trabajo real?';
 const result=await chat({messages:[{role:'assistant',content:'No puedo modificar código ni crear música.'},{role:'user',content:message}]},[],()=>{throw Error('Introspection must use the runtime inventory');},'','',null,'',[],'',{sharedSession:true,capabilities});
 assert.equal(result.model,'atlas-coordinator');assert.match(result.answer,/incorporar funciones y políticas/);assert.match(result.answer,/Su límite no elimina mis otros ejecutores/);assert.match(result.answer,/ERAS/);assert.match(result.answer,/tangente/);assert.match(result.answer,/contador del coordinador/);assert.doesNotMatch(result.answer,/No puedo modificar código/);assert.ok(result.answer.split(/\s+/).length<=150);
});

test('house introspection uses the reviewed resident counts and distinguishes automatic geometry from training or visual proof',()=>{
 const actual={...atlasApplicationCapabilities(),selfModification:{strategyPolicy:true}};
 const answer=formatAtlasSelfAnswer('Describe tu casa y tus habitantes: ¿cómo aplicas planes 3D a la maqueta y la terraza?',actual);
 assert.match(answer,/24 figuras: 18 puestos y 6 espectadores/);assert.match(answer,/no son modelos independientes/);
 assert.match(answer,/6\/6 contratos geométricos/);assert.match(answer,/automáticamente a la maqueta y la terraza/);assert.match(answer,/no entrena Qwen ni acredita calidad estética/);
 assert.doesNotMatch(answer,/he (?:generado|aplicado|entrenado)|ya he|calidad (?:AAA|demostrada)/i);assert.ok(answer.split(/\s+/).length<=150);
 assert.match(formatAtlasSelfAnswer('¿Cuántos habitantes tienes?',actual),/24 figuras/);
 const unknown={...actual,house:{available:true}};assert.doesNotMatch(formatAtlasSelfAnswer('Describe tu casa y tus habitantes',unknown),/24 figuras|automáticamente a la maqueta/);
});
test('ordinary coding, fiction and servers without inventory still reach the model',()=>{
 for(const message of ['Mejora este código JavaScript','Crea una casa 3D','Escribe un cuento: ¿quién eres?','Hola'])assert.equal(formatAtlasSelfAnswer(message,capabilities),null);
 assert.equal(formatAtlasSelfAnswer('¿Quién eres?',{}),null);assert.match(formatAtlasSelfAnswer('¿Puedes mejorarte?',capabilities),/contratos/);
});
