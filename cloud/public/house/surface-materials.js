import * as THREE from './vendor/three.module.js';

const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const fract=n=>n-Math.floor(n);
const hash=(x,y)=>fract(Math.sin(x*127.1+y*311.7)*43758.5453123);
function noise(u,v,period=16){
 const x=u*period,y=v*period,ix=Math.floor(x),iy=Math.floor(y),fx=fract(x),fy=fract(y),a=fx*fx*(3-2*fx),b=fy*fy*(3-2*fy);
 const h=(dx,dy)=>hash(((ix+dx)%period+period)%period,((iy+dy)%period+period)%period);
 return (h(0,0)*(1-a)+h(1,0)*a)*(1-b)+(h(0,1)*(1-a)+h(1,1)*a)*b;
}
const mix=(a,b,t)=>a.map((n,i)=>n+(b[i]-n)*t);
export function surfaceSample(kind,u,v){
 u=fract(u);v=fract(v);const n=noise(u,v,32),fine=noise(u,v,128);
 if(kind==='oak'){
  const row=Math.floor(u*8),across=fract(u*8),along=fract(v+(row%2)*.5),joint=Math.min(across,1-across)*.3<.006||Math.min(along,1-along)<.004;
  const grain=Math.sin(u*Math.PI*192+Math.sin(v*Math.PI*8)*2+noise(u,v,8)*4)*.5+.5;
  const t=clamp(.38+hash(row,0)*.2+grain*.08+n*.12);
  return{color:joint?[.24,.17,.11]:mix([.39,.26,.15],[.79,.66,.47],t),height:joint?0:.48+grain*.015+fine*.018,roughness:joint?.9:.4+n*.22};
 }
 if(kind==='fabric'){
  const weave=Math.sin(u*Math.PI*256)*Math.sin(v*Math.PI*256);
  return{color:mix([.59,.56,.49],[.78,.75,.67],n*.45+.3+weave*.04),height:.5+weave*.08+fine*.025,roughness:.91+fine*.07};
 }
 if(kind==='stone')return{color:mix([.44,.46,.44],[.67,.68,.64],n*.5+fine*.15),height:.5+(n-.5)*.025+(fine-.5)*.015,roughness:.48+fine*.24};
 return{color:mix([.83,.81,.75],[.93,.91,.85],n*.18+fine*.3),height:.5+(fine-.5)*.035,roughness:.87+fine*.1};
}
export function createSurfaceMaps(kind,size=256){
 if(!['oak','fabric','stone','plaster'].includes(kind)||![64,128,256,512].includes(size))throw Error('Invalid surface texture.');
 const colors=new Uint8Array(size*size*4),normals=new Uint8Array(size*size*4),roughness=new Uint8Array(size*size*4),height=new Float32Array(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,s=surfaceSample(kind,x/size,y/size);height[i]=s.height;
  for(let c=0;c<3;c++){colors[i*4+c]=Math.round(clamp(s.color[c])*255);roughness[i*4+c]=Math.round(clamp(s.roughness)*255);}colors[i*4+3]=roughness[i*4+3]=255;
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,dx=(height[y*size+(x+1)%size]-height[y*size+(x-1+size)%size])*1.8,dy=(height[((y+1)%size)*size+x]-height[((y-1+size)%size)*size+x])*1.8,l=Math.hypot(dx,dy,1);
  normals.set([Math.round((.5-dx/l*.5)*255),Math.round((.5-dy/l*.5)*255),Math.round((.5+.5/l)*255),255],i*4);
 }
 const make=(data,color=false)=>{const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t;};
 return{map:make(colors,true),normalMap:make(normals),roughnessMap:make(roughness)};
}
// World-scaled UVs survive static batching: a plank keeps its scale on a long
// floor, a small table and a rotated cabinet instead of stretching to each box.
export function projectSurfaceUV(geometry,scale=2.4){
 const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
 if(!uv||!n)return geometry;
 for(let i=0;i<p.count;i++){
  const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
  const u=ax>ay&&ax>az?-p.getZ(i):p.getX(i),v=ay>ax&&ay>az?-p.getZ(i):p.getY(i);
  uv.setXY(i,u/scale,v/scale);
 }
 return geometry;
}
export function furnitureBox(w,h,d){
 const radius=Math.min(.025,w*.08,h*.12,d*.08);
 if(w<.4||h<.09||d<.3||w>3.5||h>2.6||d>3.5)return new THREE.BoxGeometry(w,h,d);
 const x=-w/2+radius,y=-h/2+radius,W=w-2*radius,H=h-2*radius,r=radius*.6;
 const shape=new THREE.Shape();shape.moveTo(x+r,y);shape.lineTo(x+W-r,y);shape.quadraticCurveTo(x+W,y,x+W,y+r);shape.lineTo(x+W,y+H-r);shape.quadraticCurveTo(x+W,y+H,x+W-r,y+H);shape.lineTo(x+r,y+H);shape.quadraticCurveTo(x,y+H,x,y+H-r);shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
 const g=new THREE.ExtrudeGeometry(shape,{depth:d-2*radius,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:radius,bevelThickness:radius,curveSegments:2});g.translate(0,0,-d/2+radius);g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));return g;
}
