import * as THREE from './vendor/three.module.js';

// A small linear HDR light field generated locally, with broad sky/window
// sources. PMREM supplies roughness-dependent reflection, not ray tracing/GI.
export function environmentPixels(width=256,height=128){
 const data=new Float32Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=x/width,v=y/(height-1),sky=Math.pow(1-v,1.2),window=Math.exp(-(((u-.22)/.055)**8)-(((v-.43)/.14)**8))*3.5,fill=Math.exp(-(((u-.73)/.12)**8)-(((v-.38)/.19)**8))*1.8;
  const i=(y*width+x)*4;data.set([.12+sky*.65+window*1.08+fill,.13+sky*.74+window*.97+fill*1.02,.12+sky*.88+window*.82+fill*1.1,1],i);
 }
 return data;
}
export function installEnvironment(renderer,scene){
 const source=new THREE.DataTexture(environmentPixels(),256,128,THREE.RGBAFormat,THREE.FloatType);source.mapping=THREE.EquirectangularReflectionMapping;source.colorSpace=THREE.LinearSRGBColorSpace;source.needsUpdate=true;
 const pmrem=new THREE.PMREMGenerator(renderer);let target;
 try{pmrem.compileEquirectangularShader();target=pmrem.fromEquirectangular(source);scene.environment=target.texture;scene.environmentIntensity=.65;}finally{source.dispose();pmrem.dispose();}
 let disposed=false;return()=>{if(disposed)return;disposed=true;scene.environment=null;target?.dispose();};
}
