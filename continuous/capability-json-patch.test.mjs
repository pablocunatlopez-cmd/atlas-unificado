import test from 'node:test';
import assert from 'node:assert/strict';
import {jsonPatchTask,jsonPatchOracle,generateJsonPatchInputs,jsonPatchCoverage} from './capability-json-patch.mjs';

const run=(document,patch)=>jsonPatchOracle({document,patch});
const error=(code,index=0)=>({ok:false,error:code,index});

// Expected results here are independently written JSON examples, not produced
// from the reference oracle. A generated implementation never receives it.
test('the bounded patch task has eight independent contracts and a fitting code-generation prompt',()=>{
 assert.equal(jsonPatchTask.id,'json-patch-apply');assert.equal(jsonPatchTask.acceptanceTests.length,8);assert.ok(jsonPatchTask.task.length<=4000);assert.ok(JSON.stringify(jsonPatchTask.acceptanceTests).length<=12000);
 assert.match(jsonPatchTask.task,/root_remove_unsupported/);assert.match(jsonPatchTask.learningPlan.scope,/no escribe archivos/);
 for(const fixture of jsonPatchTask.acceptanceTests){const before=structuredClone(fixture.input);assert.deepEqual(jsonPatchOracle(fixture.input),fixture.expected);assert.deepEqual(fixture.input,before);}
});

test('RFC-style object edits ignore extra operation fields while requiring own exact destinations',()=>{
 assert.deepEqual(run({foo:'bar'},[{op:'add',path:'/baz',value:'qux',extra:'ignored'},{op:'remove',path:'/foo'}]),{ok:true,document:{baz:'qux'}});
 assert.deepEqual(run({foo:'bar'},[{op:'replace',path:'/foo',value:'baz'}]),{ok:true,document:{foo:'baz'}});
 assert.deepEqual(run({},[{op:'add',path:'/nested/child',value:1}]),error('path_not_found'));
 assert.deepEqual(run({},[{op:'replace',path:'/missing',value:1}]),error('path_not_found'));
 assert.deepEqual(run({},[{op:'remove',path:'/toString'}]),error('path_not_found'));
});

test('array insertions use the current document, append only for add, and never create holes',()=>{
 assert.deepEqual(run(['foo','bar'],[{op:'add',path:'/1',value:'qux'},{op:'add',path:'/-',value:'tail'}]),{ok:true,document:['foo','qux','bar','tail']});
 assert.deepEqual(run([], [{op:'add',path:'/0',value:5}]),{ok:true,document:[5]});
 for(const path of ['/01','/-1','/+0','/1.0','/2','/9007199254740993'])assert.deepEqual(run([0],[{op:'add',path,value:1}]),error('path_not_found'));
 for(const op of ['remove','replace','test'])assert.deepEqual(run([0],[{op,path:'/-',value:0}]),error('path_not_found'));
 assert.deepEqual(run({'-':2},[{op:'replace',path:'/-',value:3}]),{ok:true,document:{'-':3}});
});

test('JSON Pointer validates all escapes without double decoding, URI decoding or inherited traversal',()=>{
 const document={'~1':7,'/':8,'%2F':9,'':{value:null}};
 assert.deepEqual(run(document,[{op:'test',path:'/~01',value:7},{op:'test',path:'/~1',value:8},{op:'test',path:'/%2F',value:9},{op:'test',path:'//value',value:null}]),{ok:true,document});
 for(const path of ['a','/a~','/a~2','/~~0','#/a'])assert.deepEqual(run({},[{op:'add',path,value:1}]),error('invalid_pointer'));
 assert.deepEqual(run({},[{op:'test',path:'/constructor/prototype',value:{}}]),error('path_not_found'));
});

test('all operation shapes and pointer syntax are prevalidated before any path evaluation',()=>{
 assert.deepEqual(run({},[{op:'remove',path:'/missing'},{op:'test',path:'/bad~2',value:0}]),error('invalid_pointer',1));
 assert.deepEqual(run({},[{op:'remove',path:'/missing'},{op:'unknown',path:''}]),error('invalid_patch',1));
 for(const operation of [null,[],{}, {op:'add',path:'/x'},{op:'replace',path:'/x'},{op:'test',path:'/x'},{op:'copy',path:'/x'},{op:'move',path:'/x'},{op:'add',path:4,value:1},{op:'copy',path:'',from:4}])assert.deepEqual(run({},[operation]),error('invalid_patch'));
 assert.deepEqual(run({},[{op:'copy',path:'',from:'/invalid~'}]),error('invalid_pointer'));
 const inherited=Object.create({op:'add',path:'/x',value:1});assert.deepEqual(run({},[inherited]),error('invalid_patch'));
});

test('JSON equality ignores object member order and preserves array order, exact types and null',()=>{
 const document={obj:{a:1,b:[true,null]},array:[1,2]};
 assert.deepEqual(run(document,[{op:'test',path:'/obj',value:{b:[true,null],a:1}}]),{ok:true,document});
 for(const value of [{a:'1',b:[true,null]},{a:1,b:[null,true]},{a:1},{a:1,b:[true,null],c:0}])assert.deepEqual(run(document,[{op:'test',path:'/obj',value}]),error('test_failed'));
 assert.deepEqual(run(document,[{op:'test',path:'/array',value:[2,1]}]),error('test_failed'));
 assert.deepEqual(run(null,[{op:'test',path:'',value:null}]),{ok:true,document:null});
 assert.deepEqual(run([], [{op:'test',path:'',value:{}}]),error('test_failed'));
 assert.deepEqual(run(0,[{op:'test',path:'',value:-0}]),{ok:true,document:0});
});

test('deep copy is independent and copying root into its child never creates a cycle',()=>{
 assert.deepEqual(run({a:{n:1}},[{op:'copy',from:'/a',path:'/b'},{op:'replace',path:'/a/n',value:2}]),{ok:true,document:{a:{n:2},b:{n:1}}});
 assert.deepEqual(run({n:1},[{op:'copy',from:'',path:'/copy'}]),{ok:true,document:{n:1,copy:{n:1}}});
 assert.deepEqual(run({a:null},[{op:'copy',from:'/a',path:''}]),{ok:true,document:null});
 assert.deepEqual(run({},[{op:'copy',from:'/missing',path:'/a'}]),error('path_not_found'));
});

test('move evaluates the destination after removal and handles root and same-path operations precisely',()=>{
 assert.deepEqual(run(['a','b','c','d'],[{op:'move',from:'/1',path:'/3'}]),{ok:true,document:['a','c','d','b']});
 assert.deepEqual(run(['a','b','c'],[{op:'move',from:'/0',path:'/-'}]),{ok:true,document:['b','c','a']});
 assert.deepEqual(run({a:{n:1},ab:0},[{op:'move',from:'/a',path:'/ab'}]),{ok:true,document:{ab:{n:1}}});
 assert.deepEqual(run({a:{n:1}},[{op:'move',from:'/a',path:''}]),{ok:true,document:{n:1}});
 assert.deepEqual(run({a:1},[{op:'move',from:'',path:''}]),{ok:true,document:{a:1}});
 assert.deepEqual(run({a:1},[{op:'move',from:'/a',path:'/a'}]),{ok:true,document:{a:1}});
 assert.deepEqual(run({},[{op:'move',from:'/missing',path:'/missing'}]),error('path_not_found'));
 assert.deepEqual(run({a:{}},[{op:'move',from:'/a',path:'/a/child'}]),error('invalid_move'));
 assert.deepEqual(run({a:1},[{op:'move',from:'',path:'/a'}]),error('invalid_move'));
});

test('root replacement is explicit and root removal is rejected rather than conflated with JSON null',()=>{
 assert.deepEqual(run(5,[{op:'add',path:'',value:[true,null]}]),{ok:true,document:[true,null]});
 assert.deepEqual(run({x:1},[{op:'replace',path:'',value:'new'}]),{ok:true,document:'new'});
 assert.deepEqual(run(null,[{op:'remove',path:''}]),error('root_remove_unsupported'));
});

test('every operational failure discards prior edits and never exposes a partially modified document',()=>{
 const input={document:{a:1,items:['x','y']},patch:[{op:'add',path:'/new',value:{x:1}},{op:'move',from:'/items/0',path:'/items/5'}]},before=structuredClone(input);
 assert.deepEqual(jsonPatchOracle(input),error('path_not_found',1));assert.deepEqual(input,before);
 for(const operation of [{op:'test',path:'/a',value:'1'},{op:'remove',path:'/missing'},{op:'replace',path:'/missing',value:0}]){
  const fixture={document:{a:1},patch:[{op:'replace',path:'/a',value:2},operation]},original=structuredClone(fixture);
  assert.equal(jsonPatchOracle(fixture).ok,false);assert.equal(Object.hasOwn(jsonPatchOracle(fixture),'document'),false);assert.deepEqual(fixture,original);
 }
});

test('special names are own JSON data and never modify ambient prototypes',()=>{
 const before=Object.getOwnPropertyDescriptors(Object.prototype);
 const result=run({},[{op:'add',path:'/__proto__',value:{atlasPatchPolluted:true}},{op:'add',path:'/constructor',value:{prototype:{atlasPatchPolluted:true}}},{op:'copy',from:'/__proto__',path:'/toString'}]);
 assert.deepEqual(result,{ok:true,document:JSON.parse('{"__proto__":{"atlasPatchPolluted":true},"constructor":{"prototype":{"atlasPatchPolluted":true}},"toString":{"atlasPatchPolluted":true}}')});
 assert.equal(Object.hasOwn(result.document,'__proto__'),true);assert.equal(Object.getPrototypeOf(result.document),Object.prototype);assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype),before);assert.equal(({}).atlasPatchPolluted,undefined);
 assert.deepEqual(run({},[{op:'add',path:'/__proto__/atlasPatchPolluted',value:true}]),error('path_not_found'));
});

test('input validation and the operation budget are bounded without coercing JSON values',()=>{
 for(const input of [null,[],{}, {document:null},{patch:[]},{document:undefined,patch:[]},{document:NaN,patch:[]},{document:Infinity,patch:[]},{document:0,patch:null},{document:0,patch:Array.from({length:65},()=>({op:'test',path:'',value:0}))}])assert.deepEqual(jsonPatchOracle(input),{ok:false,error:'invalid_input'});
 const inherited=Object.create({document:0,patch:[]});assert.deepEqual(jsonPatchOracle(inherited),{ok:false,error:'invalid_input'});
 const cycle={};cycle.self=cycle;assert.deepEqual(jsonPatchOracle({document:cycle,patch:[]}),{ok:false,error:'invalid_input'});
 const source={x:[1,2]},result=run(source,[]);assert.deepEqual(result,{ok:true,document:source});assert.notEqual(result.document,source);assert.notEqual(result.document.x,source.x);
 assert.deepEqual(run(0,Array.from({length:64},()=>({op:'test',path:'',value:0}))),{ok:true,document:0});
});

test('copy expansion is stopped before it can consume unbounded host resources',()=>{
 assert.deepEqual(run('x'.repeat(30000),[]),{ok:false,error:'invalid_input'});
 const input={document:{value:'x'},patch:Array.from({length:64},(_,index)=>({op:'copy',from:'',path:'/copy'+index}))},before=structuredClone(input);
 const result=jsonPatchOracle(input);
 assert.equal(result.ok,false);assert.equal(result.error,'result_too_large');assert.ok(result.index>0&&result.index<20);assert.equal(Object.hasOwn(result,'document'),false);assert.deepEqual(input,before);
});

test('generated cases are deterministic, distinct from fixed contracts and preserve the declared eight patterns',()=>{
 assert.equal(jsonPatchCoverage.length,8);const known=new Set(jsonPatchTask.acceptanceTests.map(t=>JSON.stringify(t.input)));
 for(const seed of [0,1,2,7,65536,4294967295]){
  const inputs=generateJsonPatchInputs(seed);assert.equal(inputs.length,8);assert.deepEqual(inputs,generateJsonPatchInputs(seed));assert.equal(new Set(inputs.map(JSON.stringify)).size,8);
  for(const input of inputs){assert.equal(known.has(JSON.stringify(input)),false);const before=structuredClone(input);const result=jsonPatchOracle(input);assert.equal(typeof result.ok,'boolean');assert.deepEqual(input,before);}
  assert.equal(jsonPatchOracle(inputs[0]).ok,true);assert.deepEqual(jsonPatchOracle(inputs[5]),error('test_failed',1));assert.deepEqual(jsonPatchOracle(inputs[6]),error('invalid_move'));
 }
 for(const seed of [-1,1.5,4294967296,NaN,'1'])assert.throws(()=>generateJsonPatchInputs(seed),/uint32/);
});
