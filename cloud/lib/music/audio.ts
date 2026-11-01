import {TRACK_IDS,patternDuration,stepTime,type Pattern,type TrackId} from './pattern.mjs';

export type Mixer={context:BaseAudioContext;master:GainNode;limiter:DynamicsCompressorNode;tracks:Record<TrackId,GainNode>;sources:Set<AudioScheduledSourceNode>};
const noiseBuffers=new WeakMap<BaseAudioContext,AudioBuffer>();
const frequency=(note:number)=>440*Math.pow(2,(note-69)/12);

export function buildMixer(context:BaseAudioContext,pattern:Pattern):Mixer{
 const master=context.createGain(),limiter=context.createDynamicsCompressor();
 limiter.threshold.value=-16;limiter.knee.value=16;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.16;
 master.gain.value=pattern.master;master.connect(limiter);limiter.connect(context.destination);
 const tracks={} as Record<TrackId,GainNode>;
 for(const id of TRACK_IDS){const gain=context.createGain();gain.gain.value=pattern.tracks[id].mute?0:pattern.tracks[id].volume;if(typeof context.createStereoPanner==='function'){const pan=context.createStereoPanner();pan.pan.value=id==='hat'?.25:id==='snare'?-.08:0;gain.connect(pan);pan.connect(master);}else gain.connect(master);tracks[id]=gain;}
 return {context,master,limiter,tracks,sources:new Set()};
}
export function updateMixer(mixer:Mixer,pattern:Pattern){
 const at=mixer.context.currentTime;mixer.master.gain.setTargetAtTime(pattern.master,at,.012);
 for(const id of TRACK_IDS)mixer.tracks[id].gain.setTargetAtTime(pattern.tracks[id].mute?0:pattern.tracks[id].volume,at,.012);
}
function noise(context:BaseAudioContext){
 let buffer=noiseBuffers.get(context);if(buffer)return buffer;
 buffer=context.createBuffer(1,context.sampleRate,context.sampleRate);const data=buffer.getChannelData(0);let state=0x1234abcd;
 for(let i=0;i<data.length;i++){state^=state<<13;state^=state>>>17;state^=state<<5;data[i]=(state>>>0)/2147483648-1;}
 noiseBuffers.set(context,buffer);return buffer;
}
function register(mixer:Mixer,source:AudioScheduledSourceNode,nodes:AudioNode[]){
 mixer.sources.add(source);source.onended=()=>{mixer.sources.delete(source);source.disconnect();for(const node of nodes)node.disconnect();};
}
function envelope(context:BaseAudioContext,destination:AudioNode,at:number,peak:number,attack:number,duration:number){
 const gain=context.createGain();gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,peak),at+attack);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);gain.connect(destination);return gain;
}
export function scheduleHit(mixer:Mixer,id:TrackId,at:number,note=48){
 const context=mixer.context,destination=mixer.tracks[id];
 if(id==='kick'){
  const osc=context.createOscillator(),gain=envelope(context,destination,at,.87,.003,.36);osc.type='sine';osc.frequency.setValueAtTime(145,at);osc.frequency.exponentialRampToValueAtTime(44,at+.15);osc.connect(gain);register(mixer,osc,[gain]);osc.start(at);osc.stop(at+.38);
 }else if(id==='snare'||id==='hat'){
  const source=context.createBufferSource(),filter=context.createBiquadFilter(),duration=id==='snare'?.18:.055;
  source.buffer=noise(context);filter.type='highpass';filter.frequency.value=id==='snare'?1300:7200;filter.Q.value=.55;
  const gain=envelope(context,destination,at,id==='snare'?.42:.22,.002,duration);source.connect(filter);filter.connect(gain);register(mixer,source,[filter,gain]);source.start(at);source.stop(at+duration+.02);
  if(id==='snare'){const osc=context.createOscillator(),body=envelope(context,destination,at,.16,.002,.10);osc.type='triangle';osc.frequency.value=185;osc.connect(body);register(mixer,osc,[body]);osc.start(at);osc.stop(at+.12);}
 }else{
  const osc=context.createOscillator(),filter=context.createBiquadFilter(),gain=envelope(context,destination,at,.34,.012,.25);
  osc.type='sawtooth';osc.frequency.value=frequency(note);filter.type='lowpass';filter.frequency.setValueAtTime(1700,at);filter.frequency.exponentialRampToValueAtTime(320,at+.20);filter.Q.value=.7;osc.connect(filter);filter.connect(gain);register(mixer,osc,[filter,gain]);osc.start(at);osc.stop(at+.28);
 }
}
export function playPiano(mixer:Mixer,note:number){
 const context=mixer.context,at=context.currentTime+.008;
 for(const [partial,level] of [[1,.25],[2,.065],[3,.018]]){const osc=context.createOscillator(),gain=envelope(context,mixer.master,at,level,.008,.92);osc.type='sine';osc.frequency.value=frequency(note)*partial;osc.connect(gain);register(mixer,osc,[gain]);osc.start(at);osc.stop(at+.98);}
}
export function stopSources(mixer:Mixer){for(const source of mixer.sources){try{source.stop();}catch{}}mixer.sources.clear();}
export async function renderPattern(pattern:Pattern,bars=4,sampleRate=44100){
 const duration=patternDuration(pattern,bars),tail=1;
 const Offline=(window as unknown as {OfflineAudioContext?:typeof OfflineAudioContext;webkitOfflineAudioContext?:typeof OfflineAudioContext}).OfflineAudioContext||(window as unknown as {webkitOfflineAudioContext?:typeof OfflineAudioContext}).webkitOfflineAudioContext;
 if(!Offline)throw Error('Este navegador no puede exportar WAV. Puedes guardar el proyecto JSON y abrirlo en Safari o Chrome actualizado.');
 const context=new Offline(2,Math.ceil((duration+tail)*sampleRate),sampleRate),mixer=buildMixer(context,pattern);
 for(let index=0;index<bars*16;index++){const step=index%16,at=.01+stepTime(index,pattern.bpm,pattern.swing);for(const id of TRACK_IDS)if(pattern.tracks[id].steps[step]&&!pattern.tracks[id].mute)scheduleHit(mixer,id,at,pattern.bassNotes[step]);}
 return context.startRendering();
}
