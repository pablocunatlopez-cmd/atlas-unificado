import test from 'node:test';import assert from 'node:assert/strict';import {chat} from './chat.mjs';
import {atlasGuidance,relevantAtlasGuidance} from './atlas-guidance.mjs';
import {atlasApplicationCapabilities} from './atlas-capabilities.mjs';
test('external-agent questions keep model access, licence and measured integration separate',()=>{
 for(const question of ['Constelación y el espejo exterior','Claude y GitHub','Agentes gratuitos para mejorar Atlas']){
  const advice=relevantAtlasGuidance(question),direction=advice.directions.find(item=>item.id==='espejo-exterior');
  assert.ok(direction);assert.match(direction.success,/coste del modelo.*compatibilidad/);
  assert.match(direction.success,/no conviene integrar/);
  for(const id of ['openhands','goose','claude-sdk','claude-skills'])assert.equal(advice.resources.find(item=>item.id===id).integration,'reference-only');
 }
 const sdk=atlasGuidance.resources.find(item=>item.id==='claude-sdk'),skills=atlasGuidance.resources.find(item=>item.id==='claude-skills');
 assert.match(sdk.use,/no proporciona acceso gratuito/);assert.match(skills.use,/licencia de cada carpeta/);
});
test('advice about new capabilities reaches Qwen with relevant curated references instead of a canned self-description',async()=>{
 let payload,calls=0;
 const result=await chat({messages:[{role:'user',content:'Recomiéndame repositorios útiles para ampliar tus capacidades sin desperdiciar tiempo.'}]},[],async(_url,options)=>{calls++;payload=JSON.parse(options.body);return Response.json({choices:[{message:{content:'Elegiré una tarea contrastable antes de añadir herramientas.'},finish_reason:'stop'}]});},'','',null,'',[],'',{sharedSession:true,cognitiveCore:{decide:async()=>({review:false})},capabilities:{house:{available:true},selfModification:{strategyPolicy:true}}});
 assert.equal(calls,1);assert.equal(result.model,'atlas-local');assert.equal(result.trained,false);
 const system=payload.messages.filter(item=>item.role==='system').map(item=>item.content).join('\n');
 assert.match(system,/https:\/\/github.com\/EleutherAI\/lm-evaluation-harness/);assert.match(system,/no código ejecutado ni conexiones instaladas/);assert.match(system,/no lecturas o instalaciones ejecutadas en este turno/);assert.match(system,/sin evidencia|sin necesidad/);
});

test('the autonomous 3D direction knows the house integration while retaining geometric and epistemic limits',()=>{
 const direction=atlasGuidance.directions.find(item=>item.id==='artefacto-3d'),house=atlasApplicationCapabilities().house;
 assert.match(direction.currentIntegration,new RegExp(house.residents.total+' habitantes: '+house.residents.workstations+' puestos y '+house.residents.audience+' espectadores'));
 assert.match(direction.currentIntegration,/6\/6 contratos geométricos/);assert.match(direction.currentIntegration,/maqueta.*terraza/);
 assert.match(direction.currentIntegration,/no prueba de aplicación en este turno/);assert.match(direction.currentIntegration,/entrenamiento de Qwen ni mejora estética/);
 assert.equal(relevantAtlasGuidance('Cómo mejorar la casa 3D').directions[0].currentIntegration,direction.currentIntegration);
});
