import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectErasProfile,adaptErasQuality} from './eras-graphics-quality.mjs';
test('mobile never selects a desktop profile',()=>{
 assert.equal(selectErasProfile({mobile:true,webgpu:true,deviceMemoryGB:2}).name,'mobile_low');
 assert.equal(adaptErasQuality('mobile_high',100).name,'mobile_low');
 assert.equal(adaptErasQuality('mobile_high',5).name,'mobile_high');
});
test('desktop quality reacts to measured frame time',()=>{
 assert.equal(selectErasProfile({webgpu:true,deviceMemoryGB:16}).name,'desktop_ultra');
 assert.equal(adaptErasQuality('desktop_ultra',50).name,'desktop_high');
 assert.equal(adaptErasQuality('desktop_high',5).name,'desktop_ultra');
});
test('rejects invalid measurements',()=>{
 assert.throws(()=>adaptErasQuality('unknown',16));
 assert.throws(()=>selectErasProfile({averageFrameMs:-1}));
});
