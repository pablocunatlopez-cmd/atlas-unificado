import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LIA_IDENTITY,getLiaVertex} from '../cloud/public/house/lia-identity.js';
import {generateAtlasTangentSpirals} from '../cloud/public/house/atlas-generative-spiral.js';
test('Lía is the whole system and the three comprehension vertices have stable roles',()=>{
 assert.equal(LIA_IDENTITY.name,'Lía');
 assert.equal(LIA_IDENTITY.wholeSystem,true);
 assert.deepEqual(LIA_IDENTITY.vertices.map(v=>v.component),['Atlas','Ion','Constelación']);
 assert.deepEqual(LIA_IDENTITY.vertices.map(v=>v.meaning),[
  'Lo que sé','Lo que veo','Lo que no puedo ver o saber']);
 assert.equal(getLiaVertex('event').domain,'Dios/Suceso');
 assert.equal(getLiaVertex('missing'),null);
 const spiral=generateAtlasTangentSpirals({depth:0,budget:1});
 assert.equal(spiral.identity,'Lía');
 assert.deepEqual(spiral.components,['Atlas','Ion','Constelación']);
 assert.deepEqual(spiral.vertices,LIA_IDENTITY.vertices.map(v=>v.domain));
});
