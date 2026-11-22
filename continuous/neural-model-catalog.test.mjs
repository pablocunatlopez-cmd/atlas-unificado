import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MODEL_CANDIDATES,selectModelCandidates} from './neural-model-catalog.mjs';
test('model catalog never treats candidates as installed',()=>{
 assert.ok(MODEL_CANDIDATES.every(model=>model.status==='candidate'));
 const options=selectModelCandidates({task:'conversation',ramGb:16});
 assert.ok(options.length>0);
 assert.ok(options.every(model=>model.available===false&&model.needsDownload));
});
test('only verified installed ids are marked available',()=>{
 const options=selectModelCandidates({task:'conversation',ramGb:16,installed:['qwen3.5:4b','fake-model']});
 assert.equal(options.filter(model=>model.available).length,1);
 assert.equal(options[0].id,'qwen3.5:4b');
 assert.throws(()=>selectModelCandidates({ramGb:-1}));
});
test('embedding candidates are distinct from generative conversation models',()=>{
 const options=selectModelCandidates({task:'embedding',ramGb:4});
 assert.ok(options.every(model=>model.task==='embedding'));
 assert.ok(options.some(model=>model.role==='memory'));
});
