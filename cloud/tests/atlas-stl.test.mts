import test from 'node:test';
import assert from 'node:assert/strict';
import {buildScene,parseBrief,type Scene} from '../lib/studio/scene.ts';
import {sceneToStl} from '../lib/studio/stl.ts';

test('scene STL is finite ASCII geometry with bounds and a triangle count',()=>{
 const scene=buildScene(parseBrief('Una pieza de prueba para impresión','3d',17));
 const result=sceneToStl(scene);
 assert.match(result.stl,/^solid atlas_scene\n/);
 assert.match(result.stl,/facet normal/);
 assert.match(result.stl,/outer loop/);
 assert.ok(result.stl.trim().endsWith('endsolid atlas_scene'));
 assert.doesNotMatch(result.stl,/NaN|Infinity/);
 assert.ok(result.triangles>0);
 assert.ok(result.objects>0);
 assert.ok(result.bounds.min.every(Number.isFinite));
 assert.ok(result.bounds.max.every(Number.isFinite));
 for(let axis=0;axis<3;axis++)assert.ok(result.bounds.min[axis]<=result.bounds.max[axis]);
});

test('a unit box exports twelve triangles and exact scene bounds without the glTF floor',()=>{
 const scene:Scene=buildScene(parseBrief('Una caja','3d',1));
 scene.objects=[{type:'box',position:[1,2,3],size:[1,2,3],material:0,yaw:0}];
 const result=sceneToStl(scene);
 assert.equal(result.triangles,12);
 assert.deepEqual(result.bounds.min,[0,0,0]);
 assert.deepEqual(result.bounds.max,[2,4,6]);
 assert.equal(result.objects,1);
});

test('an empty scene is rejected instead of producing a fake printable file',()=>{
 const scene=buildScene(parseBrief('Vacío','3d',1));
 scene.objects=[];
 assert.throws(()=>sceneToStl(scene),/no contiene geometría/);
});
