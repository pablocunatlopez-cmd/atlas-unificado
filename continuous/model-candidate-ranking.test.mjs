import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankModelCandidates} from './model-candidate-ranking.mjs';
const runs=(passed,latency=100)=>passed.map((value,i)=>({id:'task-'+i,passed:value,durationMs:latency,ttftMs:latency/2}));

test('ranks passing candidates by verified quality and then latency',()=>{
 const baseline=runs([true,false]);
 const ranking=rankModelCandidates(baseline,[
  {name:'fast',runs:runs([true,true],70)},
  {name:'slow',runs:runs([true,true],90)},
  {name:'regressed',runs:runs([false,true],50)},
 ],{minPassRate:.5});
 assert.equal(ranking.recommended,'fast');
 assert.deepEqual(ranking.results.map(x=>x.name),['fast','slow','regressed']);
 assert.equal(ranking.results[2].accepted,false);
});
test('returns no recommendation when all candidates regress',()=>{
 const result=rankModelCandidates(runs([true,true]),[{name:'bad',runs:runs([false,true])}]);
 assert.equal(result.recommended,null);
});
test('rejects duplicate names and mismatched cases',()=>{
 assert.throws(()=>rankModelCandidates(runs([true]),[{name:'a',runs:runs([true])},{name:'a',runs:runs([true])}]));
 assert.throws(()=>rankModelCandidates(runs([true]),[{name:'a',runs:[{id:'other',passed:true,durationMs:1,ttftMs:1}]}]));
});
