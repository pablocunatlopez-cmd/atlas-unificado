import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateCreativePlan,planCreativeWorld,creativePlanPrompt} from './plan.mjs';
const valid={title:'Bosque dorado',variant:'forest',lighting:'sunset',palette:'Verde',objects:[{type:'box',position:[5,1,0],size:[1,1,1],material:4,yaw:0}]};
test('plans accept data while discarding executable and remote fields',()=>{const plan=validateCreativePlan({...valid,code:'fetch(secret)',url:'https://bad.invalid'});assert.equal(plan.code,undefined);assert.equal(plan.url,undefined);assert.equal(plan.objects.length,1);});
test('observed Qwen palette lists canonicalise to one known name without accepting custom code or CSS',()=>{
 for(const palette of [['Blanco','Oro'],'Blanco|Oro',' Blanco, Oro '])assert.equal(validateCreativePlan({...valid,palette}).palette,'Blanco');
 for(const palette of [[],['Blanco','url(secret)'],'Blanco|#fff','Blanco|fetch(secret)',{primary:'Blanco'}])assert.throws(()=>validateCreativePlan({...valid,palette}),/palette/);
 const prompt=creativePlanPrompt('Una galería blanca y dorada','3d');assert.match(prompt,/"palette":"Blanco"/);assert.match(prompt,/No uses arrays/);assert.match(prompt,/SEMIEJES/);
});
test('nonfinite geometry, oversized assets and blocked game spawns fail before rendering',()=>{
 for(const mutation of [{position:[NaN,1,0]},{size:[100,1,1]},{position:[0,0,0]},{type:'script'},{material:99}])assert.throws(()=>validateCreativePlan({...valid,objects:[{...valid.objects[0],...mutation}]}));
 assert.throws(()=>validateCreativePlan({...valid,variant:'exploration',objects:[{...valid.objects[0],position:[0,1,8]}]},'game'),/inicio/);
 assert.throws(()=>validateCreativePlan({...valid,objects:[{...valid.objects[0],position:[4,1.2,10],size:[1.5,1.5,1.5]}]}),/Objeto 1: position\[1\]=1.2.*size\[1\]=1.5/);
});
test('architecture repairs against external failure and critic revision must revalidate',async()=>{
 const replies=[{...valid,objects:[{...valid.objects[0],size:[99,1,1]}]},valid,{ok:false,issues:['Falta contraste'],suggestion:'Añadir azul'},{...valid,palette:'Azul'}],stages=[];
 const result=await planCreativeWorld('Un bosque','3d',async()=>replies.shift(),{onStage:event=>stages.push(event.stage)});
 assert.equal(result.plan.palette,'Azul');assert.equal(result.review.attempts,2);assert.equal(result.review.revised,true);assert.match(result.review.critic,/no es otro modelo/);assert.deepEqual(stages,['architect','repair','critic','revision']);
});
test('invalid critic repair preserves the last validated plan and cancellation is not success',async()=>{
 const replies=[valid,{ok:false,issues:['opinion']},{...valid,variant:'javascript'}];const result=await planCreativeWorld('Un bosque','3d',async()=>replies.shift());assert.equal(result.plan.variant,'forest');assert.equal(result.review.revised,false);
 const abort=new AbortController();abort.abort();await assert.rejects(planCreativeWorld('Bosque','3d',async()=>valid,{signal:abort.signal}));
});
