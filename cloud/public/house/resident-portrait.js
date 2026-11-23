import {Raycaster,Vector2,Vector3} from './vendor/three.module.js';
import {WALLS,blocked,roomAt} from './layout.js';

export const PORTRAIT_WIDTH = 3840;
export const PORTRAIT_HEIGHT = 2160;
const PORTRAIT_FOV=35;

const FACE_SPOTS=[[.74,-.18],[.74,.18],[.82,0],[.64,-.26],[.64,.26],[.94,-.40],[.94,.40]];
const TORSO_SPOTS=[[1.25,.38],[1.25,-.38],[.9,.48],[.9,-.48],[1.4,0],[1.8,.85],[1.8,-.85],[.75,0],[.5,1],[.5,-1]];

export function portraitScreenFov(aspect){
  const minimum=Math.atan(Math.tan(16*Math.PI/180)/Math.max(.2,aspect))*360/Math.PI;
  return Math.max(PORTRAIT_FOV,minimum);
}

export function portraitView(resident, position, {framing='face',obstacles=[]}={}) {
  const [x,y,z] = position;
  const room = roomAt(x,z);
  const front = [Math.sin(resident.yaw), -Math.cos(resident.yaw)];
  const side = [Math.cos(resident.yaw), Math.sin(resident.yaw)];
  const face = y + (resident.seated ? 1.25 : (resident.height || 1.68) - .13);
  const head=[x+front[0]*.15,face,z+front[1]*.15];
  const headPoint=new Vector3(...head),from=new Vector3(),direction=new Vector3(),ray=new Raycaster();
  const spots=framing==='torso'?TORSO_SPOTS:[...FACE_SPOTS,...TORSO_SPOTS];
  for (const [forward, lateral] of spots) {
    const camera = [x + front[0]*forward + side[0]*lateral, face + .035, z + front[1]*forward + side[1]*lateral];
    const target = [head[0],face-(framing==='torso'?.14:.025),head[2]];
    if (!room||roomAt(camera[0],camera[2])!==room) continue;
    let clear=true;
    for(let i=0;i<12;i++){
      const t=i/12;
      if(blocked(camera[0]+(x-camera[0])*t,camera[2]+(z-camera[2])*t,0,WALLS)){clear=false;break;}
    }
    if(!clear)continue;
    if(obstacles.length){
      from.fromArray(camera);
      direction.subVectors(headPoint,from);
      ray.far=Math.max(.08,direction.length()-.04);
      ray.set(from,direction.normalize());
      if(ray.intersectObjects(obstacles,false).length)continue;
    }
    return { camera, target };
  }
  return null;
}

export function capturePortrait4k(renderer, scene, camera, canvas) {
  if (renderer.capabilities.maxTextureSize < 4096) throw Error('El dispositivo no admite la captura 4K.');
  const context = renderer.getContext();
  const viewport = context.getParameter(context.MAX_VIEWPORT_DIMS);
  if (viewport[0] < PORTRAIT_WIDTH || viewport[1] < PORTRAIT_HEIGHT) throw Error('El lienzo no admite una captura 4K.');
  const ratio = renderer.getPixelRatio();
  const {x:width,y:height} = renderer.getSize(new Vector2());
  const {aspect,fov} = camera;
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(PORTRAIT_WIDTH,PORTRAIT_HEIGHT,false);
    if (context.drawingBufferWidth !== PORTRAIT_WIDTH || context.drawingBufferHeight !== PORTRAIT_HEIGHT) throw Error('El dispositivo ha reducido la resolución del lienzo.');
    camera.aspect = PORTRAIT_WIDTH / PORTRAIT_HEIGHT;
    camera.fov = PORTRAIT_FOV;
    camera.updateProjectionMatrix();
    renderer.render(scene,camera);
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>{
      if(blob?.type==='image/png'&&blob.size>0)resolve(blob);
      else reject(Error('No se pudo exportar el PNG 4K.'));
    },'image/png'));
  } finally {
    renderer.setSize(width,height,false);
    renderer.setPixelRatio(ratio);
    camera.aspect = aspect;
    camera.fov = fov;
    camera.updateProjectionMatrix();
    renderer.render(scene,camera);
  }
}
