import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decideAtlasCpuMemoryPressure} from './atlas-cpu-memory-pressure.mjs';
test('recommends downgrade without automatically changing models',()=>{
 const r=decideAtlasCpuMemoryPressure({freeRamMb:700,currentTier:'medium'});
 assert.equal(r.action,'recommend_downgrade');
 assert.equal(r.automaticSwitch,false);
 assert.equal(r.requiresHostApproval,true);
});
test('keeps appropriately sized CPU model',()=>{
 const r=decideAtlasCpuMemoryPressure({freeRamMb:8000,currentTier:'small'});
 assert.equal(r.action,'keep');
 assert.equal(r.suggestedTier,'small');
});
