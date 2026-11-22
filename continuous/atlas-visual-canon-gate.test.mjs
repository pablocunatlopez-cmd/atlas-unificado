import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessAtlasVisualCanon} from './atlas-visual-canon-gate.mjs';
const manifest={
 vertices:['Mundo Mental','Mundo Físico','Dios/Suceso'],
 spiral:{open:true,historyVisible:true,nestedSpirals:true},
 observer:{visible:true,perspectiveLinked:true},
 suceso:{reframesModel:true,isReligiousPersonification:false},
 world:{erasIntegrated:true,characterActivityGrounded:true}
};
test('canonical design manifest is eligible for visual inspection, not verified',()=>{
 const r=assessAtlasVisualCanon(manifest);
 assert.equal(r.eligibleForVisualReview,true);
 assert.equal(r.visualEquivalenceVerified,false);
 assert.equal(r.renderedPixelsInspected,false);
});
test('rejects historic substitutions for canonical vertices',()=>{
 const r=assessAtlasVisualCanon({...manifest,
  vertices:['Animal','Mente','Logos'],primaryVertexAliases:['Logos']});
 assert.equal(r.eligibleForVisualReview,false);
 assert.equal(r.issues.includes('canonical_vertices_mismatch'),true);
});
test('detects missing observer and misleading religious representation',()=>{
 const r=assessAtlasVisualCanon({...manifest,observer:{visible:false},
  suceso:{reframesModel:false,isReligiousPersonification:true}});
 assert.equal(r.issues.includes('observer_not_represented'),true);
 assert.equal(r.issues.includes('event_meaning_mismatch'),true);
});
test('rejects a closed decorative spiral',()=>{
 const r=assessAtlasVisualCanon({...manifest,spiral:{open:false}});
 assert.equal(r.issues.includes('spiral_structure_incomplete'),true);
});
