/**
 * Opt-in camera transition planner. Pure state machine: the host's animation
 * frame loop supplies progress and applies the returned pose to Three.js.
 */
export function createAtlasCameraTransition({navigation,durationMs=650}={}){
 if(!navigation||typeof navigation.go!=='function'||typeof navigation.pose!=='function'||
    !Number.isFinite(durationMs)||durationMs<100||durationMs>5000)
  throw Error('Invalid camera transition dependencies');
 let from=navigation.pose(),to=from,active=false;
 const lerp=(a,b,t)=>a+(b-a)*t;
 function begin(id){
  if(active)throw Error('Transition already active');
  from=navigation.pose();
  to=navigation.go(id);
  active=from.target!==to.target;
  return Object.freeze({active,from:from.target,to:to.target,durationMs});
 }
 function frame(elapsedMs){
  if(!Number.isFinite(elapsedMs)||elapsedMs<0)throw Error('Invalid elapsed time');
  const u=active?Math.min(1,elapsedMs/durationMs):1;
  const eased=u*u*(3-2*u);
  const position=from.cameraPosition.map((v,i)=>lerp(v,to.cameraPosition[i],eased));
  const lookAt=from.lookAt.map((v,i)=>lerp(v,to.lookAt[i],eased));
  if(u===1)active=false;
  return Object.freeze({position:Object.freeze(position),lookAt:Object.freeze(lookAt),
   progress:u,finished:!active});
 }
 return Object.freeze({begin,frame,get active(){return active;},
  rendererInvoked:false,codeExecuted:false});
}
/** Map normalized pointer swipe to a camera-orbit delta; never touch the DOM. */
export function mapAtlasTouchOrbit({dx,dy,viewportWidth,viewportHeight}={}){
 if([dx,dy,viewportWidth,viewportHeight].some(v=>!Number.isFinite(v))||
    viewportWidth<=0||viewportHeight<=0||
    viewportWidth>10000||viewportHeight>10000)
  throw Error('Invalid touch viewport');
 const clamp=x=>Math.max(-1,Math.min(1,x));
 return Object.freeze({yaw:clamp(dx/viewportWidth)*Math.PI,
  pitch:clamp(dy/viewportHeight)*Math.PI/3,
  mode:'host_applied_orbit_delta'});
}
