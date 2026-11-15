import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateOllamaCases} from './ollama-benchmark-runner.mjs';

test('compares local output with externally supplied expected answers',async()=>{
 const request=async(url,init)=>{
   const prompt=JSON.parse(init.body).prompt;
   return Response.json({response:prompt==='2+2'?'4':'incorrect',done:true});
 };
 const runs=await evaluateOllamaCases({model:'qwen2.5:7b',request,cases:[
   {id:'math',prompt:'2+2',expected:'4'},
   {id:'other',prompt:'hello',expected:'world'},
 ]});
 assert.equal(runs.length,2);
 assert.equal(runs[0].passed,true);
 assert.equal(runs[1].passed,false);
 assert.ok(runs.every(run=>run.ttftMs===null));
});
test('duplicate IDs fail before any inference',async()=>{
 let calls=0;
 await assert.rejects(evaluateOllamaCases({model:'qwen',request:async()=>{calls++;throw Error('unexpected');},cases:[
   {id:'x',prompt:'a',expected:'b'},{id:'x',prompt:'c',expected:'d'},
 ]}));
 assert.equal(calls,0);
});
