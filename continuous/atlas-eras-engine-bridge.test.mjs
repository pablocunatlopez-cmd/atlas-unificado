import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileAtlasErasScene} from './atlas-eras-engine-bridge.mjs';

test('Atlas compiles a deterministic ERAS scene manifest',()=>{
 const spec={id:'forest',seed:42,player:{x:12,z:-4},graphics:{mobile:true},
   world:{chunkSize:32,radius:1,maxChunks:5,vegetation:10}};
 const first=compileAtlasErasScene(spec);
 assert.deepEqual(first,compileAtlasErasScene(spec));
 assert.equal(first.engine,'ERAS');
 assert.equal(first.renderStatus,'manifest_only');
 assert.equal(first.chunks.length,5);
 assert.equal(first.chunks.reduce((n,c)=>n+c.objects.length,0),50);
});
test('rejects excessive generated objects',()=>{
 assert.throws(()=>compileAtlasErasScene({world:{radius:4,maxChunks:81,vegetation:200}}));
});
test('rejects malformed scene and player coordinates',()=>{
 assert.throws(()=>compileAtlasErasScene({id:'../../evil'}));
 assert.throws(()=>compileAtlasErasScene({player:{x:Infinity,z:0}}));
});
