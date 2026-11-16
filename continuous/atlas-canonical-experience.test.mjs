import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasCanonicalExperience} from './atlas-canonical-experience.mjs';
function fixture(){
 class Geometry{setFromPoints(){return this;}dispose(){}}
 class Material{dispose(){}}
 class Vector3{constructor(...p){this.p=p;}}
 class Mesh{constructor(geometry,material){this.geometry=geometry;this.material=material;
  this.position={set(){}};this.userData={};}}
 const THREE={BufferGeometry:Geometry,SphereGeometry:Geometry,
  LineBasicMaterial:Material,MeshBasicMaterial:Material,Vector3,Line:Mesh,Mesh};
 const objects=[],events=new Map(),cameraCalls=[];
 const scene={add(o){objects.push(o);},remove(o){objects.splice(objects.indexOf(o),1);}};
 const camera={position:{set(...p){cameraCalls.push(['position',...p]);}},
  lookAt(...p){cameraCalls.push(['lookAt',...p]);},
  rotateX(){},rotateY(){}};
 const inputSurface={clientWidth:400,clientHeight:800,
  addEventListener(name,fn){events.set(name,fn);},
  removeEventListener(name){events.delete(name);}};
 return {THREE,scene,camera,inputSurface,objects,events,cameraCalls};
}
test('experience opts in to mount, navigate and dispose resources',()=>{
 const f=fixture(),x=createAtlasCanonicalExperience(f);
 assert.equal(f.objects.length,0);
 assert.equal(x.mounted,false);
 assert.throws(()=>x.navigate('spiral'));
 x.mount();
 assert.equal(x.mounted,true);
 assert.equal(f.events.size,4);
 assert.ok(f.objects.length>0);
 x.navigate('spiral');x.tick(650);
 assert.equal(x.current,'spiral');
 x.navigate('eras-house');x.tick(650);
 assert.equal(x.erasPortalAvailable,true);
 x.unmount();
 assert.equal(f.events.size,0);
 assert.equal(f.objects.length,0);
 assert.equal(x.mounted,false);
});
test('pointer gesture is host-controlled and listeners are cleaned',()=>{
 const f=fixture(),x=createAtlasCanonicalExperience(f);
 x.mount();
 f.events.get('pointerdown')({clientX:50,clientY:50,isPrimary:true});
 f.events.get('pointermove')({clientX:80,clientY:70,isPrimary:true});
 f.events.get('pointercancel')();
 x.unmount();
 assert.equal(f.events.size,0);
});
