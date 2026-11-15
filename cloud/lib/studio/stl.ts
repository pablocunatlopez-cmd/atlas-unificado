import {boxGeometry,sphereGeometry} from './gltf.ts';
import type {Scene,SceneObject,Vec3} from './scene.ts';

export type StlBounds={min:Vec3;max:Vec3};
export type StlExport={stl:string;triangles:number;objects:number;bounds:StlBounds};

const number=(value:number)=>Math.abs(value)<1e-9?0:value;
const format=(value:number)=>number(value).toFixed(6);
const vector=(values:number[],index:number):Vec3=>[values[index],values[index+1],values[index+2]];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const subtract=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
function normal(a:Vec3,b:Vec3,c:Vec3):Vec3{
 const value=cross(subtract(b,a),subtract(c,a)),length=Math.hypot(value[0],value[1],value[2]);
 return length<1e-9?[0,0,0]:[value[0]/length,value[1]/length,value[2]/length];
}
function transform(object:SceneObject,point:Vec3):Vec3{
 const x=point[0]*object.size[0],y=point[1]*object.size[1],z=point[2]*object.size[2];
 const cosine=Math.cos(object.yaw),sine=Math.sin(object.yaw);
 return [x*cosine+z*sine+object.position[0],y+object.position[1],-x*sine+z*cosine+object.position[2]];
}
function vertex(object:SceneObject,points:number[],index:number):Vec3{
 return transform(object,vector(points,index*3));
}

// This is a scene mesh, not a validated solid. It is deliberately conservative:
// the caller must inspect scale, manifoldness, wall thickness and supports in a
// slicer before any physical fabrication.
export function sceneToStl(scene:Scene):StlExport{
 const geometries={box:boxGeometry(),sphere:sphereGeometry()};
 const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];
 const facets:string[]=[];let triangles=0,objects=0;
 for(const object of scene.objects){
  if(!object||!['box','sphere'].includes(object.type))continue;
  if(![...object.position,...object.size,object.yaw].every(Number.isFinite))continue;
  if(object.size.some(value=>value<=0))continue;
  const geometry=geometries[object.type];
  objects++;
  for(let index=0;index<geometry.indices.length;index+=3){
   const a=vertex(object,geometry.position,geometry.indices[index]);
   const b=vertex(object,geometry.position,geometry.indices[index+1]);
   const c=vertex(object,geometry.position,geometry.indices[index+2]);
   for(const point of [a,b,c])for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],point[axis]);max[axis]=Math.max(max[axis],point[axis]);}
   const n=normal(a,b,c);
   facets.push(` facet normal ${format(n[0])} ${format(n[1])} ${format(n[2])}\n  outer loop\n   vertex ${format(a[0])} ${format(a[1])} ${format(a[2])}\n   vertex ${format(b[0])} ${format(b[1])} ${format(b[2])}\n   vertex ${format(c[0])} ${format(c[1])} ${format(c[2])}\n  endloop\n endfacet`);
   triangles++;
  }
 }
 if(!triangles)throw new Error('La escena no contiene geometría exportable.');
 // STL has no unit metadata. Atlas scene units are passed through unchanged.
 return {stl:`solid atlas_scene\n${facets.join('\n')}\nendsolid atlas_scene\n`,triangles,objects,bounds:{min,max}};
}
