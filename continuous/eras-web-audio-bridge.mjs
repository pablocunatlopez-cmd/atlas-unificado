/**
 * Bind ERAS spatial emitters to injected Web Audio API objects.
 * The browser owns user-gesture audio consent, decoding and lifecycle.
 * No microphone or network access occurs here.
 */
export function createErasWebAudioBridge({audioContext,listenerNode}={}){
 if(!audioContext||typeof audioContext.createGain!=='function'||
  typeof audioContext.createPanner!=='function'||!audioContext.destination)
  throw Error('Web Audio context required');
 const nodes=new Map();
 function sync(plan){
  if(!plan||plan.engine!=='web-audio'||!Array.isArray(plan.sounds))
   throw Error('Invalid spatial audio plan');
  const active=new Set();
  for(const sound of plan.sounds){
   if(!sound||typeof sound.id!=='string'||!Array.isArray(sound.position)||
    sound.position.length!==3||sound.position.some(v=>!Number.isFinite(v))||
    !Number.isFinite(sound.effectiveGain)||sound.effectiveGain<0||sound.effectiveGain>1)
    throw Error('Invalid audio emitter');
   if(active.has(sound.id))throw Error('Duplicate audio emitter');
   active.add(sound.id);
   let node=nodes.get(sound.id);
   if(!node){
    const gain=audioContext.createGain(),panner=audioContext.createPanner();
    panner.panningModel='HRTF';panner.distanceModel='inverse';
    panner.connect(gain);gain.connect(audioContext.destination);
    node={gain,panner};nodes.set(sound.id,node);
   }
   node.gain.gain.value=sound.effectiveGain;
   for(const [axis,value] of [['X',sound.position[0]],['Y',sound.position[1]],['Z',sound.position[2]]]){
    const param=node.panner['position'+axis];
    if(param)param.value=value;
    else if(typeof node.panner.setPosition==='function')
     node.panner.setPosition(...sound.position);
   }
  }
  for(const [id,node] of nodes)if(!active.has(id)){
   node.panner.disconnect();node.gain.disconnect();nodes.delete(id);
  }
  if(listenerNode&&Array.isArray(plan.listener)&&plan.listener.length===3&&
   plan.listener.every(Number.isFinite)&&typeof listenerNode.setPosition==='function')
   listenerNode.setPosition(...plan.listener);
  return Object.freeze({activeEmitters:nodes.size,audioPlaying:false});
 }
 function getInput(id){return nodes.get(id)?.panner??null;}
 function dispose(){for(const node of nodes.values()){node.panner.disconnect();node.gain.disconnect();}nodes.clear();}
 return Object.freeze({sync,getInput,dispose});
}
