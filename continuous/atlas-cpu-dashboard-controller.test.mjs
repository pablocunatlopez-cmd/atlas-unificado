import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasCpuDashboardController} from './atlas-cpu-dashboard-controller.mjs';
test('runs local diagnostics only when explicitly requested',async()=>{
 let reads=0,requests=0;
 const controller=createAtlasCpuDashboardController({
  readFreeRamMb:async()=>{reads++;return 8000;},
  fetchImpl:async()=>{requests++;return {ok:true,
   text:async()=>JSON.stringify({status:'ok'})};}
 });
 assert.equal(reads,0);
 assert.equal(requests,0);
 assert.equal(controller.state.phase,'idle');
 const state=await controller.runDiagnostics();
 assert.equal(state.phase,'completed');
 assert.equal(reads,1);
 assert.equal(requests,1);
 assert.match(controller.render(),/Diagnóstico local/);
});
test('reports invalid RAM readings without requesting health',async()=>{
 let requested=false;
 const controller=createAtlasCpuDashboardController({
  readFreeRamMb:async()=>NaN,
  fetchImpl:async()=>{requested=true;}
 });
 const state=await controller.runDiagnostics();
 assert.equal(state.phase,'error');
 assert.equal(requested,false);
});
test('rejects concurrent diagnostic runs',async()=>{
 let release;
 const pending=new Promise(resolve=>{release=resolve;});
 const controller=createAtlasCpuDashboardController({
  readFreeRamMb:()=>pending,
  fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify({status:'ok'})})
 });
 const first=controller.runDiagnostics();
 await assert.rejects(controller.runDiagnostics(),/already running/);
 release(8000);
 await first;
});
