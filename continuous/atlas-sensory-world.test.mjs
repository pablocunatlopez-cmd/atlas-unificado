import {test} from 'node:test';
import assert from 'node:assert/strict';
import {atlasSensoryWorld,projectAtlasSensoryWorld} from './atlas-sensory-world.mjs';
import {atlasCharacterCapabilityMap} from './atlas-character-capabilities.mjs';
test('Lía is the entire sensory circle, never a fourth triangle vertex',()=>{
 assert.equal(atlasSensoryWorld.whole.id,'lia');
 assert.equal(atlasSensoryWorld.whole.shape,'circle');
 assert.equal(atlasSensoryWorld.whole.isSeparateVertex,false);
 assert.deepEqual(atlasSensoryWorld.vertices.map(x=>x.id),['atlas','ion','constelacion']);
 assert.ok(atlasSensoryWorld.vertices.every(v=>v.x>0&&v.x<1&&v.y>0&&v.y<1));
});
test('project only declared items, never assert access to total reality',()=>{
 const result=projectAtlasSensoryWorld({observations:[{id:'o',label:'Medición pendiente'}]});
 assert.equal(result.physical[0].evidenceVerified,false);
 assert.equal(result.claimsTotalReality,false);
 assert.equal(result.canExecuteActions,false);
 assert.throws(()=>projectAtlasSensoryWorld({hypotheses:[{id:'x',label:5}]}));
});
test('existing character roles remain mapped alongside the sensory whole',()=>{
 const ids=new Set(atlasCharacterCapabilityMap.map(x=>x.id));
 for(const id of ['lia','atlas','ion','constelacion','icaro','da-vinci','talo','noa','vera','animal','lenguaje','self','kes','mani'])assert.ok(ids.has(id),id);
});
