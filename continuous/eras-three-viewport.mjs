/**
 * Atlas ERAS Three.js viewport: browser host injects canvas and THREE.
 * No DOM globals, event listeners or animation loops are created here.
 * Host calls resize/tick and owns input, scheduling and teardown.
 */
export function createErasThreeViewport({THREE,canvas,width=800,height=450,pixelRatio=1}={}){
 if(!THREE||typeof THREE.WebGLRenderer!=='function'||!canvas||
   !Number.isFinite(width)||width<=0||!Number.isFinite(height)||height<=0||
   !Number.isFinite(pixelRatio)||pixelRatio<=0||pixelRatio>2.5)
   throw Error('Invalid viewport parameters');
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(60,width/height,.1,2000);
 camera.position.set(0,2,6);
 const light=new THREE.DirectionalLight(0xffffff,2);
 light.position.set(4,8,5);
 scene.add(light);
 if(typeof THREE.AmbientLight==='function')scene.add(new THREE.AmbientLight(0xffffff,.45));
 if('outputColorSpace' in renderer&&THREE.SRGBColorSpace)renderer.outputColorSpace=THREE.SRGBColorSpace;
 if('toneMapping' in renderer&&THREE.ACESFilmicToneMapping!==undefined)renderer.toneMapping=THREE.ACESFilmicToneMapping;
 let disposed=false;
 const assertOpen=()=>{if(disposed)throw Error('Viewport disposed');};
 function resize(w,h,ratio=pixelRatio){
   assertOpen();
   if(!Number.isFinite(w)||w<=0||!Number.isFinite(h)||h<=0||
     !Number.isFinite(ratio)||ratio<=0||ratio>2.5)throw Error('Invalid viewport size');
   renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);
   camera.aspect=w/h;camera.updateProjectionMatrix();
 }
 resize(width,height,pixelRatio);
 return Object.freeze({
   scene,camera,renderer,
   resize,
   render(){assertOpen();renderer.render(scene,camera);},
   dispose(){if(disposed)return;renderer.dispose();disposed=true;},
 });
}
