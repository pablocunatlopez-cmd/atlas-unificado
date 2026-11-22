import {createAtlasCanonicalWorldSpec} from './atlas-canonical-world-spec.mjs';
import {planAtlasCanonicalThreeScene} from './atlas-canonical-three-scene-plan.mjs';
import {createAtlasThreeViewport} from './atlas-canonical-three-viewport.mjs';
import {createAtlasCanonicalNavigation} from './atlas-canonical-navigation.mjs';
import {createAtlasCameraTransition,mapAtlasTouchOrbit} from './atlas-canonical-camera-controls.mjs';
/**
 * Opt-in host controller. Does not create a renderer or animation loop.
 * Caller supplies THREE, scene, camera and a trusted input surface.
 */
export function createAtlasCanonicalExperience({THREE,scene,camera,inputSurface}={}){
 if(!camera?.position?.set||typeof camera.lookAt!=='function')
  throw Error('Three.js compatible camera required');
 const spec=createAtlasCanonicalWorldSpec();
 const plan=planAtlasCanonicalThreeScene(spec);
 const viewport=createAtlasThreeViewport({THREE,scene,plan});
 const navigation=createAtlasCanonicalNavigation({spec,plan});
 const transition=createAtlasCameraTransition({navigation});
 let mounted=false,gesture=null;
 const listeners=[];
 const listen=(name,fn)=>{
  inputSurface?.addEventListener?.(name,fn,{passive:true});
  listeners.push([name,fn]);
 };
 function apply(pose){
  camera.position.set(...pose.position);
  camera.lookAt(...pose.lookAt);
 }
 function mount(){
  if(mounted)throw Error('Experience already mounted');
  viewport.mount();
  mounted=true;
  const start=navigation.pose();
  apply({position:start.cameraPosition,lookAt:start.lookAt});
  if(inputSurface){
   if(typeof inputSurface.addEventListener!=='function'||
      typeof inputSurface.removeEventListener!=='function')
    {unmount();throw Error('Invalid input surface');}
   listen('pointerdown',e=>{if(e.isPrimary!==false)
    gesture={x:e.clientX,y:e.clientY};});
   listen('pointermove',e=>{
    if(!gesture||e.isPrimary===false)return;
    const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
    gesture={x:e.clientX,y:e.clientY};
    const width=inputSurface.clientWidth,height=inputSurface.clientHeight;
    const delta=mapAtlasTouchOrbit({dx,dy,viewportWidth:width,viewportHeight:height});
    if(typeof camera.rotateY==='function')camera.rotateY(-delta.yaw);
    if(typeof camera.rotateX==='function')camera.rotateX(-delta.pitch);
   });
   const stop=()=>{gesture=null;};
   listen('pointerup',stop);listen('pointercancel',stop);
  }
  return Object.freeze({mounted:true,objects:viewport.objectCount});
 }
 function navigate(id){if(!mounted)throw Error('Mount before navigating');
  return transition.begin(id);}
 function tick(elapsedMs){if(!mounted)throw Error('Mount before ticking');
  if(transition.active){const pose=transition.frame(elapsedMs);apply(pose);return pose;}
  return Object.freeze({finished:true,idle:true});
 }
 function unmount(){
  for(const [name,fn] of listeners.splice(0))
   inputSurface?.removeEventListener?.(name,fn);
  gesture=null;viewport.unmount();mounted=false;
 }
 return Object.freeze({mount,navigate,tick,unmount,
  get mounted(){return mounted;},
  get current(){return navigation.current;},
  get available(){return navigation.available;},
  get erasPortalAvailable(){return navigation.erasPortalAvailable;},
  hostMustSupplyAnimationLoop:true,erasSceneAttached:false,
  autonomousExecution:false});
}
