import test from 'node:test';
import assert from 'node:assert/strict';
import {designWithRepair,validateDesignDraft} from '../lib/creative/design-job.ts';

const plan=(mode:'3d'|'game'='3d')=>({version:2,title:'Pabellón abierto',variant:mode==='game'?'exploration':'architecture',lighting:'day',palette:'Blanco',objects:[{type:'box',position:[5,1,0],size:[1,1,1],material:0}]});
const enclosed=()=>({...plan('game'),objects:[
 {type:'box',position:[-3,1,8],size:[.2,1,3],material:0},
 {type:'box',position:[3,1,8],size:[.2,1,3],material:0},
 {type:'box',position:[0,1,5],size:[3,1,.2],material:0},
 {type:'box',position:[0,1,11],size:[3,1,.2],material:0}
]});
const options={question:'Construye un pabellón con acceso abierto',mode:'3d' as const,prompt:'Encargo original y contrato geométrico.',active:async()=>true};

test('a valid plan completes once and its normalized data survives compilation validation',async()=>{
 let calls=0;const result=await designWithRepair({...options,generate:async()=>{calls++;return plan();}});assert.equal(calls,1);assert.equal(result.repairAttempted,false);assert.deepEqual(result.plan,validateDesignDraft(plan(),options.question,'3d'));
});

test('schema and inaccessible game navigation each get exactly one bounded repair',async()=>{
 for(const mode of ['3d','game'] as const){
  const first=mode==='3d'?{...plan(),palette:['Inexistente']}:enclosed();
  assert.throws(()=>validateDesignDraft(first,options.question,mode),mode==='game'?/bloquea el inicio/:/palette/);
  const calls:Array<{prompt:string;timeout:number}>=[];
  const result=await designWithRepair({...options,mode,prompt:'E'.repeat(13000),generate:async(prompt,timeout)=>{calls.push({prompt,timeout});return calls.length===1?first:plan(mode);}});
  assert.equal(result.repairAttempted,true);assert.equal(calls.length,2);assert.ok(calls[1].prompt.startsWith(calls[0].prompt));assert.match(calls[1].prompt,mode==='game'?/bloquea el inicio/:/palette/);assert.ok(calls.every(c=>c.prompt.length<=14000&&c.timeout<=22000));
 }
});

test('a malformed JSON output can be corrected, but a second invalid design stops',async()=>{
 let calls=0;const result=await designWithRepair({...options,generate:async()=>{calls++;if(calls===1)throw Object.assign(Error('Malformed JSON'),{code:'output'});return plan();}});assert.equal(calls,2);assert.equal(result.repairAttempted,true);
 calls=0;await assert.rejects(designWithRepair({...options,generate:async()=>{calls++;return{};}}),e=>(e as {code:string}).code==='design');assert.equal(calls,2);
});

test('quota, network, provider, credential and configuration errors propagate without retry',async()=>{
 for(const code of ['quota','network','provider','credentials','configuration','model','input']){let calls=0;const failure=Object.assign(Error('Provider unavailable'),{code});await assert.rejects(designWithRepair({...options,generate:async()=>{calls++;throw failure;}}),e=>e===failure);assert.equal(calls,1);}
 for(const code of ['quota','network']){let calls=0;const failure=Object.assign(Error('Repair unavailable'),{code});await assert.rejects(designWithRepair({...options,generate:async()=>{calls++;if(calls===1)return{};throw failure;}}),e=>e===failure);assert.equal(calls,2);}
});

test('cancellation between every asynchronous phase prevents another model call or result',async()=>{
 for(const cancelAfter of [0,1,2]){let calls=0,active=cancelAfter!==0;await assert.rejects(designWithRepair({...options,active:async()=>active,generate:async()=>{calls++;if(calls===cancelAfter)active=false;return calls===1?{}:plan();}}),e=>(e as {code:string}).code==='cancelled');assert.equal(calls,cancelAfter);}
});

test('the absolute 65-second deadline reserves compilation time and blocks late repairs',async()=>{
 let time=0,calls=0;
 await assert.rejects(designWithRepair({...options,now:()=>time,deadline:65000,generate:async(_prompt,timeout)=>{calls++;assert.equal(timeout,22000);time=61000;return{};}}),e=>(e as {code:string}).code==='design');assert.equal(calls,1);
 calls=0;await assert.rejects(designWithRepair({...options,now:()=>62000,deadline:65000,generate:async()=>{calls++;return plan();}}),e=>(e as {code:string}).code==='design');assert.equal(calls,0);
 time=0;calls=0;await assert.rejects(designWithRepair({...options,now:()=>time,deadline:65000,generate:async()=>{calls++;time=65001;return plan();}}),e=>(e as {code:string}).code==='design');assert.equal(calls,1);
});

test('oversized creative requests and contexts fail before spending inference',async()=>{
 for(const overrides of [{question:'x'.repeat(4001)},{prompt:'x'.repeat(13001)}]){let calls=0;await assert.rejects(designWithRepair({...options,...overrides,generate:async()=>{calls++;return plan();}}));assert.equal(calls,0);}
});
