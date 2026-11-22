/**
 * Opt-in synthesized diagnostic sound for Web Audio-capable browsers.
 * Requires a user gesture and explicit host start. No autoplay.
 */
export function createErasAudioTestTone({audioContext,emitterInput,frequency=440}={}){
 if(!audioContext||typeof audioContext.createOscillator!=='function'||
  !emitterInput||typeof emitterInput.connect!=='function'||
  !Number.isFinite(frequency)||frequency<40||frequency>2000)
  throw Error('Invalid ERAS diagnostic audio request');
 let oscillator=null,stopped=false;
 return Object.freeze({
  start(){
   if(stopped||oscillator)throw Error('Test tone already started or stopped');
   oscillator=audioContext.createOscillator();
   oscillator.type='sine';oscillator.frequency.value=frequency;
   oscillator.connect(emitterInput);oscillator.start();
   return Object.freeze({started:true,requiresUserGesture:true});
  },
  stop(){
   if(stopped)return;
   stopped=true;
   if(oscillator){oscillator.stop();oscillator.disconnect();}
  }
 });
}
