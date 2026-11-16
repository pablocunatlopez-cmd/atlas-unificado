import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasCanonicalWorldSpec} from './atlas-canonical-world-spec.mjs';
import {planAtlasCanonicalThreeScene} from './atlas-canonical-three-scene-plan.mjs';
test('produces bounded Three.js compatible scene plan without instantiation',()=>{
 const plan=planAtlasCanonicalThreeScene(createAtlasCanonicalWorldSpec());
 assert.equal(plan.spiral.points.length,96);
 assert.equal(plan.anchors.length,6);
 assert.equal(plan.edges.length,5);
 assert.equal(plan.threeObjectsCreated,false);
 assert.equal(plan.erasPortal.target,'eras-house');
});
test('rejects invalid sampling and noncanonical vertices',()=>{
 const spec=createAtlasCanonicalWorldSpec();
 assert.throws(()=>planAtlasCanonicalThreeScene(spec,{spiralSamples:10000}));
 assert.throws(()=>planAtlasCanonicalThreeScene({...spec,manifest:{
  ...spec.manifest,vertices:['Animal','Mente','Logos']}}));
});
test('rejects unsafe coordinates',()=>{
 const spec=createAtlasCanonicalWorldSpec();
 const vertices=spec.vertices.map((v,i)=>i===0?{...v,position:[Infinity,0,0]}:v);
 assert.throws(()=>planAtlasCanonicalThreeScene({...spec,vertices}));
});
