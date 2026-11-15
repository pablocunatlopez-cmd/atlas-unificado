import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recommendAtlasCpuModelTier} from './atlas-cpu-model-tiers.mjs';
test('does not recommend models without RAM headroom',()=>{
 assert.equal(recommendAtlasCpuModelTier({freeRamMb:700}).tier,null);
});
test('selects small or medium CPU tier when enough RAM is free',()=>{
 assert.equal(recommendAtlasCpuModelTier({freeRamMb:4000}).tier,'small');
 assert.equal(recommendAtlasCpuModelTier({freeRamMb:8000}).tier,'medium');
 assert.equal(recommendAtlasCpuModelTier({freeRamMb:8000}).modelInstalled,false);
});
