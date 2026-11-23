import * as THREE from './vendor/three.module.js';

/** Semantic surface response for the fixed actor parts. An active visor only
 * reflects workVerified supplied by the process layer; it creates no work. */
export function residentSurface(actor,kind,part,{working=false}={}){
 const robot=actor.archetype==='robot',round=kind==='round';
 if(robot){
  const display=round?[3,4].includes(part):[11,13,17].includes(part);
  if(display)return[.19,.05,working?.24:.025];
  const shell=round?[0,5].includes(part):[0,8,9,10,14,15,16].includes(part);
  return shell?[.34,.72,0]:[.55,.35,0];
 }
 if(round){
  const eye=actor.archetype==='human'?[3,4].includes(part):[2,3].includes(part);
  if(eye)return[.18,0,0];
  if(actor.archetype==='human')return[.64,0,0];
 }
 if(actor.archetype==='animal'||actor.archetype==='bird')return[.93,0,0];
 return[[6,7].includes(part)?.56:.86,0,0];
}

export function bindResidentSurfaces(material,geometry,count){
 const values=new Float32Array(count*3);for(let i=0;i<count;i++)values[i*3]=.8;
 geometry.setAttribute('atlasSurface',new THREE.InstancedBufferAttribute(values,3));
 material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec3 atlasSurface;\nvarying vec3 vAtlasSurface;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvAtlasSurface = atlasSurface;');
  shader.fragmentShader='varying vec3 vAtlasSurface;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = clamp(vAtlasSurface.x, 0.04, 1.0);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor = clamp(vAtlasSurface.y, 0.0, 1.0);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * max(0.0, vAtlasSurface.z);');
 };
 material.customProgramCacheKey=()=> 'atlas-resident-surfaces-1';
 return geometry.attributes.atlasSurface;
}
