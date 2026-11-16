import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasCanonicalWorldSpec} from './atlas-canonical-world-spec.mjs';
import {planAtlasCanonicalThreeScene} from './atlas-canonical-three-scene-plan.mjs';
import {createAtlasThreeViewport} from './atlas-canonical-three-viewport.mjs';
test('viewport mounts and disposes every scene object on opt-in',()=>{
 let disposed=0;
 class BufferGeometry{setFromPoints(p){this.points=p;return this;}dispose(){disposed++;}}
 class SphereGeometry extends BufferGeometry{}
 class Material{dispose(){disposed++;}}
 class Vector3{constructor(...coords){this.coords=coords;}}
 class Object3D{constructor(geometry,material){this.geometry=geometry;this.material=material;
  this.position={set(...coords){this.coords=coords;}};this.userData={};}}
 const THREE={BufferGeometry,SphereGeometry,LineBasicMaterial:Material,
  MeshBasicMaterial:Material,Vector3,Mesh:Object3D,Line:Object3D};
 const children=[];
 const scene={add(x){children.push(x);},remove(x){children.splice(children.indexOf(x),1);}};
 const plan=planAtlasCanonicalThreeScene(createAtlasCanonicalWorldSpec());
 const viewport=createAtlasThreeViewport({THREE,scene,plan});
 assert.equal(children.length,0);
 const result=viewport.mount();
 assert.equal(result.objectsAdded,1+plan.anchors.length+plan.edges.length);
 assert.equal(children.length,result.objectsAdded);
 assert.throws(()=>viewport.mount());
 viewport.unmount();
 assert.equal(children.length,0);
 assert.equal(disposed,result.objectsAdded*2);
 assert.equal(viewport.mounted,false);
});
test('rejects untrusted scene plan',()=>{
 assert.throws(()=>createAtlasThreeViewport({THREE:{},scene:{add(){}},
  plan:{renderer:'unknown'}}));
});
