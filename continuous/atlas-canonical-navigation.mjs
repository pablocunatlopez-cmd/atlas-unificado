/**
 * Deterministic camera-navigation controller for Atlas' canonical scene.
 * No DOM, rendering, timers, physics, network or code execution.
 * A host renderer can animate between returned camera poses.
 */
export function createAtlasCanonicalNavigation({spec,plan}={}){
 if(!spec||!plan||!Array.isArray(plan.anchors)||
    !Array.isArray(spec.navigation?.paths))throw Error('Navigation requires world and scene plan');
 const anchors=new Map(plan.anchors.map(a=>[a.id,a]));
 if(anchors.size!==plan.anchors.length||
    !anchors.has('observer')||!anchors.has('spiral')||!anchors.has('eras-house'))
  throw Error('Missing canonical anchors');
 const paths=spec.navigation.paths;
 if(paths.some(p=>!Array.isArray(p)||p.length<2||
    p[0]!=='observer'||p[1]!=='spiral'||p.some(id=>!anchors.has(id))))
  throw Error('Invalid canonical navigation paths');
 const allowed=new Set(paths.flatMap(p=>p));
 const links=new Map([...allowed].map(id=>[id,new Set()]));
 for(const path of paths)for(let i=1;i<path.length;i++){
  links.get(path[i-1]).add(path[i]);links.get(path[i]).add(path[i-1]);
 }
 let current='observer';
 const history=[];
 function pose(id){
  const a=anchors.get(id);
  const [x,y,z]=a.position;
  return Object.freeze({target:id,lookAt:Object.freeze([x,y,z]),
   cameraPosition:Object.freeze([x+5,y+4,z+9]),
   transition:'host_renderer_opt_in'});
 }
 function go(id){
  if(typeof id!=='string'||!allowed.has(id)||
     (id!==current&&!links.get(current).has(id)))
   throw Error('Invalid navigation transition');
  if(id!==current){history.push(current);current=id;}
  return pose(current);
 }
 function back(){
  if(!history.length)return pose(current);
  const target=history.pop();
  if(!links.get(current).has(target))throw Error('Navigation history corrupted');
  current=target;
  return pose(current);
 }
 return Object.freeze({get current(){return current;},
  get available(){return Object.freeze([...links.get(current)]);},
  get historyDepth(){return history.length;},
  pose:()=>pose(current),go,back,
  get erasPortalAvailable(){return current==='eras-house';},
  codeExecuted:false,rendererInvoked:false,authorizationGranted:false});
}
