import * as THREE from './vendor/three.module.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const noise=(x,y)=>{let n=Math.imul(x+137,374761393)^Math.imul(y+271,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
/** Preserve the authored UV-aligned anatomy and albedo. Add only restrained
 * procedural micro-normal and roughness detail, never new facial features. */
export function skinDetailChannels(normal,roughness,width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<8||height<8||width>2048||height>2048||normal.length!==width*height*4||roughness.length!==normal.length)throw Error('Invalid skin detail channels.');
 const normals=new Uint8Array(normal.length),rough=new Uint8Array(roughness.length);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,dx=(noise((x+1)%width,y)-noise((x-1+width)%width,y))*.028,dy=(noise(x,(y+1)%height)-noise(x,(y-1+height)%height))*.028;
  let nx=normal[i]/127.5-1+dx,ny=normal[i+1]/127.5-1+dy,nz=Math.max(.05,normal[i+2]/127.5-1),l=Math.hypot(nx,ny,nz);nx/=l;ny/=l;nz/=l;
  normals.set([Math.round((nx*.5+.5)*255),Math.round((ny*.5+.5)*255),Math.round((nz*.5+.5)*255),normal[i+3]],i);
  const variation=(noise(x,y)-.5)*8;for(let c=0;c<3;c++)rough[i+c]=clamp(Math.round(roughness[i+c]+variation),0,255);rough[i+3]=roughness[i+3];
 }
 return{normal:normals,roughness:rough};
}
export function prepareSkinDetail(normal,roughness){
 if(typeof document==='undefined'||!normal?.image?.width||!roughness?.image?.width)return null;
 const width=normal.image.width,height=normal.image.height;if(width>2048||height>2048)return null;
 const read=image=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Skin channel canvas unavailable');ctx.drawImage(image,0,0,width,height);return ctx.getImageData(0,0,width,height).data;};
 const channels=skinDetailChannels(read(normal.image),read(roughness.image),width,height);
 const make=(bytes,source)=>{const t=new THREE.DataTexture(bytes,width,height,THREE.RGBAFormat);t.flipY=source.flipY;t.colorSpace=THREE.NoColorSpace;t.wrapS=source.wrapS;t.wrapT=source.wrapT;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t;};
 return{normal:make(channels.normal,normal),roughness:make(channels.roughness,roughness)};
}
