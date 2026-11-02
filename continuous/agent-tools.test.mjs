import test from 'node:test';import assert from 'node:assert/strict';
import {useExtension} from './agent-tools.mjs';import {buildExtension} from './extensions.mjs';
import {getAutonomousTask} from './autonomy-curriculum.mjs';
import {validateMessages} from './chat.mjs';
const tool={id:'sum',name:'suma',task:'Sumar lista',passed:true,source:'function transform(x){return x.reduce((a,b)=>a+b,0)}'};
test('ejecuta herramienta real y rechaza un ID inventado o deshabilitado',async()=>{
 const messages=[{role:'user',content:'Suma 4 y 5'}];
 const good=await useExtension(messages,[tool],'',async()=>({answer:JSON.stringify({toolId:'sum',input:[4,5]})}));assert.equal(good.result,9);
 const bad=await useExtension(messages,[tool],'',async()=>({answer:JSON.stringify({toolId:'shell',input:'whoami'})}));assert.equal(bad.used,false);
 const disabled=await useExtension(messages,[{...tool,passed:false}],'',()=>{throw Error('No debe llamar al modelo');});assert.equal(disabled.used,false);
});
test('los casos externos impiden aprobar código incorrecto y guían reparación registrada',async()=>{
 let calls=0;const cases=[{input:[2,3],expected:5}];
 const record=await buildExtension('Sumar listas','',cases,async()=>{calls++;return {answer:JSON.stringify({name:'suma',source:calls===1?'function transform(){return 0}':tool.source,tests:[{input:[],expected:0}],acceptanceTests:[]})};});
 assert.equal(calls,2);assert.equal(record.passed,true);assert.equal(record.attempts[0].passed,false);assert.deepEqual(record.acceptanceTests,cases);assert.equal(record.acceptanceResults[0].actual,5);
});

const dedupe={id:'dedupe',name:'Deduplicar valores',task:'Entrada {values:[...]}; salida {values:[...]} sin duplicados.',passed:true,curriculumTaskId:'stable-dedupe',source:'function transform(input){return {values:input.values.filter((value,index,array)=>array.indexOf(value)===index)}}'};
const statistics={id:'stats',name:'Estadísticas numéricas',task:'Entrada {values:[...]}; salida count,sum,min,max,mean,median.',passed:true,curriculumTaskId:'numeric-statistics',source:'function transform(input){const a=input.values.slice().sort((a,b)=>a-b),n=a.length,sum=input.values.reduce((a,b)=>a+b,0);return {count:n,sum,min:n?a[0]:null,max:n?a[n-1]:null,mean:n?sum/n:null,median:n?(n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2):null}}'};
const choose=plan=>async()=>({answer:JSON.stringify(plan)});
const message=content=>[{role:'user',content}];

test('un único plan compone deduplicación y estadísticas reales con procedencia y sin mutar la entrada literal',async()=>{
 let calls=0;const input={values:[10,2,10,4,2]},before=structuredClone(input),plan={steps:[{toolId:'dedupe',input},{toolId:'stats',inputFrom:'previous'}]};
 const result=await useExtension(message('Deduplica estos números y después calcula sus estadísticas.'),[dedupe,statistics],'',async()=>{calls++;return {answer:JSON.stringify(plan)};});
 assert.equal(calls,1);assert.equal(result.used,true);assert.equal(result.toolId,'stats');assert.equal(result.curriculumTaskId,'numeric-statistics');assert.deepEqual(input,before);
 assert.deepEqual(result.result,{count:3,sum:16,min:2,max:10,mean:16/3,median:4});assert.deepEqual(result.input,{values:[10,2,4]});assert.equal(result.steps.length,2);assert.equal(result.steps[0].inputSource,'literal');assert.equal(result.steps[1].inputSource,'previous');assert.deepEqual(result.steps[1].input,result.steps[0].result);assert.ok(result.steps.every(step=>step.status==='completed'));assert.match(result.scope,/único planificador/i);assert.doesNotMatch(result.scope,/mejora aceptada|varios modelos/i);
});

test('JSON null, primitivas y planes incompletos se rechazan sin excepción ni ejecución',async()=>{
 for(const plan of [null,[],4,'sum',{}, {toolId:'sum'}, {steps:[]}, {steps:null}, {toolId:'sum',input:[4,5],steps:[]}]){
  const result=await useExtension(message('Suma los datos'),[tool],'',choose(plan));assert.equal(result.used,false,JSON.stringify(plan));assert.deepEqual(result.steps,[]);
 }
 const absent=await useExtension(message('Hola'),[tool],'',choose({toolId:null}));assert.equal(absent.used,false);assert.match(absent.reason,/Ninguna herramienta/);
});

test('todos los ID y formatos se validan antes del primer paso aislado',async()=>{
 const mustNotRun={...tool,source:'function transform(){throw Error("FIRST_STEP_EXECUTED")}',id:'first'};
 for(const steps of [
  [{toolId:'first',input:[]},{toolId:'missing',inputFrom:'previous'}],
  [{toolId:'first',input:[]},{toolId:'sum',inputFrom:'previous.values'}],
  [{toolId:'first',input:[]},{toolId:'sum',input:[],inputFrom:'previous'}],
  [{toolId:'first',inputFrom:'previous'}],
  [{toolId:'first',input:[]},{toolId:'sum',input:[]},{toolId:'sum',input:[]},{toolId:'sum',input:[]}],
  [{toolId:'first',input:[]},{toolId:'sum',input:[],extra:'not permitted'}]
 ]){
  const result=await useExtension(message('Compón las operaciones'),[mustNotRun,tool],'',choose({steps}));assert.equal(result.used,false);assert.deepEqual(result.steps,[]);assert.match(result.reason,/Plan rechazado/);assert.equal(Object.hasOwn(result,'error'),false);
 }
});

test('un fallo del segundo paso conserva su recibo anterior pero no publica un éxito parcial como resultado final',async()=>{
 const fail={...statistics,source:'function transform(){throw Error("SECOND_STEP_FAILED")}'},result=await useExtension(message('Deduplica y calcula'),[dedupe,fail],'',choose({steps:[{toolId:'dedupe',input:{values:[1,1,2]}},{toolId:'stats',inputFrom:'previous'}]}));
 assert.equal(result.used,false);assert.equal(result.partial,true);assert.equal(result.failedStep,2);assert.equal(result.steps.length,2);assert.equal(result.steps[0].status,'completed');assert.deepEqual(result.steps[0].result,{values:[1,2]});assert.equal(result.steps[1].status,'failed');assert.match(result.error,/SECOND_STEP_FAILED/);assert.equal(Object.hasOwn(result,'result'),false);assert.match(result.scope,/no acreditan el resultado final/);
});

test('una composición puede repetir herramientas o usar otra entrada literal, hasta el máximo de tres pasos',async()=>{
 const result=await useExtension(message('Realiza tres sumas'),[tool],'',choose({steps:[{toolId:'sum',input:[1,2]},{toolId:'sum',input:[3,4]},{toolId:'sum',input:[5,6]}]}));assert.equal(result.used,true);assert.equal(result.result,11);assert.equal(result.steps.length,3);assert.deepEqual(result.steps.map(step=>step.inputSource),['literal','literal','literal']);
});

test('el catálogo canónico de ocho UUID mantiene la petición completa y pasa el validador real del chat de 6000 caracteres',async()=>{
 const ids=['stable-dedupe','numeric-statistics','lor-omega-schema','merge-intervals','dag-dependency-plan','json-pointer-resolve','json-patch-apply','csv-parse'];
 const catalogue=ids.map((id,index)=>{const task=getAutonomousTask(id);assert.ok(task);return {...tool,id:'00000000-0000-4000-8000-00000000000'+index,name:task.name,task:task.task,tests:task.acceptanceTests.slice(0,2)};});
 const marker=' END_REQUEST_MARKER!!',request=('Deduplica los siguientes datos: '+'x'.repeat(3000)).slice(0,3000-marker.length)+marker;assert.equal(request.length,3000);let captured='';
 await useExtension(message(request),catalogue,'',async spec=>{validateMessages(spec.messages);captured=spec.messages[0].content;return {answer:'{"toolId":null}'};});
 assert.ok(captured.endsWith(request));assert.ok(captured.includes('END_REQUEST_MARKER!!'));assert.ok(captured.length<=6000);for(const entry of catalogue)assert.ok(captured.includes('"id":"'+entry.id+'"'));
 const catalogueText=captured.slice(captured.indexOf('\nCatálogo: ')+11,captured.indexOf('\nPetición: '));assert.doesNotThrow(()=>JSON.parse(catalogueText));
 await useExtension(message('Calcula la suma de 1,2,3'),catalogue,'',async spec=>{validateMessages(spec.messages);const prompt=spec.messages[0].content,entries=JSON.parse(prompt.slice(prompt.indexOf('\nCatálogo: ')+11,prompt.indexOf('\nPetición: ')));assert.ok(entries.some(entry=>entry.examples.length>0));return {answer:'{"toolId":null}'};});
});

test('metadatos escapados o ID largos se compactan u omiten sin publicar JSON cortado ni exceder el presupuesto',async()=>{
 const catalogue=Array.from({length:8},(_,i)=>({...tool,id:'id'+i+'\\'.repeat(150),name:'\u0001'.repeat(80),task:'\u0002'.repeat(160)})),request='x'.repeat(2985)+' LAST_REQUEST!!';let captured='',entries=[];
 const result=await useExtension(message(request),catalogue,'',async spec=>{validateMessages(spec.messages);captured=spec.messages[0].content;entries=JSON.parse(captured.slice(captured.indexOf('\nCatálogo: ')+11,captured.indexOf('\nPetición: ')));return {answer:JSON.stringify({toolId:catalogue.find(tool=>!entries.some(entry=>entry.id===tool.id))?.id||'missing',input:[]})};});
 assert.ok(captured.length<=6000);assert.ok(captured.endsWith(request.slice(0,3000)));assert.ok(entries.length>0&&entries.length<8);for(const entry of entries)assert.ok(catalogue.some(tool=>tool.id===entry.id));assert.equal(result.used,false);assert.deepEqual(result.steps,[]);
});

test('la cancelación evita comenzar o continuar con herramientas después de una petición cancelada',async()=>{
 const controller=new AbortController();controller.abort(Error('chat cancelled'));let calls=0;
 await assert.rejects(useExtension(message('Suma'),[tool],'',async()=>{calls++;return {answer:'{"toolId":null}'};},{signal:controller.signal}),/chat cancelled/);assert.equal(calls,0);
 const later=new AbortController();await assert.rejects(useExtension(message('Suma'),[tool],'',async()=>{later.abort(Error('yield before execution'));return {answer:'{"toolId":"sum","input":[1,2]}'};},{signal:later.signal}),/yield before execution/);
});

test('an unambiguous long JSON request preserves its input and executes without a model plan',async()=>{
 const values=Array.from({length:1000},(_,i)=>i),question='Deduplica estos valores: '+JSON.stringify({values}),tool={id:'direct-tool',curriculumTaskId:'stable-dedupe',passed:true,name:'Deduplicar',source:'function transform(input){return {values:[...new Set(input.values)]};}'};
 assert.ok(question.length>3000&&question.length<6000);
 const result=await useExtension([{role:'user',content:question}],[tool],'',async()=>assert.fail('No model required'));
 assert.equal(result.used,true);assert.deepEqual(result.input,{values});assert.deepEqual(result.result,{values});assert.deepEqual(result.planning,{method:'canonical-json',modelCalls:0});
});
