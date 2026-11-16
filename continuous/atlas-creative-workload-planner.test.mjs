import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planAtlasCreativeWorkload} from './atlas-creative-workload-planner.mjs';
test('12GB GPU planner leaves headroom and never claims execution',()=>{
 const p=planAtlasCreativeWorkload({type:'video',estimatedVramGb:9,availableVramGb:12});
 assert.equal(p.mode,'gpu');
 assert.equal(p.executionStarted,false);
 assert.equal(p.hardwareMeasured,false);
 assert.equal(p.performanceVerified,false);
});
test('overbudget jobs degrade or block rather than oversubscribe',()=>{
 assert.equal(planAtlasCreativeWorkload({type:'video',estimatedVramGb:11,availableVramGb:12}).mode,'cpu-review');
 assert.equal(planAtlasCreativeWorkload({type:'video',estimatedVramGb:11,availableVramGb:12,cpuFallback:false}).mode,'blocked');
 assert.equal(planAtlasCreativeWorkload({type:'music',estimatedVramGb:3,availableVramGb:12,concurrentGpuJobs:1}).mode,'cpu-review');
});
test('invalid budgets and types are rejected',()=>{
 assert.throws(()=>planAtlasCreativeWorkload({type:'other'}));
 assert.throws(()=>planAtlasCreativeWorkload({type:'video',availableVramGb:-1}));
 assert.throws(()=>planAtlasCreativeWorkload({type:'video',estimatedVramGb:NaN}));
});
