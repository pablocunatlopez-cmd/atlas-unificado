import test from 'node:test';
import assert from 'node:assert/strict';
import {buildScene,parseBrief,type Scene} from '../lib/studio/scene.ts';
import {sceneToStl,validateScene} from '../lib/studio/stl.ts';

test('scene STL is finite ASCII geometry with a closed mesh report',()=>{
 const scene=buildScene(parseBrief('Una pieza de prueba para impresión','3d',17));
 const result=sceneToStl(scene);
 assert.match(result.stl,/^solid atlas_scene_mm\n/);
 assert.match(result.stl,/facet normal/);
 assert.match(result.stl,/outer loop/);
 assert.ok(result.stl.trim().endsWith('endsolid atlas_scene_mm'));
 assert.doesNotMatch(result.stl,/NaN|Infinity/);
 assert.ok(result.triangles>0);
 assert.ok(result.objects>0);
 assert.ok(result.bounds.min.every(Number.isFinite));
 assert.ok(result.bounds.max.every(Number.isFinite));
 for(let axis=0;axis<3;axis++)assert.ok(result.bounds.min[axis]<=result.bounds.max[axis]);
 assert.equal(result.report.objects,result.objects);
 assert.equal(result.report.triangles,result.triangles);
 assert.equal(result.report.errors.length,0);
 assert.equal(result.report.closedObjects,result.report.objects);
 assert.ok(result.report.minThicknessMm!==null);
});

test('a unit box exports twelve triangles, millimetre bounds and a measured thickness',()=>{
 const scene:Scene=buildScene(parseBrief('Una caja','3d',1));
 scene.objects=[{type:'box',position:[1,2,3],size:[1,2,3],material:0,yaw:0}];
 const result=sceneToStl(scene);
 assert.equal(result.triangles,12);
 assert.deepEqual(result.bounds.min,[0,0,0]);
 assert.deepEqual(result.bounds.max,[2,4,6]);
 assert.deepEqual(result.report.dimensionsMm,[2,4,6]);
 assert.equal(result.report.objects,1);
 assert.equal(result.report.closedObjects,1);
 assert.equal(result.report.errors.length,0);
 assert.ok(Math.abs(result.report.minThicknessMm!-2)<1e-3);
});

test('the scale is explicit and multiplies STL coordinates and thickness in millimetres',()=>{
 const scene:Scene=buildScene(parseBrief('Una caja','3d',1));
 scene.objects=[{type:'box',position:[1,2,3],size:[1,2,3],material:0,yaw:0}];
 const result=sceneToStl(scene,{millimetersPerUnit:10,minWallMm:1});
 assert.deepEqual(result.bounds.min,[0,0,0]);
 assert.deepEqual(result.bounds.max,[20,40,60]);
 assert.deepEqual(result.report.dimensionsMm,[20,40,60]);
 assert.equal(result.report.millimetersPerUnit,10);
 assert.ok(Math.abs(result.report.minThicknessMm!-20)<1e-3);
});

test('thin parts produce a clear warning instead of passing silently',()=>{
 const scene:Scene=buildScene(parseBrief('Una caja','3d',1));
 scene.objects=[{type:'box',position:[0,0,0],size:[.2,2,3],material:0,yaw:0}];
 const report=validateScene(scene,{millimetersPerUnit:1,minWallMm:1.2});
 assert.equal(report.ok,true);
 assert.ok(report.warnings.some(issue=>issue.code==='thin'));
 assert.ok(Math.abs(report.minThicknessMm!-.4)<1e-3);
});

test('overlapping shells are reported as a union risk without inventing a boolean result',()=>{
 const scene:Scene=buildScene(parseBrief('Dos cajas','3d',1));
 scene.objects=[
  {type:'box',position:[0,0,0],size:[1,1,1],material:0,yaw:0},
  {type:'box',position:[.5,0,0],size:[1,1,1],material:0,yaw:0},
 ];
 const report=validateScene(scene);
 assert.equal(report.ok,true);
 assert.equal(report.objects,2);
 assert.equal(report.closedObjects,2);
 assert.ok(report.warnings.some(issue=>issue.code==='overlap'));
});

test('the sphere shell is watertight and has no degenerate pole triangles',()=>{
 const scene:Scene=buildScene(parseBrief('Una esfera','3d',1));
 scene.objects=[{type:'sphere',position:[0,0,0],size:[1,1,1],material:0,yaw:0}];
 const report=validateScene(scene);
 assert.equal(report.errors.length,0);
 assert.equal(report.closedObjects,1);
 assert.ok(report.triangles>0);
 assert.ok(report.minThicknessMm!>1.9);
});

test('invalid objects report a blocking geometry error before any download',()=>{
 const scene:Scene=buildScene(parseBrief('Una caja rota','3d',1));
 scene.objects=[{type:'box',position:[0,0,0],size:[0,1,1],material:0,yaw:0}];
 const report=validateScene(scene);
 assert.equal(report.ok,false);
 assert.ok(report.errors.some(issue=>issue.code==='geometry'));
 assert.match(report.summary,/No exportar todavía/);
});

test('an empty scene is rejected instead of producing a fake printable file',()=>{
 const scene=buildScene(parseBrief('Vacío','3d',1));
 scene.objects=[];
 assert.throws(()=>sceneToStl(scene),/no contiene geometría/);
});

test('invalid scale and wall values are rejected before generating a misleading file',()=>{
 const scene=buildScene(parseBrief('Una caja','3d',1));
 assert.throws(()=>sceneToStl(scene,{millimetersPerUnit:0}),/escala/);
 assert.throws(()=>sceneToStl(scene,{minWallMm:0}),/grosor/);
});
