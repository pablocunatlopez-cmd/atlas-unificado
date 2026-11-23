import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {programCatalog,runProgramTool,programRequest,verifyProgramLibrary} from '../lib/cloud/program-tools.mjs';
test('the library executes five algorithms and preserves original input',()=>{
 const input=[[5,7],[1,4],[3,6]],snapshot=structuredClone(input);
 assert.deepEqual(runProgramTool('intervals',input).result,[[1,7]]);assert.deepEqual(input,snapshot);
 assert.deepEqual(runProgramTool('dedupe',[null,1,'1',false,1,null]).result,[null,1,'1',false]);
 assert.deepEqual(runProgramTool('sort',[9,2,-1,2]).result,[-1,2,2,9]);
 assert.deepEqual(runProgramTool('counts',['a','b','a']).result,[{value:'a',count:2},{value:'b',count:1}]);
 assert.equal(runProgramTool('stats',[9,1,4]).result.median,4);assert.equal(runProgramTool('stats',[]).result.mean,null);
 assert.equal(verifyProgramLibrary().passed,15);assert.equal(programCatalog().length,5);
});
test('invalid inputs, coercions, unknown operations and oversized results are rejected',()=>{
 for(const [op,input] of [['sort',[1,'2']],['sort',[Infinity]],['intervals',[[5,2]]],['intervals',[[1]]],['dedupe',[{x:1}]],['counts',[NaN]],['stats',[1e308,1e308]],['sort',Array(129).fill(1)],['__proto__',[]],['constructor',[]],['dedupe',['x'.repeat(8100)]]])assert.throws(()=>runProgramTool(op,input));
});
test('the exported trusted source runs the same algorithm outside the application',()=>{
 for(const [op,input] of [['sort',[4,1]],['dedupe',[2,2,'2']],['counts',[false,false,null]],['stats',[1,2,3]],['intervals',[[1,2],[2,4]]]]){
  const result=runProgramTool(op,input),script=result.source.replace('export const ','const ')+`;JSON.stringify(${op}(${JSON.stringify(input)}))`;
  assert.equal(runInNewContext(script,{}, {timeout:1000}),JSON.stringify(result.result));
 }
});
test('chat commands execute only explicit JSON data operations and do not claim arbitrary code execution',()=>{
 assert.deepEqual(programRequest('Deduplica [1,1,2]').result,[1,2]);
 assert.equal(programRequest('Estadísticas de [2,4,6]').result.mean,4);
 assert.match(programRequest('Ordena [1,"x"]').error,/números/);
 assert.equal(programRequest('Explícame cómo funciona un algoritmo de ordenación'),null);
 assert.equal(programRequest('Ejecuta fetch("https://other.invalid")'),null);
});
