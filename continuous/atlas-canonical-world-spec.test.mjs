import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasCanonicalWorldSpec,assessAtlasCanonicalWorldSpec}
 from './atlas-canonical-world-spec.mjs';
test('canonical world connects observer, spiral, vertices and ERAS house',()=>{
 const spec=createAtlasCanonicalWorldSpec();
 const result=assessAtlasCanonicalWorldSpec(spec);
 assert.equal(result.eligibleForDesignReview,true);
 assert.equal(result.rendererImplemented,false);
 assert.equal(result.visualEquivalenceVerified,false);
 assert.equal(spec.navigation.entry,'observer');
 assert.deepEqual(spec.manifest.vertices,['Mundo Mental','Mundo Físico','Dios/Suceso']);
});
test('broken spatial links are rejected',()=>{
 const spec=createAtlasCanonicalWorldSpec();
 const nodes=spec.nodes.map(n=>n.id==='spiral'?{...n,links:[...n.links,'unknown']}:n);
 const result=assessAtlasCanonicalWorldSpec({...spec,nodes});
 assert.deepEqual(result.missingLinks,['spiral->unknown']);
 assert.equal(result.eligibleForDesignReview,false);
});
test('historical vertex substitution blocks design eligibility',()=>{
 const spec=createAtlasCanonicalWorldSpec();
 const result=assessAtlasCanonicalWorldSpec({...spec,
  manifest:{...spec.manifest,vertices:['Animal','Mente','Logos']}});
 assert.equal(result.eligibleForDesignReview,false);
});
