import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createResidentBlink,residentBlinkAmount} from '../../public/house/resident-face.js';
import {GLTFLoader} from '../../public/house/vendor/GLTFLoader.js';
import {Vector3} from '../../public/house/vendor/three.module.js';

function vertex(mesh,index){
 return mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld);
}

function frontSamples(mesh,bone,eye,count){
 const {position,skinIndex,skinWeight} = mesh.geometry.attributes;
 const joint = mesh.skeleton.bones.indexOf(bone);
 const origin = eye.getWorldPosition(new Vector3());
 const candidates = [];
 for(let i=0;i<position.count;i++){
  let weight=0;
  for(let channel=0;channel<4;channel++)if(skinIndex.getComponent(i,channel)===joint)weight+=skinWeight.getComponent(i,channel);
  if(weight<=.65)continue;
  const point=vertex(mesh,i).sub(origin);
  if(Math.abs(point.x)<.006&&point.z>.010)candidates.push({index:i,depth:point.z});
 }
 return candidates.sort((a,b)=>b.depth-a.depth).slice(0,count).map(({index})=>index);
}

function centroid(mesh,indices){
 return indices.reduce((sum,index)=>sum.add(vertex(mesh,index)),new Vector3()).divideScalar(indices.length);
}

test('scripted blinks close briefly and run at different resident phases',()=>{
 assert.equal(residentBlinkAmount(0,0),0);
 assert.equal(residentBlinkAmount(.040,0),.5);
 assert.equal(residentBlinkAmount(.090,0),1);
 assert.equal(residentBlinkAmount(.090,.2),0);
 assert.ok(residentBlinkAmount(.150,0)<1&&residentBlinkAmount(.150,0)>0);
 assert.equal(residentBlinkAmount(.23,0),0);
});

test('both authored eyelid rigs narrow their apertures with lashes attached and eye meshes intact',async()=>{
 for(const template of ['female','male']){
  const bytes=await readFile(new URL(`../../public/house/assets/models/avatar/${template}.glb`,import.meta.url));
  const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const bones={};
  scene.traverse(object=>{if(object.userData.anatomyBone)bones[object.userData.anatomyBone]=object;});
  scene.updateMatrixWorld(true);
  const skin=scene.getObjectByName('skin'),lashes=scene.getObjectByName('eyelashes'),eyes=scene.getObjectByName('eyes');
  const blink=createResidentBlink(bones,0);
  for(const side of ['L','R']){
   const eye=bones['eye.'+side],upper=bones['orbicularis03.'+side],lower=bones['orbicularis04.'+side];
   const groups=[[skin,upper,8],[skin,lower,8],[lashes,upper,5],[eyes,eye,8]].map(([mesh,bone,count])=>{
    const indices=frontSamples(mesh,bone,eye,count);
    assert.equal(indices.length,count);
    return [mesh,indices];
   });
   const centers=()=>groups.map(([mesh,indices])=>centroid(mesh,indices));
   const open=centers();
   blink(.09,true);
   scene.updateMatrixWorld(true);
   const closed=centers(),aperture=closed[0].y-closed[1].y;
   assert.ok(aperture>.001&&aperture<.003,`${template} ${side} should retain a narrow eyelid seam`);
   assert.ok(aperture<(open[0].y-open[1].y)*.25,`${template} ${side} should visibly narrow`);
   assert.ok(closed[2].y<open[2].y-.008,`${template} ${side} lashes follow the upper lid`);
   assert.ok(closed[0].z>closed[3].z&&closed[1].z>closed[3].z,`${template} ${side} sampled lid edges remain ahead of the eyeball`);
   assert.ok(closed[3].distanceTo(open[3])<1e-9,`${template} ${side} eye mesh remains still`);
   blink(.09,false);
   scene.updateMatrixWorld(true);
   assert.ok(centers().every((position,index)=>position.distanceTo(open[index])<1e-9),'reduced motion restores the open geometry');
  }
 }
});
