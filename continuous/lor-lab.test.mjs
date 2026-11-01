import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createLorLab} from './lor-lab.mjs';

const measured={verdict:'REFUTED',baseline_score:2/3,lor_score:.6,delta:.6-2/3,negative_control_delta:0,reparam_delta:.6-2/3};
async function fixture(t,run){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-lor-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const source=path.join(root,'components','atlas597','lor','discrete_holonomy.py');
 await fs.mkdir(path.dirname(source),{recursive:true});await fs.writeFile(source,'# immutable inherited geometry source\n');
 return {root,lab:createLorLab({root,python:'fixed-lab-python',run})};
}

test('LOR execution uses a fixed CPU-only program and preserves a negative measured result with provenance',async t=>{
 const calls=[];const {root,lab}=await fixture(t,async(...args)=>{calls.push(args);return {ok:true,result:{...measured,private:'not-exported'},elapsedMs:123,scope:'Synthetic geometry only.'};});
 assert.deepEqual(await lab.status(),{busy:false,last:null});
 const result=await lab.experiment({prompt:'import os; erase_files()',script:'untrusted.py',seed:999});
 assert.equal(calls.length,1);const [python,args,options]=calls[0];
 assert.equal(python,'fixed-lab-python');assert.deepEqual(args,['-B',path.join(root,'lor-lab.py')]);assert.equal(options.cwd,root);
 assert.equal(options.timeoutMs,90000);assert.equal(options.maxOutputBytes,40000);assert.equal(options.input,undefined);
 assert.equal(options.env.CUDA_VISIBLE_DEVICES,'');assert.equal(options.env.OMP_NUM_THREADS,'2');assert.equal(options.env.MKL_NUM_THREADS,'2');assert.equal(options.env.PYTHONDONTWRITEBYTECODE,'1');
 assert.equal(result.verdict,'REFUTED');assert.ok(result.delta<0);assert.equal(result.seed,124);assert.equal(result.samples,72);assert.equal(result.length,128);assert.equal(result.synthetic,true);
 assert.equal(result.sourceSha256,createHash('sha256').update('# immutable inherited geometry source\n').digest('hex'));
 assert.equal(result.private,undefined);assert.doesNotMatch(JSON.stringify(result),/erase_files|untrusted\.py/);
 assert.deepEqual((await lab.status()).last,result);assert.equal((await lab.status()).busy,false);
});

test('invalid metrics never become persisted evidence and the lab becomes available after failure',async t=>{
 let result={...measured,lor_score:NaN};const {lab}=await fixture(t,async()=>({ok:true,result,elapsedMs:1}));
 await assert.rejects(lab.experiment(),/métricas válidas/);assert.deepEqual(await lab.status(),{busy:false,last:null});
 result={...measured,verdict:'GUARANTEED_NEW_PHYSICS'};await assert.rejects(lab.experiment(),/métricas válidas/);
 result=measured;assert.equal((await lab.experiment()).verdict,'REFUTED');
});

test('a concurrent experiment cannot overwrite an active run and cancellation propagates to the bounded process',async t=>{
 const controller=new AbortController();let started;
 const ready=new Promise(resolve=>started=resolve);
 const {lab}=await fixture(t,async(_python,_args,{signal})=>{assert.equal(signal,controller.signal);started();return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});
 const running=lab.experiment({signal:controller.signal});await ready;
 assert.equal((await lab.status()).busy,true);await assert.rejects(lab.experiment(),/ya está en ejecución/);
 const reason=Error('User cancelled CPU trial');controller.abort(reason);await assert.rejects(running,error=>error===reason);
 assert.deepEqual(await lab.status(),{busy:false,last:null});
});

test('a bounded process timeout is not converted into success or stored as a trial result',async t=>{
 const timeout=Error('Tiempo máximo del laboratorio agotado');const {lab}=await fixture(t,async()=>{throw timeout;});
 await assert.rejects(lab.experiment(),error=>error===timeout);assert.deepEqual(await lab.status(),{busy:false,last:null});
});
