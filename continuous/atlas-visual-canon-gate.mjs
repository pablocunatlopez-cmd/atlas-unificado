/**
 * Declarative visual-canon gate. Only validates explicit design metadata;
 * it cannot inspect pixels, judge aesthetics or prove a rendered scene.
 */
const VERTICES=Object.freeze(['Mundo Mental','Mundo Físico','Dios/Suceso']);
const LEGACY=new Set(['Animal','Mente','Logos','Lenguaje']);
export function assessAtlasVisualCanon(manifest){
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))
  throw Error('Visual manifest required');
 const issues=[];
 if(!Array.isArray(manifest.vertices)||manifest.vertices.length!==3||
    manifest.vertices.some((v,i)=>v!==VERTICES[i]))
  issues.push('canonical_vertices_mismatch');
 if(!manifest.spiral||manifest.spiral.open!==true||
    manifest.spiral.historyVisible!==true||
    manifest.spiral.nestedSpirals!==true)
  issues.push('spiral_structure_incomplete');
 if(!manifest.observer||manifest.observer.visible!==true||
    manifest.observer.perspectiveLinked!==true)
  issues.push('observer_not_represented');
 if(!manifest.suceso||manifest.suceso.reframesModel!==true||
    manifest.suceso.isReligiousPersonification===true)
  issues.push('event_meaning_mismatch');
 if(!manifest.world||manifest.world.erasIntegrated!==true||
    manifest.world.characterActivityGrounded!==true)
  issues.push('world_integration_unverified');
 if(Array.isArray(manifest.primaryVertexAliases)&&
    manifest.primaryVertexAliases.some(x=>LEGACY.has(x)))
  issues.push('historical_terms_used_as_primary_vertices');
 return Object.freeze({schemaVersion:1,mode:'design_manifest_only',
  expectedVertices:VERTICES,issues:Object.freeze(issues),
  eligibleForVisualReview:issues.length===0,
  renderedPixelsInspected:false,visualEquivalenceVerified:false,
  codeExecuted:false,patchApplied:false,authorizationGranted:false,
  note:'Passing manifest checks does not prove the interface implements these claims'});
}
