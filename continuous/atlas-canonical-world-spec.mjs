import {assessAtlasVisualCanon} from './atlas-visual-canon-gate.mjs';
/**
 * A declarative navigable-world specification. Coordinates are design units,
 * not proof of a working renderer or real-world physical geometry.
 */
export function createAtlasCanonicalWorldSpec(){
 const vertices=Object.freeze([
  Object.freeze({id:'mental',name:'Mundo Mental',position:Object.freeze([-12,0,-8])}),
  Object.freeze({id:'physical',name:'Mundo Físico',position:Object.freeze([12,0,-8])}),
  Object.freeze({id:'event',name:'Dios/Suceso',position:Object.freeze([0,0,14])})
 ]);
 const nodes=Object.freeze([
  Object.freeze({id:'observer',kind:'observer',position:Object.freeze([0,4,0]),links:Object.freeze(['spiral'])}),
  Object.freeze({id:'spiral',kind:'open_nested_temporal_spiral',position:Object.freeze([0,0,0]),links:Object.freeze(['mental','physical','event','eras-house'])}),
  Object.freeze({id:'eras-house',kind:'navigable_3d_world',position:Object.freeze([0,-3,-15]),links:Object.freeze(['spiral'])})
 ]);
 const manifest=Object.freeze({
  vertices:Object.freeze(vertices.map(v=>v.name)),
  spiral:Object.freeze({open:true,historyVisible:true,nestedSpirals:true}),
  observer:Object.freeze({visible:true,perspectiveLinked:true}),
  suceso:Object.freeze({reframesModel:true,isReligiousPersonification:false}),
  world:Object.freeze({erasIntegrated:true,characterActivityGrounded:true})
 });
 return Object.freeze({schemaVersion:1,mode:'declarative_only',
  units:'conceptual_scene_units',vertices,nodes,manifest,
  navigation:Object.freeze({entry:'observer',paths:Object.freeze([
   Object.freeze(['observer','spiral','eras-house']),
   Object.freeze(['observer','spiral','mental']),
   Object.freeze(['observer','spiral','physical']),
   Object.freeze(['observer','spiral','event'])
  ])}),
  eventBehavior:'A new event may trigger a proposed reinterpretation; it never rewrites approved history automatically',
  visualVerificationRequired:true,rendererImplemented:false,
  codeExecuted:false,patchApplied:false,authorizationGranted:false});
}
export function assessAtlasCanonicalWorldSpec(spec){
 if(!spec||!Array.isArray(spec.nodes)||!Array.isArray(spec.vertices))
  throw Error('World specification required');
 const canon=assessAtlasVisualCanon(spec.manifest);
 const ids=new Set([...spec.nodes,...spec.vertices].map(n=>n.id));
 const missingLinks=spec.nodes.flatMap(n=>!Array.isArray(n.links)?[n.id]:
  n.links.filter(id=>!ids.has(id)).map(id=>n.id+'->'+id));
 const missingPaths=!Array.isArray(spec.navigation?.paths)||
  spec.navigation.paths.some(path=>!Array.isArray(path)||
   path.some(id=>!ids.has(id)));
 return Object.freeze({schemaVersion:1,mode:'declarative_only',
  canon,missingLinks:Object.freeze(missingLinks),
  missingPaths,eligibleForDesignReview:canon.eligibleForVisualReview&&
   missingLinks.length===0&&!missingPaths,
  visualEquivalenceVerified:false,rendererImplemented:false,
  authorizationGranted:false,codeExecuted:false});
}
