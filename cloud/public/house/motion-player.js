import * as THREE from './vendor/three.module.js';

export function decodeMotionLibrary(manifest,buffer){
  if(manifest?.version!==1||!Array.isArray(manifest.bones)||manifest.stride!==manifest.bones.length*4+1||buffer.byteLength!==manifest.bytes)throw Error('Biblioteca de animación inválida.');
  const clips={};
  for(const [name,clip]of Object.entries(manifest.clips)){
    if(!Number.isInteger(clip.frames)||clip.frames<2||!Number.isFinite(clip.duration)||clip.duration<=0)throw Error('Clip inválido: '+name);
    const sex={};for(const gender of ['female','male']){
      const offset=clip.sex[gender]?.offset,length=clip.frames*manifest.stride;
      if(!Number.isInteger(offset)||offset<0||offset%2||offset+length*2>buffer.byteLength)throw Error('Datos de pose fuera de rango.');
      sex[gender]={...clip.sex[gender],data:new Int16Array(buffer,offset,length)};
    }
    clips[name]={...clip,sex};
  }
  return{...manifest,clips};
}
export async function loadMotionLibrary(){
  const manifestResponse=await fetch('/house/assets/motion/manifest.json?v=eras43ea');if(!manifestResponse.ok)throw Error('No se han cargado las animaciones.');
  const manifest=await manifestResponse.json(),response=await fetch('/house/assets/motion/poses.bin?v=eras43ea');if(!response.ok)throw Error('No se han cargado las poses.');
  return decodeMotionLibrary(manifest,await response.arrayBuffer());
}
const clamp=THREE.MathUtils.clamp;
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const q=()=>new THREE.Quaternion();
function pose(count){return{quaternions:Array.from({length:count},q),pelvis:0};}
function mixPose(dest,a,b,t){
  for(let i=0;i<dest.quaternions.length;i++)dest.quaternions[i].slerpQuaternions(a.quaternions[i],b.quaternions[i],t);
  dest.pelvis=THREE.MathUtils.lerp(a.pelvis,b.pelvis,t);return dest;
}
export function sampleMotion(library,sex,name,phase,output=pose(library.bones.length),offset=true){
  const clip=library.clips[name];if(!clip)throw Error('Animación desconocida: '+name);
  const packed=clip.sex[sex],loop=clip.loop&&offset;
  const t=(loop?((phase+packed.phase)%1+1)%1:clamp(phase,0,1))*(clip.frames-1),i=Math.floor(t),j=Math.min(clip.frames-1,i+1),f=t-i;
  const scratch=output.scratch??=q();
  for(let b=0;b<library.bones.length;b++){
    const start=i*library.stride+b*4,end=j*library.stride+b*4;
    const read=(target,k)=>target.set(packed.data[k]/32767,packed.data[k+1]/32767,packed.data[k+2]/32767,packed.data[k+3]/32767).normalize();
    read(output.quaternions[b],start);read(scratch,end);output.quaternions[b].slerp(scratch,f);
  }
  output.pelvis=THREE.MathUtils.lerp(packed.data[i*library.stride+library.stride-1],packed.data[j*library.stride+library.stride-1],f)/32767;
  return output;
}

export function applyAuthoredMotion(a,data,motion,dt,time){
  const library=a.motionLibrary;if(!library||data.inspect){a.hasMotionPose=false;return false;}
  const count=library.bones.length,state=a.motionPlayer??={idle:pose(count),walk:pose(count),jog:pose(count),sprint:pose(count),target:pose(count),action:pose(count),previous:pose(count),initialized:false};
  const reversed=motion.forward<-.3,phase=(a.walk||0)/(Math.PI*2)*(reversed?-1:1),sample=(name,t,out,loop=true)=>sampleMotion(library,a.sex,name,t,out,loop);
  const idleName=data.crouching?'Crouch_Idle_Loop':a.ranged?'Pistol_Idle_Loop':'Idle_Loop';sample(idleName,time/library.clips[idleName].duration,state.idle);
  sample(data.crouching?'Crouch_Fwd_Loop':'Walk_Loop',phase,state.walk);sample(data.crouching?'Crouch_Fwd_Loop':'Jog_Fwd_Loop',phase,state.jog);sample(data.crouching?'Crouch_Fwd_Loop':'Sprint_Loop',phase,state.sprint);
  mixPose(state.target,state.walk,state.jog,clamp(motion.run*2,0,1));
  mixPose(state.target,state.target,state.sprint,clamp((motion.run-.5)*2,0,1));
  mixPose(state.target,state.idle,state.target,motion.move);
  let actionName=null,actionPhase=0,weight=0;
  if(data.dead){actionName='Death01';actionPhase=(a.deathTime||0)/library.clips.Death01.duration;weight=1;}
  else if(data.dodge>0){actionName='Roll';actionPhase=1-data.dodge/(data.dodgeDuration||.34);weight=smooth(actionPhase/.12)*(1-smooth((actionPhase-.85)/.15));}
  else if(data.jump>.025){const rising=(data.velocityY||0)>1;actionName=rising?'Jump_Start':'Jump_Loop';actionPhase=rising?clamp((6.2-data.velocityY)/5,0,1):(time%library.clips.Jump_Loop.duration)/library.clips.Jump_Loop.duration;weight=.95;}
  else if(motion.land>.04){actionName='Jump_Land';actionPhase=1-motion.land;weight=motion.land;}
  else if(data.attack>0){actionName=a.ranged?'Pistol_Shoot':'Sword_Attack';actionPhase=clamp(1-data.attack/(data.attackDuration||.46),0,1);weight=smooth(actionPhase/.1)*(1-smooth((actionPhase-.8)/.2));}
  else if(data.damageFlash>0){actionName='Hit_Chest';actionPhase=1-data.damageFlash/.4;weight=clamp(data.damageFlash/.4,0,1)*.7;}
  else if(data.interacting>0){actionName='Interact';actionPhase=1-data.interacting/.65;weight=Math.sin(actionPhase*Math.PI)*.7;}
  if(actionName){sample(actionName,actionPhase,state.action,false);mixPose(state.target,state.target,state.action,weight);}
  const alpha=!state.initialized||dt===0?1:1-Math.exp(-dt*(data.dead?22:26));
  mixPose(state.previous,state.previous,state.target,alpha);state.initialized=true;
  for(let i=0;i<count;i++){const bone=a.bones[library.bones[i]];if(bone)bone.quaternion.copy(state.previous.quaternions[i]);}
  // Rotate just the lower body to the travel direction when facing a target.
  // Angles beyond 90 degrees use the reversed gait, avoiding crossed knees.
  if(motion.move>.1&&data.jump<.025&&!(data.dodge>0)){
    let direction=Math.atan2((motion.side||0)*(reversed?-1:1),(motion.forward??1)*(reversed?-1:1));direction=clamp(direction,-Math.PI*.44,Math.PI*.44)*motion.move;
    a.root.updateMatrixWorld(true);const yaw=q().setFromAxisAngle(new THREE.Vector3(0,1,0),direction);for(const side of ['L','R']){const bone=a.bones['pelvis.'+side];if(!bone)continue;const world=yaw.clone().multiply(bone.getWorldQuaternion(q()));bone.quaternion.copy(bone.parent.getWorldQuaternion(q()).invert().multiply(world));bone.updateWorldMatrix(false,true);}
  }
  a.motionPelvis=state.previous.pelvis;a.hasMotionPose=true;a.activeMotion=actionName||((motion.move<.2)?'Idle_Loop':motion.run>.65?'Sprint_Loop':motion.run>.2?'Jog_Fwd_Loop':'Walk_Loop');
  return true;
}
