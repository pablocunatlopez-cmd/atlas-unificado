import {assessAtlasCanonicalWorldSpec} from './atlas-canonical-world-spec.mjs';
/**
 * Pure Three.js scene-plan adapter: returns geometry descriptors, not objects.
 * The trusted ERAS renderer must explicitly opt in to instantiate them.
 */
export function planAtlasCanonicalThreeScene(spec,{spiralSamples=96}={}){
 if(!Number.isInteger(spiralSamples)||spiralSamples<24||spiralSamples>512)
  throw Error('Invalid spiral sampling');
 const check=assessAtlasCanonicalWorldSpec(spec);
 if(!check.eligibleForDesignReview)throw Error('World canon check failed');
 const positions=new Map([...spec.vertices,...spec.nodes].map(n=>[n.id,n.position]));
 if([...positions.values()].some(p=>!Array.isArray(p)||p.length!==3||
    p.some(x=>!Number.isFinite(x)||Math.abs(x)>1000)))
  throw Error('Invalid scene coordinates');
 const spiralPoints=[];
 for(let i=0;i<spiralSamples;i++){
  const t=i/(spiralSamples-1),a=t*Math.PI*6,r=0.4+t*8;
  spiralPoints.push(Object.freeze([r*Math.cos(a),t*5-2.5,r*Math.sin(a)]));
 }
 const anchors=Object.freeze([...spec.vertices,...spec.nodes].map(n=>
  Object.freeze({id:n.id,label:n.name||n.kind,position:Object.freeze([...n.position]),
   kind:n.kind||'vertex'})));
 const edges=Object.freeze(spec.nodes.flatMap(n=>(n.links||[]).map(to=>
  Object.freeze({from:n.id,to,points:Object.freeze([
   Object.freeze([...positions.get(n.id)]),Object.freeze([...positions.get(to)])
  ])}))));
 return Object.freeze({schemaVersion:1,renderer:'threejs_compatible_descriptor',
  mode:'dry_run',anchors,edges,spiral:Object.freeze({
   type:'open_polyline',points:Object.freeze(spiralPoints),
   nestedSpirals:'requires_renderer_instancing'}),
  observerCamera:Object.freeze({target:'spiral',source:'observer'}),
  erasPortal:Object.freeze({target:'eras-house',integration:'existing_ERAS_scene_required'}),
  visualEquivalenceVerified:false,threeObjectsCreated:false,
  codeExecuted:false,patchApplied:false,authorizationGranted:false});
}
