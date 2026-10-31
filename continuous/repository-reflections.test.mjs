import test from 'node:test';
import assert from 'node:assert/strict';
import {reflectRepository,repositoryReflectionId} from './repository-reflections.mjs';
const doc={role:'reference',url:'https://github.com/example/project',hash:'source-digest',text:'Contenido de referencia. '.repeat(20),fetchedAt:'2026-10-31T12:00:00Z'};
const response=value=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(value)}}]})});
const note={summary:'Biblioteca de ejemplo',possibleUse:'Evaluar integración',risks:'Licencia pendiente',nextExperiment:'Preparar prueba aislada'};
test('produce hipótesis con procedencia sin ejecutar propuestas ni elevar evidencia',async()=>{
 const result=await reflectRepository(doc,'local-key',{request:async(url,options)=>{assert.equal(url,'http://127.0.0.1:11435/v1/chat/completions');const body=JSON.parse(options.body);assert.equal(body.thinking_budget_tokens,0);assert.match(body.messages[0].content,/no se ejecuta automáticamente/);return response(note);}});
 assert.equal(result.evidence,'D');assert.equal(result.executed,false);assert.equal(result.trained,false);assert.equal(result.sourceHash,doc.hash);
 assert.notEqual(repositoryReflectionId(doc),repositoryReflectionId({...doc,hash:'changed'}));
});
test('rechaza referencias no leídas, respuestas inválidas y cancelaciones',async()=>{
 await assert.rejects(reflectRepository({...doc,role:'train'},''),/referencia/);
 await assert.rejects(reflectRepository(doc,'',{request:async()=>response({summary:'No basta'})}),/possibleUse/);
 await assert.rejects(reflectRepository(doc,'',{signal:AbortSignal.abort(Error('Chat prioritario')),request:async()=>{throw Error('No llamar');}}),/prioritario/);
});
