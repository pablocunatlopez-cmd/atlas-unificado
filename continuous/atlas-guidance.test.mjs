import test from 'node:test';import assert from 'node:assert/strict';import {chat} from './chat.mjs';
test('advice about new capabilities reaches Qwen with relevant curated references instead of a canned self-description',async()=>{
 let payload,calls=0;
 const result=await chat({messages:[{role:'user',content:'Recomiéndame repositorios útiles para ampliar tus capacidades sin desperdiciar tiempo.'}]},[],async(_url,options)=>{calls++;payload=JSON.parse(options.body);return Response.json({choices:[{message:{content:'Elegiré una tarea contrastable antes de añadir herramientas.'},finish_reason:'stop'}]});},'','',null,'',[],'',{sharedSession:true,cognitiveCore:{decide:async()=>({review:false})},capabilities:{house:{available:true},selfModification:{strategyPolicy:true}}});
 assert.equal(calls,1);assert.equal(result.model,'atlas-local');assert.equal(result.trained,false);
 const system=payload.messages.filter(item=>item.role==='system').map(item=>item.content).join('\n');
 assert.match(system,/https:\/\/github.com\/EleutherAI\/lm-evaluation-harness/);assert.match(system,/no código ejecutado ni conexiones instaladas/);assert.match(system,/no lecturas o instalaciones ejecutadas en este turno/);assert.match(system,/sin evidencia|sin necesidad/);
});
