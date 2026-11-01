import test from 'node:test';import assert from 'node:assert/strict';import {executePure,evaluateExtension} from './extensions.mjs';
test('código aislado calcula y no recibe capacidades de archivos/red',async()=>{assert.equal(await executePure('function transform(x){return x*2}',4),8);assert.deepEqual(await executePure('function transform(){return [typeof process,typeof require,typeof fetch]}',null),['undefined','undefined','undefined']);});
test('bucle infinito es interrumpido',async()=>{await assert.rejects(executePure('function transform(){while(true){}}',null),/interrupted/);});
test('una prueba fallida impide habilitar la extensión',async()=>{const r=await evaluateExtension({name:'doble',source:'function transform(x){return x*2}',tests:[{input:3,expected:7}]});assert.equal(r.passed,false);});
test('JSON transport preserves own __proto__ keys and data without changing object prototypes',async()=>{
 const input=JSON.parse('{"__proto__":{"flag":"payload"},"nested":{"__proto__":23}}');
 const result=await executePure('function transform(input){return {rootOwn:Object.hasOwn(input,"__proto__"),nestedOwn:Object.hasOwn(input.nested,"__proto__"),inherited:input.flag===undefined,copy:input};}',input);
 assert.equal(result.rootOwn,true);assert.equal(result.nestedOwn,true);assert.equal(result.inherited,true);assert.deepEqual(result.copy,input);
});
