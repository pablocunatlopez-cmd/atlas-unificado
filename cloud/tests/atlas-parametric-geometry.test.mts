import test from 'node:test';
import assert from 'node:assert/strict';
import {cylinderGeometry,coneGeometry,sceneToGltf} from '../lib/studio/gltf.ts';
import {parseBrief,buildScene} from '../lib/studio/scene.ts';

test('closed radial primitives have finite unit normals, nondegenerate outward triangles and distinct tops',()=>{
 for(const [kind,geometry] of [['cylinder',cylinderGeometry(24)],['cone',coneGeometry(24)]] as const){
  assert.equal(geometry.position.length,geometry.normal.length);assert.ok(geometry.position.every(Number.isFinite));assert.ok(geometry.normal.every(Number.isFinite));
  assert.ok(geometry.indices.every(i=>Number.isInteger(i)&&i>=0&&i<geometry.position.length/3));
  for(let i=0;i<geometry.normal.length;i+=3)assert.ok(Math.abs(Math.hypot(...geometry.normal.slice(i,i+3))-1)<1e-9);
  let upperRadius=0,baseCap=0,topCap=0;
  for(let i=0;i<geometry.position.length;i+=3){const [x,y,z]=geometry.position.slice(i,i+3);assert.ok(y>=-1&&y<=1);assert.ok(Math.hypot(x,z)<=1+1e-9);if(y===1)upperRadius=Math.max(upperRadius,Math.hypot(x,z));}
  for(let i=0;i<geometry.indices.length;i+=3){
   const p=geometry.indices.slice(i,i+3).map(j=>geometry.position.slice(j*3,j*3+3)),n=geometry.normal.slice(geometry.indices[i]*3,geometry.indices[i]*3+3),a=p[1].map((v,j)=>v-p[0][j]),b=p[2].map((v,j)=>v-p[0][j]),cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
   assert.ok(Math.hypot(...cross)>1e-8,kind+' has no collapsed triangles');assert.ok(cross.reduce((sum,v,j)=>sum+v*n[j],0)>0,kind+' triangle faces outward');
   if(p.every(v=>v[1]===-1)){baseCap++;assert.deepEqual(n,[0,-1,0]);}if(p.every(v=>v[1]===1)){topCap++;assert.deepEqual(n,[0,1,0]);}
  }
  assert.equal(baseCap,24);assert.equal(topCap,kind==='cylinder'?24:0);assert.equal(upperRadius,kind==='cylinder'?1:0);
 }
});

test('glTF exports actual radial geometry while preserving material and node transforms',()=>{
 const scene=buildScene(parseBrief('Una torre con tejado cónico','3d',29));scene.objects=[{type:'cylinder',position:[2,3,-1],size:[1.5,3,1.5],material:4,yaw:.6},{type:'cone',position:[2,7,-1],size:[2,1,2],material:2,yaw:.6}];
 const gltf=sceneToGltf(scene),bytes=Buffer.from(gltf.buffers[0].uri.split(',')[1],'base64');
 const values=(id:number)=>{const a=gltf.accessors[id] as {bufferView:number;count:number;componentType:number},view=gltf.bufferViews[a.bufferView];return a.componentType===5123?Array.from(new Uint16Array(bytes.buffer,bytes.byteOffset+view.byteOffset,a.count)):Array.from(new Float32Array(bytes.buffer,bytes.byteOffset+view.byteOffset,a.count*3));};
 for(const [index,kind] of [[1,'cylinder'],[2,'cone']] as const){
  const primitive=gltf.meshes[index].primitives[0],position=values(primitive.attributes.POSITION),indices=values(primitive.indices),normals=values(primitive.attributes.NORMAL);
  assert.ok(position.every(Number.isFinite));assert.ok(normals.every(Number.isFinite));assert.ok(indices.every(i=>i<position.length/3));assert.equal(primitive.material,scene.objects[index-1].material);
  assert.deepEqual(gltf.nodes[index].translation,scene.objects[index-1].position);assert.deepEqual(gltf.nodes[index].scale,scene.objects[index-1].size);assert.ok(Math.abs(gltf.nodes[index].rotation[1]-Math.sin(.3))<1e-9);
  const topRadii=position.flatMap((y,i)=>i%3===1&&y===1?[Math.hypot(position[i-1],position[i+1])]:[]);assert.ok(topRadii.length>0);assert.ok(kind==='cone'?topRadii.every(r=>r===0):Math.max(...topRadii)>.99);
 }
 assert.notEqual(gltf.meshes[1].primitives[0].attributes.POSITION,gltf.meshes[2].primitives[0].attributes.POSITION);
});
