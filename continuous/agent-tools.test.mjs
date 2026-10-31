import test from 'node:test';import assert from 'node:assert/strict';
import {useExtension} from './agent-tools.mjs';import {buildExtension} from './extensions.mjs';
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
