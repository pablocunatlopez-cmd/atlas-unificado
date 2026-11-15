import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createErasThreeViewport} from './eras-three-viewport.mjs';
class Obj{constructor(){this.position={set:(...v)=>this.xyz=v};this.children=[];}add(o){this.children.push(o);}}
class Scene extends Obj{}
class PerspectiveCamera extends Obj{constructor(fov,aspect){super();this.aspect=aspect;}updateProjectionMatrix(){this.updated=true;}}
class DirectionalLight extends Obj{}
class AmbientLight extends Obj{}
class WebGLRenderer{
 constructor({canvas}){this.canvas=canvas;this.calls=[];this.outputColorSpace='';this.toneMapping=0;}
 setPixelRatio(n){this.ratio=n;}setSize(w,h,update){this.size=[w,h,update];}
 render(scene,camera){this.calls.push([scene,camera]);}
 dispose(){this.disposed=true;}
}
const THREE={Scene,PerspectiveCamera,DirectionalLight,AmbientLight,WebGLRenderer,
 SRGBColorSpace:'srgb',ACESFilmicToneMapping:1};
test('creates viewport, renders and cleans up',()=>{
 const viewport=createErasThreeViewport({THREE,canvas:{},width:640,height:360});
 assert.deepEqual(viewport.renderer.size,[640,360,false]);
 assert.equal(viewport.camera.aspect,640/360);
 viewport.render();assert.equal(viewport.renderer.calls.length,1);
 viewport.resize(300,600,1.5);assert.equal(viewport.camera.aspect,.5);
 viewport.dispose();assert.equal(viewport.renderer.disposed,true);
 assert.throws(()=>viewport.render());
});
test('rejects invalid dimensions and pixel ratios',()=>{
 assert.throws(()=>createErasThreeViewport({THREE,canvas:{},width:0}));
 const viewport=createErasThreeViewport({THREE,canvas:{}});
 assert.throws(()=>viewport.resize(100,100,10));
 viewport.dispose();
});
