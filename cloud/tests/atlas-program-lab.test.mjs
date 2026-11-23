import {test} from 'node:test';
import assert from 'node:assert/strict';
import {executeProgram,validateProgram,gradeProgram,programCases,programDecision} from '../lib/evolution/program-runtime.mjs';
const input={op:'input'},item={op:'item'},number=value=>({op:'number',value});
const positive={op:'sum',args:[{op:'filter',args:[input,{op:'gt',args:[item,number(0)]}]}]};
const energy={op:'sum',args:[{op:'map',args:[input,{op:'mul',args:[item,item]}]}]};
const clipped={op:'map',args:[input,{op:'if',args:[{op:'gt',args:[item,number(1)]},number(1),{op:'if',args:[{op:'lt',args:[item,number(-1)]},number(-1),item]}]}]};
test('executes authored programs against varied development and reserved inputs',()=>{
 for(const [task,program] of [['positive-total',positive],['signal-energy',energy],['clip-unit',clipped]]){
  for(const seed of [1,7,18,312]){const cases=programCases(task,seed),score=gradeProgram(program,cases);assert.equal(score.total,12);assert.equal(score.passed,12);assert.equal(cases.filter(c=>c.split==='heldout').length,6);}
 }
 assert.equal(executeProgram(positive,[3,-9,4]).result,7);
 assert.deepEqual(executeProgram(clipped,[-2,-.5,4]),{result:[-1,-.5,1],steps:executeProgram(clipped,[-2,-.5,4]).steps,version:'atlas-program-lab-1'});
});
test('missing implementation is installation, never an invented zero baseline',()=>{
 const cases=programCases('positive-total'),after=gradeProgram(positive,cases),before=gradeProgram(number(0),cases);
 assert.equal(programDecision(null,after),'installed');
 assert.equal(programDecision(after,after),'retained');
 assert.equal(programDecision(before,after),'promoted');
 assert.equal(programDecision(after,before),'rejected');
});
test('rejects ambient access, invalid types, arithmetic errors and oversized data',()=>{
 for(const op of ['eval','fetch','constructor','__proto__','process','while'])assert.throws(()=>validateProgram({op}));
 assert.throws(()=>validateProgram({op:'input',url:'https://example.org'}));
 assert.throws(()=>validateProgram(item));
 assert.throws(()=>executeProgram(input,Array(129).fill(0)));
 assert.throws(()=>executeProgram(input,[Infinity]));
 assert.throws(()=>executeProgram(input,['1']));
 assert.throws(()=>executeProgram({op:'div',args:[number(1),number(0)]},[]));
 assert.throws(()=>executeProgram({op:'filter',args:[input,item]},[1]));
});
test('lazy branches work and nested maps cannot exhaust worker CPU',()=>{
 const lazy={op:'if',args:[{op:'eq',args:[number(0),number(0)]},number(4),{op:'div',args:[number(1),number(0)]}]};
 assert.equal(executeProgram(lazy,[]).result,4);
 const explosive={op:'map',args:[input,{op:'map',args:[input,item]}]};
 assert.throws(()=>executeProgram(explosive,Array(128).fill(1)),/Presupuesto/);
 let deep=number(0);for(let i=0;i<15;i++)deep={op:'sum',args:[deep]};assert.throws(()=>validateProgram(deep));
});
