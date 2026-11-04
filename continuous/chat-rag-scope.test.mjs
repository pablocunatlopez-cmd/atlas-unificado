import test from 'node:test';
import assert from 'node:assert/strict';
import {chat,memoryQuery} from './chat.mjs';
const documents=[{url:'https://example.org/public-reference',role:'reference',text:'Q594 confirma el puerto verificado del prototipo Órbita. Qwen3 aporta su ficha técnica.',fetchedAt:'2026-11-04T00:00:00Z'},{url:'https://example.org/heldout',role:'validation',text:'Q594 dato de evaluación reservado.'},{url:'https://example.org/private',role:'private',text:'Q594 secreto fuera del ámbito documental.'}];
const request=async()=>Response.json({choices:[{message:{content:'Consulta completada.'}}]});
const runtime={cognitiveCore:{decide:async()=>({review:false})}};
test('query keeps model and product identifiers while ordinary numeric arithmetic stays out of retrieval',()=>{
 assert.equal(memoryQuery('Q594 Qwen3.5 3D Órbita'),'q594 qwen3 3d orbita');assert.equal(memoryQuery('¿Cuánto es 17 por 23?'),'');
});
test('owner retrieval includes public references without admitting validation or unknown private roles',async()=>{
 const result=await chat({messages:[{role:'user',content:'Q594'}]},documents,request,'','',null,'',[],'',runtime);assert.deepEqual(result.sources.map(x=>x.url),[documents[0].url]);assert.equal(result.trained,false);
});
test('shared sessions cannot retrieve the owner corpus even if a caller accidentally supplies it',async()=>{
 const result=await chat({messages:[{role:'user',content:'Q594'}]},documents,request,'','',null,'',[],'',{...runtime,sharedSession:true});assert.deepEqual(result.sources,[]);assert.equal(result.trained,false);
});
