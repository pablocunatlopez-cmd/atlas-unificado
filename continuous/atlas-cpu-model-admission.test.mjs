import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planAtlasCpuModelAdmission} from './atlas-cpu-model-admission.mjs';
const osApi={totalmem:()=>8*1024**3,freemem:()=>2*1024**3,
 cpus:()=>Array.from({length:4},()=>({}))};
test('rejects large models when host RAM is insufficient',()=>{
 const p=planAtlasCpuModelAdmission({modelSizeMb:3000,osApi});
 assert.equal(p.admitted,false);
 assert.equal(p.hardware.freeRamMb,2048);
 assert.equal(p.executed,false);
});
test('admits small models only for subsequent runtime validation',()=>{
 const p=planAtlasCpuModelAdmission({modelSizeMb:300,osApi});
 assert.equal(p.admitted,true);
 assert.equal(p.reason,'requires_runtime_validation');
});
