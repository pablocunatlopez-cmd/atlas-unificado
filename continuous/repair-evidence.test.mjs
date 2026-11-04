import test from 'node:test';
import assert from 'node:assert/strict';
import {selectRepairEvidence} from './repair-evidence.mjs';

test('many renamed refutations keep space for distinct error and boundary classes',()=>{
 const repeated=Array.from({length:200},(_,i)=>({input:{text:'name-'+i},expected:{ok:false,error:'invalid_csv'},actual:{ok:true,rows:[['name-'+i]]}}));
 const limits={input:{text:'x\n'.repeat(257)},expected:{ok:false,error:'limit_exceeded'},actual:{ok:true,rows:[['x']]}};
 const trailingField={input:{text:'a,'},expected:{ok:true,rows:[['a','']]},actual:{ok:true,rows:[['a']]}};
 const endingRow={input:{text:'a\n'},expected:{ok:true,rows:[['a']]},actual:{ok:true,rows:[['a'],['']]}};
 const input=[...repeated,limits,trailingField,endingRow],before=structuredClone(input),out=selectRepairEvidence(input);
 assert.equal(out.length,4);assert.ok(out.some(x=>x.expected.error==='limit_exceeded'));assert.ok(out.some(x=>x.input.text==='a,'));assert.ok(out.some(x=>x.input.text==='a\n'));assert.ok(JSON.stringify(out).length<=2800);assert.deepEqual(input,before);
});

test('smallest exact witness represents a shape without rewriting the observed data',()=>{
 const one={input:{value:'long'.repeat(40)},expected:{values:[1]},actual:{values:[]}},two={input:{value:'x'},expected:{values:[1]},actual:{values:[]}};
 const out=selectRepairEvidence([one,two]);assert.deepEqual(out,[two]);out[0].input.value='modified';assert.equal(two.input.value,'x');
});

test('budgets retain whole JSON and never replace an oversized case with fabricated data',()=>{
 const huge={input:{value:'x'.repeat(9000)},expected:{ok:false},actual:{ok:true}},small={input:1,expected:2,actual:3};const out=selectRepairEvidence([huge,small],{maxChars:100,maxExamples:2});assert.deepEqual(out,[small]);assert.ok(JSON.stringify(out).length<=100);assert.deepEqual(selectRepairEvidence([small],{maxChars:2}),[]);
});

test('error classes and nested paths stay distinct while literal UUIDs are not treated as new mismatch shapes',()=>{
 const input=[{input:1,expected:{x:{y:2}},actual:{x:{y:3}}},{input:2,expected:{x:{z:2}},actual:{x:{z:3}}},{input:3,expected:null,error:'timeout 1234'},{input:4,expected:null,error:'timeout 5678'}];const out=selectRepairEvidence(input);assert.equal(out.length,3);assert.ok(out.some(x=>x.input===1));assert.ok(out.some(x=>x.input===2));
});

test('malformed observations do not poison a repair packet and configuration is bounded',()=>{
 const cycle={};cycle.self=cycle;assert.deepEqual(selectRepairEvidence([null,{},[],{input:cycle,expected:0}]),[]);assert.throws(()=>selectRepairEvidence(null),/Presupuesto/);assert.throws(()=>selectRepairEvidence([],{maxExamples:9}),/Presupuesto/);assert.throws(()=>selectRepairEvidence([],{maxChars:10000}),/Presupuesto/);
});
