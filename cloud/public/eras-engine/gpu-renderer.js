import * as THREE from './vendor/three.webgpu.js';
import * as T from './vendor/three.tsl.js';
import {ao} from './vendor/GTAONode.js';
import {bloom} from './vendor/BloomNode.js';
import {dof} from './vendor/DepthOfFieldNode.js';
import {fxaa} from './vendor/FXAANode.js';

const hash=T.Fn(([p])=>T.fract(T.sin(T.dot(p,T.vec2(127.1,311.7))).mul(43758.5453)));
const noise=T.Fn(([p])=>{
  const i=T.floor(p),f=T.fract(p),s=f.mul(f).mul(T.float(3).sub(f.mul(2)));
  return T.mix(T.mix(hash(i),hash(i.add(T.vec2(1,0))),s.x),T.mix(hash(i.add(T.vec2(0,1))),hash(i.add(1)),s.x),s.y);
});
function fbm(p){let sum=T.float(0),amplitude=.5;for(let i=0;i<5;i++){sum=sum.add(noise(p).mul(amplitude));p=p.mul(2.03).add(17.1);amplitude*=.5;}return sum;}
function triplanar(map,p,n,scale){
  const raw=T.abs(n).pow(6),weight=raw.div(T.max(raw.x.add(raw.y).add(raw.z),.001));
  return T.texture(map,p.zy.mul(scale)).rgb.mul(weight.x).add(T.texture(map,p.xz.mul(scale)).rgb.mul(weight.y)).add(T.texture(map,p.xy.mul(scale)).rgb.mul(weight.z));
}
function copyMaterial(source,target){
  // Matches Three's StandardNodeLibrary conversion, while retaining the node
  // material's identity and all photographic texture/color references.
  for(const key in source)if(!['id','uuid','type','version','onBeforeCompile','customProgramCacheKey'].includes(key))target[key]=source[key];
  target.userData={...source.userData,erasNode:true};
  return target;
}

export class GPUMaterialBridge {
  constructor(){this.materials=new WeakMap();this.bindings=new Set();}
  uniform(source){const node=T.uniform(source.value);this.bindings.add({source,node});return node;}
  convert(source){
    if(source.isNodeMaterial)return source;
    if(this.materials.has(source))return this.materials.get(source);
    const spec=source.userData.erasGPU;
    if(!spec&&!source.userData.erasSkin)return source;
    let mat;
    if(source.userData.erasSkin){
      mat=copyMaterial(source,new THREE.MeshSSSNodeMaterial());
      const albedo=source.map?T.texture(source.map).rgb:T.vec3(1);
      mat.thicknessColorNode=albedo.mul(T.vec3(.48,.12,.075));
      mat.thicknessDistortionNode=T.float(.18);mat.thicknessAmbientNode=T.float(.015);
      mat.thicknessAttenuationNode=T.float(.13);mat.thicknessScaleNode=T.float(2.1);mat.thicknessPowerNode=T.float(3.5);
    } else if(spec.kind==='sky'||spec.kind==='flame') {
      mat=copyMaterial(source,new THREE.MeshBasicNodeMaterial());
      // ShaderMaterial uniforms are also the public lighting controls.
      mat.uniforms=source.uniforms;
      this[spec.kind](mat,spec);
    } else {
      mat=copyMaterial(source,source.isMeshPhysicalMaterial?new THREE.MeshPhysicalNodeMaterial():new THREE.MeshStandardNodeMaterial());
      this[spec.kind](mat,spec);
    }
    this.materials.set(source,mat);
    return mat;
  }
  prepare(scene){
    for(const {source,node} of this.bindings)node.value=source.value;
    scene.traverse(o=>{if(o.material)o.material=Array.isArray(o.material)?o.material.map(m=>this.convert(m)):this.convert(o.material);});
  }
  reset(){this.materials=new WeakMap();this.bindings.clear();}
  terrain(mat,{surfaces,biome,fallback}){
    const snowy=biome==='snow'||biome==='alpine',mountain=biome==='alpine'||biome==='mountain';
    const base=surfaces?.[mountain?'rock':snowy?'snow':'earth']||{map:fallback};
    const rock=surfaces?.rock||base,dirt=surfaces?.earth||base,powder=surfaces?.snow||base;
    const p=T.positionWorld,n=T.normalWorldGeometry.normalize(),uv=p.xz.mul(.31);
    const macro=noise(p.xz.mul(.045)).mul(.65).add(noise(p.xz.mul(.19)).mul(.35));
    const slope=T.float(1).sub(T.smoothstep(.48,.91,n.y));
    const trail=T.exp(p.x.sub(T.sin(p.z.mul(.09)).mul(4)).div(1.65).pow(2).negate());
    const surface=T.mix(T.texture(base.map,uv).rgb,T.texture(base.map,uv.mul(.381).add(T.vec2(3.37,8.13))).rgb,.26);
    const rocks=triplanar(rock.map,p,n,mountain?.09:.24);
    const alpine=T.smoothstep(macro.mul(24).add(18),macro.mul(27).add(60),p.y).mul(T.float(1).sub(T.smoothstep(.15,.64,slope)));
    let detail=mountain?rocks:T.mix(surface,rocks,slope.mul(.85).add(snowy?0:T.smoothstep(.55,.82,macro).mul(.34)));
    if(mountain&&snowy)detail=T.mix(rocks,triplanar(powder.map,p,n,.18),alpine);
    if(!mountain)detail=T.mix(detail,T.texture(dirt.map,uv.mul(.72)).rgb,trail.mul(snowy?.17:.58).mul(T.float(1).sub(slope)));
    mat.colorNode=detail.mul(macro.mul(.24).add(.85));
    mat.roughnessNode=T.clamp(macro.mul(.15).add(.83).sub(trail.mul(snowy?.03:.09)),.65,1);
    if(base.normalMap){
      let dn=T.texture(base.normalMap,uv).xyz.mul(2).sub(1);
      const close=T.float(1).sub(T.smoothstep(8,34,T.length(T.cameraPosition.sub(p)))).mul(mountain?0:1);
      const micro=T.texture(base.normalMap,uv.mul(3.7)).xyz.mul(2).sub(1);
      dn=dn.add(T.vec3(micro.xy.mul(close.mul(.24)),0)).normalize();
      if(mountain&&snowy&&powder.normalMap)dn=T.mix(dn,T.texture(powder.normalMap,uv).xyz.mul(2).sub(1),alpine);
      const tangent=T.vec3(1,n.x.negate().div(T.max(n.y,.15)),0).normalize(),bitangent=T.cross(tangent,n).normalize();
      mat.normalNode=T.transformNormalToView(tangent.mul(dn.x.mul(.65)).add(bitangent.mul(dn.y.mul(.65))).add(n.mul(T.max(dn.z,.25))).normalize());
    }
  }
  wind(mat,{clock,strength}){
    const time=this.uniform(clock),p=T.positionLocal,origin=T.modelWorldMatrix.mul(T.vec4(p,1)).xyz;
    const tip=T.clamp(T.uv().y,0,1);
    mat.positionNode=p.add(T.vec3(T.sin(time.mul(1.35).add(origin.x.mul(.31)).add(origin.z.mul(.19))).mul(tip.pow(2)).mul(strength),0,
      T.cos(time.mul(.9).add(origin.x.mul(.24))).mul(tip).mul(strength*.4)));
  }
  scan(mat,{clock,snow,tree,foliage,snowMap}){
    const time=this.uniform(clock),p=T.positionWorld;
    if(tree){const local=T.positionLocal,phase=T.attribute('erasTreePhase','float'),bend=T.max(local.y,0).pow(2);
      mat.positionNode=local.add(T.vec3(T.sin(time.mul(.8).add(phase)).mul(bend).mul(.014),0,T.cos(time.mul(.62).add(phase.mul(.73))).mul(bend).mul(.006)));}
    if(snow&&snowMap){
      const base=(mat.map?T.texture(mat.map):T.vec4(1)).mul(T.vec4(T.uniform(mat.color),1));
      const cover=T.smoothstep(tree?.25:.35,tree?.78:.88,T.normalWorldGeometry.y);
      const weather=T.sin(p.x.mul(2.4).add(T.sin(p.z.mul(3)))).mul(.2).add(.8);
      mat.colorNode=T.vec4(T.mix(base.rgb,T.texture(snowMap,p.xz.mul(.27)).rgb,cover.mul(weather).mul(tree?(foliage?.36:.20):.88)),base.a);
    }
  }
  water(mat,{clock}){
    const time=this.uniform(clock),p=T.positionLocal;
    const wave=T.sin(p.x.mul(2.1).add(time.mul(.8))).mul(.018).add(T.sin(p.z.mul(3.2).sub(time.mul(.6))).mul(.009));
    mat.positionNode=p.add(T.vec3(0,wave,0));
    const world=T.positionWorld;
    mat.normalNode=T.transformNormalToView(T.vec3(T.cos(world.x.mul(2.1).add(time.mul(.8))).mul(.065).add(T.sin(world.z.mul(4.7).add(time)).mul(.025)),1,
      T.cos(world.z.mul(3.2).sub(time.mul(.6))).mul(.06)).normalize());
  }
  sky(mat){
    const u=mat.uniforms,time=this.uniform(u.erasTime),zenith=this.uniform(u.zenith),horizon=this.uniform(u.horizon),sunDir=this.uniform(u.sunDir),cloud=this.uniform(u.cloudAmount);
    const d=T.positionLocal.normalize(),h=T.max(d.y,0),sun=T.max(T.dot(d,sunDir),0);
    let color=T.mix(horizon,zenith,h.pow(.45)).add(T.vec3(1,.67,.32).mul(sun.pow(18).mul(.22).add(sun.pow(300).mul(.8)).add(sun.pow(3000).mul(4))));
    if(u.space.value<.5){
      const uv=d.xz.div(d.y.add(.22)).mul(1.9).add(T.vec2(time.mul(.002),0));
      const clouds=T.smoothstep(T.mix(.64,.35,cloud),T.mix(.84,.60,cloud),fbm(uv)).mul(T.smoothstep(.015,.16,d.y)).mul(T.float(1).sub(T.smoothstep(.32,.9,d.y)));
      const shade=T.mix(T.vec3(.52,.59,.62),T.vec3(.94,.89,.77),fbm(uv.add(2)));
      color=T.mix(color,shade,clouds.mul(.68));
    }
    mat.fragmentNode=T.vec4(color,1);
  }
  flame(mat,{clock}){
    const time=this.uniform(clock),uv=T.uv(),y=uv.y;
    const flutter=T.sin(y.mul(15).sub(time.mul(8))).mul(.06).add(T.sin(y.mul(28).add(time.mul(11))).mul(.025));
    const width=y.oneMinus().mul(.43),x=T.abs(uv.x.sub(.5).add(flutter.mul(y)));
    const alpha=T.float(1).sub(T.smoothstep(width.mul(.25),T.max(width,.001),x)).mul(T.smoothstep(0,.12,y)).mul(y.oneMinus());
    const color=T.mix(T.vec3(1,.16,.015),T.vec3(1,.82,.32),T.clamp(T.float(1).sub(x.mul(6)).mul(y.oneMinus()),0,1));
    mat.fragmentNode=T.vec4(color.mul(1.4),alpha.mul(.9));
  }
}

export class GPUFilmPipeline {
  constructor(renderer){
    this.renderer=renderer;this.effects=[];this.profile={};
    this.material={uniforms:{focusDistance:{value:6},aperture:{value:0},warmth:{value:.008},aerialDensity:{value:.0017},aerialColor:{value:new THREE.Color(0xb4c9d0)}}};
    this.focus=T.uniform(6);this.aperture=T.uniform(0);this.warmth=T.uniform(.008);this.density=T.uniform(.0017);this.aerial=T.uniform(this.material.uniforms.aerialColor.value);
    this.sunScreen=T.uniform(new THREE.Vector2(.5,.5));this.sunColor=T.uniform(new THREE.Color());this.scattering=T.uniform(0);
  }
  resize(){}
  setQuality(profile){this.profile=profile;this.reset();}
  reset(){this.post?.dispose();for(const e of this.effects)e.dispose?.();this.effects=[];this.post=null;this.scene=null;}
  build(scene,camera,lens){
    this.reset();this.scene=scene;this.camera=camera;this.lens=lens;
    const scenePass=T.pass(scene,camera,{samples:0}),image=scenePass.getTextureNode(),depth=scenePass.getTextureNode('depth'),viewZ=scenePass.getViewZNode();
    this.effects.push(scenePass);
    const occlusion=ao(depth,null,camera);occlusion.resolutionScale=this.profile.pixelRatio>=2?.75:.5;occlusion.radius.value=.22;occlusion.thickness.value=.12;
    this.effects.push(occlusion);
    let color=image.rgb.mul(T.mix(1,occlusion.getTextureNode().r,.52));
    const glow=bloom(image,.075,.38,1.6);this.effects.push(glow);color=color.add(glow.rgb);
    if(lens){const blurred=dof(T.vec4(color,1),viewZ,this.focus,.7,this.aperture.mul(3.5));this.effects.push(blurred);color=blurred.rgb;}
    const aerial=T.float(1).sub(T.exp(T.max(viewZ.negate().sub(18),0).mul(this.density).negate()));
    color=T.mix(color,this.aerial,aerial.mul(.32));
    let visibility=T.float(0);
    for(let i=1;i<=12;i++){
      const rayUV=T.mix(T.uv(),this.sunScreen,i*.065),inside=T.step(0,rayUV.x).mul(T.step(rayUV.x,1)).mul(T.step(0,rayUV.y)).mul(T.step(rayUV.y,1));
      visibility=visibility.add(T.step(.99999,depth.sample(T.clamp(rayUV,0,1)).r).mul(inside).mul(Math.pow(.94,i)));
    }
    color=color.add(this.sunColor.mul(visibility).mul(this.scattering).mul(.035));
    color=color.mul(T.vec3(T.float(1).add(this.warmth),1,T.float(1).sub(this.warmth)));
    const antialiased=fxaa(T.renderOutput(T.vec4(T.max(color,0),1)));this.effects.push(antialiased);
    this.post=new THREE.PostProcessing(this.renderer,antialiased);this.post.outputColorTransform=false;
  }
  render(scene,camera){
    const u=this.material.uniforms,lens=u.aperture.value>.001;
    if(!this.post||this.scene!==scene||this.camera!==camera||this.lens!==lens)this.build(scene,camera,lens);
    this.focus.value=u.focusDistance.value;this.aperture.value=u.aperture.value;this.warmth.value=u.warmth.value;this.density.value=u.aerialDensity.value;
    this.scattering.value=0;
    if(this.lighting?.strength>0){
      camera.updateMatrixWorld();const facing=camera.getWorldDirection(new THREE.Vector3()).dot(this.lighting.direction);
      if(facing>0){const s=camera.getWorldPosition(new THREE.Vector3()).addScaledVector(this.lighting.direction,camera.far*.8).project(camera);
        this.sunScreen.value.set(s.x*.5+.5,s.y*.5+.5);this.sunColor.value.copy(this.lighting.color);this.scattering.value=this.lighting.strength*Math.min(1,facing*3);}
    }
    this.post.render();
  }
  dispose(){this.reset();}
}

export async function createGPUEngine(canvas){
  const renderer=new THREE.WebGPURenderer({canvas,antialias:true,samples:4,powerPreference:'high-performance',alpha:false});
  try{await renderer.init();}catch(error){renderer.dispose();throw error;}
  const backend=renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2';
  renderer.erasBackend=backend;
  // Existing asset loaders use this narrow compatibility interface.
  renderer.capabilities={getMaxAnisotropy:()=>renderer.getMaxAnisotropy(),isWebGL2:false};
  canvas.dataset.renderer=backend;
  const bridge=new GPUMaterialBridge();
  return {renderer,backend,reason:backend==='WebGPU'?'':'WebGPU no está disponible; se usa compatibilidad WebGL2.',PMREMGenerator:THREE.PMREMGenerator,
    createPipeline:r=>new GPUFilmPipeline(r),prepare:scene=>bridge.prepare(scene),reset:()=>bridge.reset()};
}
