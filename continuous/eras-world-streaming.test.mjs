import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planErasVisibleChunks,diffErasChunks} from './eras-world-streaming.mjs';
test('prioritizes player chunk and caps visible chunks',()=>{
 const plan=planErasVisibleChunks({x:12,z:-5,radius:3,maxChunks:9});
 assert.deepEqual(plan.center,[0,-1]);
 assert.equal(plan.visible[0].key,'0:-1');
 assert.equal(plan.visible.length,9);
});
test('computes load and unload when player moves',()=>{
 const a=planErasVisibleChunks({x:1,z:1,radius:1}).visible.map(x=>x.key);
 const b=planErasVisibleChunks({x:70,z:1,radius:1}).visible.map(x=>x.key);
 const changes=diffErasChunks(a,b);
 assert.equal(changes.load.length,3);
 assert.equal(changes.unload.length,3);
});
test('rejects impossible budgets',()=>{
 assert.throws(()=>planErasVisibleChunks({x:NaN,z:0}));
 assert.throws(()=>planErasVisibleChunks({x:0,z:0,radius:99}));
});
