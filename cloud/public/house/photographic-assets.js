import * as THREE from './vendor/three.module.js';
const KINDS=['oak','plaster','fabric','stone'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Approximate fine relief from evenly lit albedo. These are constructed
// channels, not measured surface scans; keep their amplitude restrained.
export function deriveSurfaceChannels(pixels,size,kind){
 if(!KINDS.includes(kind)||!Number.isInteger(size)||size<8||size>512||pixels.length!==size*size*4)throw Error('Invalid surface channel input.');
 const heights=new Float32Array(size*size),normal=new Uint8Array(size*size*4),roughness=new Uint8Array(size*size*4),base={oak:.48,plaster:.9,fabric:.95,stone:.63}[kind];
 for(let i=0;i<heights.length;i++)heights[i]=(pixels[i*4]*.2126+pixels[i*4+1]*.7152+pixels[i*4+2]*.0722)/255;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,dx=clamp((heights[y*size+(x+1)%size]-heights[y*size+(x-1+size)%size])*.8,-.16,.16),dy=clamp((heights[((y+1)%size)*size+x]-heights[((y-1+size)%size)*size+x])*.8,-.16,.16),l=Math.hypot(dx,dy,1),r=Math.round(clamp(base+(heights[i]-.5)*.08,.1,1)*255);
  normal.set([Math.round((.5-dx/l*.5)*255),Math.round((.5+dy/l*.5)*255),Math.round((.5+.5/l)*255),255],i*4);roughness.set([r,r,r,255],i*4);
 }
 return{normal,roughness};
}
const dataTexture=(data,size)=>{const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.colorSpace=THREE.NoColorSpace;t.flipY=true;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};

/** Load one atlas only; extract quadrants once so mipmaps never bleed between
 * unrelated materials. Existing procedural materials stay active on failure. */
export function loadPhotographicSurfaces(scene,{url='./assets/generated/material-atlas.png',mobile=false}={}){
 const owned=[],loader=new THREE.ImageLoader();let disposed=false;
 const ready=loader.loadAsync(url).then(img=>{
  if(disposed)return false;
  const size=Math.min(mobile?512:1024,Math.floor(img.width/2),Math.floor(img.height/2)),channelSize=256,maps={};
  for(let i=0;i<KINDS.length;i++){
   const kind=KINDS[i],tile=document.createElement('canvas');tile.width=tile.height=size;const ctx=tile.getContext('2d');if(!ctx)throw Error('Material canvas unavailable.');
   ctx.drawImage(img,(i%2)*img.width/2,Math.floor(i/2)*img.height/2,img.width/2,img.height/2,0,0,size,size);
   const map=new THREE.CanvasTexture(tile);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=mobile?4:8;
   const sample=document.createElement('canvas');sample.width=sample.height=channelSize;const sampleCtx=sample.getContext('2d',{willReadFrequently:true});if(!sampleCtx)throw Error('Material sampling unavailable.');sampleCtx.drawImage(tile,0,0,channelSize,channelSize);
   const data=deriveSurfaceChannels(sampleCtx.getImageData(0,0,channelSize,channelSize).data,channelSize,kind),normalMap=dataTexture(data.normal,channelSize),roughnessMap=dataTexture(data.roughness,channelSize);owned.push(map,normalMap,roughnessMap);maps[kind]={map,normalMap,roughnessMap};
  }
  const seen=new Set();scene.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){if(seen.has(m))continue;seen.add(m);const mapsFor=maps[m.userData?.surfaceKind];if(mapsFor){Object.assign(m,mapsFor);m.normalScale.set(.6,.6);m.needsUpdate=true;}}});
  return true;
 }).catch(error=>{for(const t of owned.splice(0))t.dispose();throw error;});
 return{ready,dispose(){if(disposed)return;disposed=true;for(const t of owned.splice(0))t.dispose();}};
}

export async function loadPhotographicEnvironment(renderer,scene,{url='./assets/generated/garden-environment.png',isActive=()=>true}={}){
 const texture=await new THREE.TextureLoader().loadAsync(url);let target;
 if(!isActive()){texture.dispose();return null;}
 texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;
 const generator=new THREE.PMREMGenerator(renderer);
 try{target=generator.fromEquirectangular(texture);}catch(error){texture.dispose();throw error;}finally{generator.dispose();}
 if(!isActive()){target.dispose();texture.dispose();return null;}
 scene.environment=target.texture;scene.environmentIntensity=.8;scene.background=texture;scene.backgroundIntensity=.88;scene.backgroundBlurriness=.025;
 let disposed=false;return()=>{if(disposed)return;disposed=true;if(scene.environment===target.texture)scene.environment=null;if(scene.background===texture)scene.background=null;target.dispose();texture.dispose();};
}
