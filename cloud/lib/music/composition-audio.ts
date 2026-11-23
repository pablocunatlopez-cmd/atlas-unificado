import {validateComposition,type Composition,type CompositionSection} from './composition.ts';
import {buildMixer,scheduleHit,type Mixer} from './audio.ts';
import {TRACK_IDS,stepTime} from './pattern.mjs';

export type CompositionSegment={sectionId:string;label:string;startSeconds:number;durationSeconds:number;section:CompositionSection};
export function compositionTimeline(raw:Composition):CompositionSegment[]{
 const composition=validateComposition(raw),sections=new Map(composition.sections.map(s=>[s.id,s]));let elapsed=0;
 return composition.arrangement.map(id=>{const section=sections.get(id)!,durationSeconds=section.bars*4*60/composition.bpm,segment={sectionId:id,label:section.label,startSeconds:elapsed,durationSeconds,section};elapsed+=durationSeconds;return segment;});
}
export function compositionDuration(composition:Composition){const timeline=compositionTimeline(composition),last=timeline.at(-1)!;return last.startSeconds+last.durationSeconds;}

function scoreVoice(mixer:Mixer,note:number,at:number,duration:number,velocity:number,chord=false){
 const context=mixer.context,gain=context.createGain(),filter=context.createBiquadFilter(),osc=context.createOscillator(),overtone=context.createOscillator(),body=context.createGain();
 const peak=velocity*(chord?.09:.22),release=chord?.45:.28,end=at+duration+release;
 gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,peak),at+(chord?.035:.012));gain.gain.exponentialRampToValueAtTime(Math.max(.0001,peak*.5),at+Math.max(.06,duration*.75));gain.gain.exponentialRampToValueAtTime(.0001,end);
 filter.type='lowpass';filter.frequency.setValueAtTime(chord?1600:3800,at);filter.Q.value=.45;gain.connect(filter);filter.connect(mixer.master);
 const hz=440*Math.pow(2,(note-69)/12);osc.type=chord?'sine':'triangle';osc.frequency.value=hz;osc.connect(gain);overtone.type='sine';overtone.frequency.value=hz*2;body.gain.value=chord?.1:.16;overtone.connect(body);body.connect(gain);
 for(const source of [osc,overtone]){mixer.sources.add(source);source.onended=()=>{mixer.sources.delete(source);source.disconnect();if(!mixer.sources.has(osc)&&!mixer.sources.has(overtone)){gain.disconnect();filter.disconnect();body.disconnect();}};source.start(at);source.stop(end+.02);}
}

/** Schedule the model-authored score as actual Web Audio events. */
export function scheduleComposition(mixer:Mixer,raw:Composition,startTime:number){
 const composition=validateComposition(raw);if(!Number.isFinite(startTime)||startTime<mixer.context.currentTime)throw Error('Inicio de composición no válido.');
 const timeline=compositionTimeline(composition),stepSeconds=60/composition.bpm/4;
 for(const segment of timeline){
  const {section}=segment,pattern=section.pattern,base=startTime+segment.startSeconds;
  mixer.master.gain.setValueAtTime(pattern.master,base);
  for(const id of TRACK_IDS)mixer.tracks[id].gain.setValueAtTime(pattern.tracks[id].mute?0:pattern.tracks[id].volume,base);
  for(let index=0;index<section.bars*16;index++){const step=index%16,at=base+stepTime(index,composition.bpm,composition.swing);for(const id of TRACK_IDS)if(pattern.tracks[id].steps[step]&&!pattern.tracks[id].mute)scheduleHit(mixer,id,at,pattern.bassNotes[step]);}
  for(const event of section.melody)scoreVoice(mixer,event.note,base+stepTime(event.step,composition.bpm,composition.swing),event.duration*stepSeconds,event.velocity);
  for(const event of section.chords)for(const note of event.notes)scoreVoice(mixer,note,base+stepTime(event.step,composition.bpm,composition.swing),event.duration*stepSeconds,event.velocity,true);
 }
 return{endTime:startTime+compositionDuration(composition)+1,timeline};
}
export async function renderComposition(composition:Composition,sampleRate=44100){
 if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>48000)throw Error('Frecuencia de exportación no válida.');
 const seconds=compositionDuration(composition),Offline=(window as unknown as {OfflineAudioContext?:typeof OfflineAudioContext;webkitOfflineAudioContext?:typeof OfflineAudioContext}).OfflineAudioContext||(window as unknown as {webkitOfflineAudioContext?:typeof OfflineAudioContext}).webkitOfflineAudioContext;
 if(!Offline)throw Error('Este navegador no admite exportación de audio. Guarda la composición JSON para abrirla en otro navegador.');
 const context=new Offline(2,Math.ceil((seconds+2)*sampleRate),sampleRate),mixer=buildMixer(context,composition.sections[0].pattern);scheduleComposition(mixer,composition,.02);return context.startRendering();
}
