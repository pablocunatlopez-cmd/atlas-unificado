import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasSpiralLayer} from '../cloud/public/house/atlas-spiral-layer.js';
test('nested spirals are three separate open polylines',()=>{
 class Group{constructor(){this.children=[];this.visible=true;}add(x){this.children.push(x);}}
 class Geometry{setFromPoints(p){this.points=p;return this;}dispose(){}}
 class Material{dispose(){}}
 class Vector3{constructor(...p){this.p=p;}}
 class Mesh{constructor(g,m){this.geometry=g;this.material=m;this.position={set(){}};this.userData={};}}
 const THREE={Group,BufferGeometry:Geometry,SphereGeometry:Geometry,LineBasicMaterial:Material,MeshBasicMaterial:Material,Vector3,Line:Mesh,Mesh};
 let group;const scene={add(x){group=x;},remove(){}};
 const layer=createAtlasSpiralLayer({THREE,scene});layer.mount();
 const polylines=group.children.filter(x=>x.geometry.points?.length===144);
 assert.equal(polylines.length,3);
 layer.show();
 const raycaster={setFromCamera(){},intersectObjects(meshes){return [{object:meshes[0]}];}};
 assert.equal(layer.pick({raycaster,camera:{},ndc:[0,0]}),'mental');
 assert.throws(()=>layer.pick({raycaster,camera:{},ndc:[2,0]}));
 layer.hide();assert.equal(layer.pick({raycaster,camera:{},ndc:[0,0]}),null);
 layer.dispose();
});
