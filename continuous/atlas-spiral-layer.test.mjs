import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasSpiralLayer} from '../cloud/public/house/atlas-spiral-layer.js';
test('spiral is optional, reversible and uses host scene',()=>{
 let disposed=0;
 class Group{constructor(){this.children=[];this.visible=true;}add(o){this.children.push(o);}}
 class Geometry{setFromPoints(){return this;}dispose(){disposed++;}}
 class Material{dispose(){disposed++;}}
 class Vector3{constructor(...v){this.values=v;}}
 class Mesh{constructor(geometry,material){this.geometry=geometry;this.material=material;
  this.position={set(){}};}}
 const THREE={Group,BufferGeometry:Geometry,SphereGeometry:Geometry,
  LineBasicMaterial:Material,MeshBasicMaterial:Material,Vector3,Line:Mesh,Mesh};
 const children=[],scene={add(x){children.push(x);},remove(x){children.splice(children.indexOf(x),1);}};
 const layer=createAtlasSpiralLayer({THREE,scene});
 assert.deepEqual(layer.vertices,['mental','physical','event']);
 assert.equal(layer.visible,false);
 assert.equal(children.length,0);
 layer.mount();layer.show();assert.equal(layer.visible,true);
 layer.hide();assert.equal(layer.visible,false);
 layer.dispose();assert.equal(children.length,0);
 assert.ok(disposed>0);
 assert.equal(layer.rendererCreated,false);
 assert.throws(()=>layer.mount());
});
