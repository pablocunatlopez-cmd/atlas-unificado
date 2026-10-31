import test from 'node:test';
import assert from 'node:assert/strict';
import {improveExtension} from './extensions.mjs';
const previous={id:'original',passed:true,source:'function transform(x){return x===1?2:0}',tests:[{input:1,expected:2}]};
const generate=source=>async()=>({answer:JSON.stringify({name:'candidate',source,tests:[{input:2,expected:4}]})});
test('Ion rejects a repair which loses a previously working case',async()=>{
 const result=await improveExtension(previous,'Double numbers','',[{input:2,expected:4}],generate('function transform(x){return 4}'));
 assert.equal(result.passed,false);
 assert.equal(result.improvement.regressions[0].passed,false);
 assert.equal(result.parentId,'original');
 assert.equal(previous.passed,true);
});
test('Ion accepts a measured improvement while retaining its baseline',async()=>{
 const result=await improveExtension(previous,'Double numbers','',[{input:2,expected:4}],generate('function transform(x){return x*2}'));
 assert.equal(result.passed,true);
 assert.equal(result.improvement.baseline[0].passed,false);
 assert.equal(result.improvement.regressions[0].passed,true);
});
test('Ion refuses to count an already passing case as improvement',async()=>{
 await assert.rejects(improveExtension(previous,'Double numbers','',[{input:1,expected:2}],()=>{throw Error('should not generate');}),/ya supera/);
});
