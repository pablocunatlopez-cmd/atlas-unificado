import {Vector2} from './vendor/three.module.js';
import {WALLS,blocked,roomAt} from './layout.js';

export const PORTRAIT_WIDTH = 3840;
export const PORTRAIT_HEIGHT = 2160;

export function portraitView(resident, position) {
  const [x,y,z] = position;
  const room = roomAt(x,z);
  const front = [Math.sin(resident.yaw), -Math.cos(resident.yaw)];
  const side = [Math.cos(resident.yaw), Math.sin(resident.yaw)];
  const face = y + (resident.seated ? 1.25 : (resident.height || 1.68) - .13);
  for (const [forward, lateral] of [[1.25,.38],[1.25,-.38],[.9,.48],[.9,-.48],[1.4,0],[1.8,.85],[1.8,-.85],[.75,0],[.5,1],[.5,-1]]) {
    const camera = [x + front[0]*forward + side[0]*lateral, face + .035, z + front[1]*forward + side[1]*lateral];
    const target = [x,face-.14,z];
    if (!room||roomAt(camera[0],camera[2])!==room) continue;
    let clear=true;
    for(let i=0;i<12;i++){
      const t=i/12;
      if(blocked(camera[0]+(x-camera[0])*t,camera[2]+(z-camera[2])*t,0,WALLS)){clear=false;break;}
    }
    if (clear) return { camera, target };
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
  const aspect = camera.aspect;
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(PORTRAIT_WIDTH,PORTRAIT_HEIGHT,false);
    if (context.drawingBufferWidth !== PORTRAIT_WIDTH || context.drawingBufferHeight !== PORTRAIT_HEIGHT) throw Error('El dispositivo ha reducido la resolución del lienzo.');
    camera.aspect = PORTRAIT_WIDTH / PORTRAIT_HEIGHT;
    camera.updateProjectionMatrix();
    renderer.render(scene,camera);
    const png = canvas.toDataURL('image/png');
    if (!png.startsWith('data:image/png;base64,')) throw Error('No se pudo exportar el PNG 4K.');
    return png;
  } finally {
    renderer.setSize(width,height,false);
    renderer.setPixelRatio(ratio);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.render(scene,camera);
  }
}
