import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateLiaProceduralWorld} from './lia-procedural-world.mjs';
test('seeded procedural world is deterministic, bounded and honest about rendering',()=>{
 const a=generateLiaProceduralWorld({seed:42,trees:20,buildings:5});
 const b=generateLiaProceduralWorld({seed:42,trees:20,buildings:5});
 assert.deepEqual(a,b);
 assert.equal(a.rendered,false);
 assert.equal(a.world.objects[0].kind,'terrain');
 assert.equal(a.world.objectCount,1+a.placed.trees+a.placed.buildings);
});
test('reject oversized or invalid world requests',()=>{
 assert.throws(()=>generateLiaProceduralWorld({trees:601}));
 assert.throws(()=>generateLiaProceduralWorld({seed:-1}));
 assert.throws(()=>generateLiaProceduralWorld({extent:0}));
});
