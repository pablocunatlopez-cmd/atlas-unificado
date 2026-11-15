import * as THREE from './vendor/three.module.js';

// Keep the compatibility renderer independent: unsupported devices do not download
// the WebGPU build or accidentally display a WebGPU badge for a WebGL context.
export async function createRenderEngine(canvas, {gpu=globalThis.navigator?.gpu, loadGPU=()=>import('./gpu-renderer.js?v=rig12'), createWebGL=options=>new THREE.WebGLRenderer(options)}={}) {
  let reason='Este navegador no ofrece WebGPU.';
  if(gpu){
    try {
      const module=await loadGPU();
      return await module.createGPUEngine(canvas);
    } catch(error) {
      reason='WebGPU no pudo iniciarse en este dispositivo.';
      console.warn(reason,error);
    }
  }
  const renderer=createWebGL({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
  renderer.erasBackend='WebGL2';
  canvas.dataset.renderer='WebGL2';
  return {renderer,backend:'WebGL2',reason};
}
