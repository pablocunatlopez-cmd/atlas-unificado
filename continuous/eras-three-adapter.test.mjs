import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createErasThreeAdapter} from './eras-three-adapter.mjs';
class Object3D{
 constructor(){this.children=[];this.parent=null;this.userData={};this.position={set:(...v)=>this.pos=v};this.rotation={set:(...v)=>this.rot=v};this.scale={set:(...v)=>this.scl=v};}
 add(x){x.parent?.remove(x);this.children.push(x);x.parent=this;}
 remove(x){this.children=this.children.filter(c=>c!==x);x.parent=null;}
}
class Group extends Object3D{}
class Mesh extends Object3D{constructor(geometry,material){super();this.geometry=geometry;this.material=material;}}
class BoxGeometry{dispose(){this.disposed=true;}}
class MeshStandardMaterial{dispose(){this.disposed=true;}}
class DirectionalLight extends Object3D{}
class PerspectiveCamera extends Object3D{}
const THREE={Group,Mesh,BoxGeometry,MeshStandardMaterial,DirectionalLight,PerspectiveCamera};
const node=(id,parent=null)=>({id,parent,type:'mesh',position:[1,2,3],rotation:[0,0,0],scale:[1,1,1],asset:''});
test('Three adapter creates, transforms, reparents and disposes scene entities',async()=>{
 const scene=new Group();
 const adapter=createErasThreeAdapter({THREE,scene});
 await adapter.create({...node('root'),type:'group'});
 await adapter.create(node('child','root'));
 assert.equal(adapter.getObject('root').children.length,1);
 assert.deepEqual(adapter.getObject('child').pos,[1,2,3]);
 await adapter.update({...node('child'),position:[4,5,6]});
 assert.equal(adapter.getObject('child').parent,scene);
 const child=adapter.getObject('child');
 await adapter.destroy('child');
 assert.equal(child.geometry.disposed,true);
 assert.equal(child.material.disposed,true);
 await adapter.destroy('root');
 assert.equal(scene.children.length,0);
});
test('requires trusted loader for asset IDs',async()=>{
 const adapter=createErasThreeAdapter({THREE,scene:new Group()});
 await assert.rejects(adapter.create({...node('tree'),asset:'oak'}));
});

test('rejects missing parents without retaining a failed entity',async()=>{
 const scene=new Group(),adapter=createErasThreeAdapter({THREE,scene});
 await assert.rejects(adapter.create(node('orphan','missing')),/Parent not created/);
 assert.equal(adapter.getObject('orphan'),null);
 assert.equal(scene.children.length,0);
 await adapter.create({...node('root'),type:'group'});
 await adapter.create(node('child','root'));
 assert.equal(adapter.getObject('child').parent,adapter.getObject('root'));
});
