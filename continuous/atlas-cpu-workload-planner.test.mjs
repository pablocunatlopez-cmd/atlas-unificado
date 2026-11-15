import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planAtlasCpuWorkload} from './atlas-cpu-workload-planner.mjs';
import {planAtlasNeuralTask} from './atlas-neural-backend-router.mjs';
test('CPU is default and CUDA-only models are excluded',()=>{
 const gsplat=planAtlasNeuralTask({task:'scene_reconstruction',availableBackends:['gsplat']});
 assert.equal(gsplat.selected,null);
 assert.ok(gsplat.candidates[0].blockedReasons.includes('requires_cuda'));
 const llama=planAtlasNeuralTask({task:'code',availableBackends:['llama-cpp']});
 assert.equal(llama.selected,'llama-cpp');
 assert.throws(()=>planAtlasNeuralTask({task:'code',preferredGpu:'imaginary'}));
});
test('rejects CPU model when free RAM is insufficient',()=>{
 const plan=planAtlasCpuWorkload({task:'chat',modelSizeMb:3500,freeRamMb:4000});
 assert.equal(plan.accepted,false);
 assert.equal(plan.status,'insufficient_free_ram');
});
test('admits a small CPU model as planning only',()=>{
 const plan=planAtlasCpuWorkload({task:'speech_to_text',modelSizeMb:150,freeRamMb:3000});
 assert.equal(plan.accepted,true);
 assert.equal(plan.executed,false);
 assert.equal(plan.measured,false);
 assert.equal(plan.device,'cpu');
});
