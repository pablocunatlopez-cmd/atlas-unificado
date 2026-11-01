import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chat} from './chat.mjs';
test('shared visitor prompt contains public method without the owners historical foundation',async()=>{
 let first;
 const result=await chat({messages:[{role:'user',content:'Hola'}]},[],async(url,options)=>{first??=JSON.parse(options.body);return {ok:true,json:async()=>({choices:[{message:{content:'Hola'}}]})};},'','',null,'',[],'',{sharedSession:true});
 const prompt=first.messages.filter(item=>item.role==='system').map(item=>item.content).join('\n');
 assert.match(prompt,/conversación compartida aislada/);assert.match(prompt,/Observar → Comprender/);assert.doesNotMatch(prompt,/SEMILLA FUNDACIONAL INMUTABLE|usuario aclaró|organigrama|own-model/i);
 assert.equal(result.model,'atlas-local');assert.equal(result.trained,false);assert.equal(result.reflectionMemoryUsed,0);assert.deepEqual(result.sources,[]);
});
test('structured creative calls preserve the single JSON contract and leave criticism to the orchestrator',async()=>{
 let calls=0;const expected={title:'Galería',variant:'gallery',palette:'Blanco',lighting:'sunset',objects:[]};
 const result=await chat({json:true,messages:[{role:'user',content:'Diseña un videojuego y revisa sus errores. Devuelve solo el plan JSON.'}]},[],async(url,options)=>{calls++;assert.deepEqual(JSON.parse(options.body).response_format,{type:'json_object'});return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(expected)}}]})};},'','',null,'',[],'',{sharedSession:true});
 assert.equal(calls,1);assert.deepEqual(JSON.parse(result.answer),expected);assert.equal(result.reviewed,false);
});
