import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateErasWorldChunk} from './eras-procedural-world.mjs';
test('same seed and coordinates produce identical world chunks',()=>{
 const a=generateErasWorldChunk({seed:42,chunkX:2,chunkZ:-1,vegetation:50});
 assert.deepEqual(a,generateErasWorldChunk({seed:42,chunkX:2,chunkZ:-1,vegetation:50}));
 assert.equal(a.objects.length,50);
});
test('different chunks produce different objects',()=>{
 const a=generateErasWorldChunk({seed:42,chunkX:0});
 const b=generateErasWorldChunk({seed:42,chunkX:1});
 assert.notDeepEqual(a.objects,b.objects);
});
test('objects stay inside chunk bounds',()=>{
 const c=generateErasWorldChunk({chunkX:-2,chunkZ:3,size:32,vegetation:100});
 for(const object of c.objects){
   assert.ok(object.position[0]>=-64&&object.position[0]<-32);
   assert.ok(object.position[2]>=96&&object.position[2]<128);
 }
});
test('rejects unsafe resource budgets',()=>{
 assert.throws(()=>generateErasWorldChunk({vegetation:1000000}));
 assert.throws(()=>generateErasWorldChunk({size:Infinity}));
});
