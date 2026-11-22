import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ATLAS_NEURAL_BACKENDS,planAtlasNeuralTask} from './atlas-neural-backend-router.mjs';
test('routes local reasoning only when runtime is declared available',()=>{
 const missing=planAtlasNeuralTask({task:'code'});
 assert.equal(missing.selected,null);
 const planned=planAtlasNeuralTask({task:'code',availableBackends:['llama-cpp']});
 assert.equal(planned.selected,'llama-cpp');
 assert.equal(planned.executed,false);
 assert.equal(planned.promotionAuthorized,false);
});
test('blocks noncommercial audio weights for commercial use',()=>{
 const plan=planAtlasNeuralTask({task:'music_generation',availableBackends:['audiocraft'],commercial:true,allowResearch:true});
 assert.equal(plan.selected,null);
 assert.ok(plan.candidates[0].blockedReasons.includes('noncommercial_weights'));
});
test('requires CUDA for gsplat and rejects unknown tasks',()=>{
 const cpu=planAtlasNeuralTask({task:'scene_reconstruction',availableBackends:['gsplat'],preferredGpu:'cpu'});
 assert.equal(cpu.selected,null);
 const gpu=planAtlasNeuralTask({task:'scene_reconstruction',availableBackends:['gsplat'],preferredGpu:'cuda'});
 assert.equal(gpu.selected,'gsplat');
 assert.throws(()=>planAtlasNeuralTask({task:'arbitrary_shell',availableBackends:['llama-cpp']}));
 assert.ok(ATLAS_NEURAL_BACKENDS.every(x=>x.source.startsWith('https://github.com/')));
});
