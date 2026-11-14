'use client';
import {validateLivingState,livingPattern} from '../public/house/living-contract.js';

import {useCallback,useEffect,useRef,useState,type ChangeEvent} from 'react';
import {TRACK_IDS,PRESETS,createPattern,clonePattern,validatePattern,varyPattern,patternDuration,type Pattern,type TrackId} from '@/lib/music/pattern.mjs';
import {transposePattern,canTranspose,transpositionRange} from '@/lib/music/transposition.mjs';
import {encodeWav} from '@/lib/music/wav.mjs';
import {masterChannels,audioFeatures} from '@/lib/evolution/signals';
import {buildMixer,updateMixer,scheduleHit,playPiano,stopSources,renderPattern,type Mixer} from '@/lib/music/audio';
import styles from './music-studio.module.css';

type Props={onClose?:()=>void};
type LiveMixer=Mixer&{context:AudioContext};
const STORAGE_KEY='atlas-music-project-v1';
type HouseComposition={id:string;title:string;author:string;at:string;pattern:Pattern;fingerprint:string};
function houseComposition(raw:unknown):HouseComposition|null{
 if(!raw||typeof raw!=='object'||!('artifacts' in raw)||!raw.artifacts||typeof raw.artifacts!=='object')return null;
 const candidates=Object.values(raw.artifacts).filter((a):a is Record<string,unknown>=>!!a&&typeof a==='object'&&!Array.isArray(a)&&'kind' in a&&a.kind==='music').sort((a,b)=>Date.parse(String(b.at))-Date.parse(String(a.at)));
 for(const a of candidates){try{if(typeof a.id!=='string'||a.id.length>160||typeof a.at!=='string'||!Number.isFinite(Date.parse(a.at)))continue;const pattern=validatePattern(a.value);return{id:a.id,title:'Patrón para el entorno de Lía',author:typeof a.actorName==='string'?a.actorName.slice(0,120):'Equipo de música',at:a.at,pattern,fingerprint:JSON.stringify(pattern)};}catch{}}
 return null;
}
const trackLabels:Record<TrackId,{name:string;detail:string;symbol:string}>={kick:{name:'Bombo',detail:'Cuerpo y pulso',symbol:'◉'},snare:{name:'Caja',detail:'Acento',symbol:'⌁'},hat:{name:'Hi-hat',detail:'Movimiento',symbol:'✳'},bass:{name:'Bajo',detail:'Notas MIDI editables',symbol:'∿'}};
const noteNames=['Do','Do♯','Re','Mi♭','Mi','Fa','Fa♯','Sol','La♭','La','Si♭','Si'];
const notes=Array.from({length:37},(_,index)=>{const midi=36+index;return {midi,name:`${noteNames[midi%12]} ${Math.floor(midi/12)-1}`};});
const piano=[{midi:48,name:'Do',octave:3},{midi:50,name:'Re',octave:3},{midi:51,name:'Mi♭',octave:3},{midi:53,name:'Fa',octave:3},{midi:55,name:'Sol',octave:3},{midi:58,name:'Si♭',octave:3},{midi:60,name:'Do',octave:4},{midi:62,name:'Re',octave:4}];

function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}

export default function MusicStudio({onClose}:Props={}){
 const [composition,setComposition]=useState<{title:string;author:string;pattern:Pattern}|null>(null);
 useEffect(()=>{let active=true;const read=async()=>{try{const r=await fetch('/api/living',{cache:'no-store'});if(!r.ok)return;const a=validateLivingState(await r.json()).artifacts.music;if(active&&a)setComposition({title:a.proposal.title,author:a.actorName,pattern:validatePattern(livingPattern(a.proposal))});}catch{}};void read();const timer=setInterval(read,15000);return()=>{active=false;clearInterval(timer);};},[]);
 const [houseMusic,setHouseMusic]=useState<HouseComposition|null>(null),houseMusicFingerprint=useRef('');
 useEffect(()=>{let active=true,busy=false;const controller=new AbortController();const read=async()=>{if(document.hidden||busy)return;busy=true;try{const response=await fetch('/api/house-work',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});if(!response.ok)return;const candidate=houseComposition(await response.json());if(active&&candidate&&candidate.fingerprint!==houseMusicFingerprint.current){houseMusicFingerprint.current=candidate.fingerprint;setHouseMusic(candidate);}}catch{}finally{busy=false;}};void read();const timer=setInterval(()=>void read(),15000),visibility=()=>{if(!document.hidden)void read();};document.addEventListener('visibilitychange',visibility);return()=>{active=false;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visibility);};},[]);
 const [mastering,setMastering]=useState(false),[semitones,setSemitones]=useState(2);
 useEffect(()=>{let active=true;fetch('/api/autonomy',{cache:'no-store'}).then(r=>r.ok?r.json() as Promise<{control?:{spiral?:{profiles?:{audioMastering?:boolean}}}}>:null).then(p=>{if(active)setMastering(p?.control?.spiral?.profiles?.audioMastering===true);}).catch(()=>{});return()=>{active=false;};},[]);
 const[pattern,setPattern]=useState<Pattern>(()=>createPattern()),[tempoText,setTempoText]=useState('108'),[playing,setPlaying]=useState(false),[step,setStep]=useState(-1),[preset,setPreset]=useState('orbit'),[hydrated,setHydrated]=useState(false),[selectedStep,setSelectedStep]=useState(0),[canUndo,setCanUndo]=useState(false),[exporting,setExporting]=useState(false),[bars,setBars]=useState(4),[status,setStatus]=useState('Toca reproducir o una tecla para activar el audio.'),[error,setError]=useState(''),[pressedNote,setPressedNote]=useState<number|null>(null);
 const patternRef=useRef(pattern),graph=useRef<LiveMixer|null>(null),playingRef=useRef(false),scheduler=useRef<number|null>(null),animation=useRef<number|null>(null),timeline=useRef<{step:number;at:number}[]>([]),nextStep=useRef(0),nextTime=useRef(0),undo=useRef<Pattern[]>([]),mounted=useRef(true),fileInput=useRef<HTMLInputElement>(null),starting=useRef(false);
 patternRef.current=pattern;

 const halt=useCallback((announce=true)=>{
  playingRef.current=false;if(scheduler.current!==null)window.clearInterval(scheduler.current);if(animation.current!==null)window.cancelAnimationFrame(animation.current);scheduler.current=null;animation.current=null;timeline.current=[];
  if(graph.current)stopSources(graph.current);
  if(mounted.current){setPlaying(false);setStep(-1);if(announce)setStatus('Reproducción detenida. Tu patrón sigue guardado en este dispositivo.');}
 },[]);
 useEffect(()=>{
  mounted.current=true;
  try{const saved=localStorage.getItem(STORAGE_KEY);if(saved){const restored=validatePattern(JSON.parse(saved));patternRef.current=restored;setPattern(restored);setPreset('custom');setStatus('Proyecto restaurado desde este dispositivo.');}}catch{setStatus('No se pudo restaurar el proyecto anterior. Los presets siguen disponibles.');}
  setHydrated(true);
  const visibility=()=>{if(document.hidden){halt(false);void graph.current?.context.suspend().catch(()=>{});}};
  document.addEventListener('visibilitychange',visibility);
  return()=>{mounted.current=false;halt(false);document.removeEventListener('visibilitychange',visibility);const current=graph.current;graph.current=null;if(current){stopSources(current);void current.context.close().catch(()=>{});}};
 },[halt]);
 useEffect(()=>{if(!hydrated)return;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(pattern));}catch{setStatus('El navegador no permite guardar el proyecto. Puedes descargar el archivo JSON.');}if(graph.current)updateMixer(graph.current,pattern);},[pattern,hydrated]);
 useEffect(()=>setTempoText(String(pattern.bpm)),[pattern.bpm]);

 const apply=useCallback((next:Pattern,message?:string,remember=true)=>{
  const checked=validatePattern(next);if(remember){undo.current=[...undo.current.slice(-19),clonePattern(patternRef.current)];setCanUndo(true);}patternRef.current=checked;setPattern(checked);setError('');if(message)setStatus(message);
 },[]);
 const edit=useCallback((mutate:(value:Pattern)=>void)=>{const next=clonePattern(patternRef.current);mutate(next);apply(next);setPreset('custom');},[apply]);
 const ensureAudio=useCallback(async()=>{
  if(!graph.current){const Audio=(window as unknown as {AudioContext?:typeof AudioContext;webkitAudioContext?:typeof AudioContext}).AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!Audio)throw Error('Este navegador no ofrece Web Audio. Prueba con Safari o Chrome actualizado.');const context=new Audio({latencyHint:'interactive'});graph.current=buildMixer(context,patternRef.current) as LiveMixer;}
  const current=graph.current;await current.context.resume();if(!mounted.current)throw Error('El estudio se ha cerrado.');updateMixer(current,patternRef.current);return current;
 },[]);
 const start=useCallback(async()=>{
  if(playingRef.current){halt();return;}if(starting.current)return;starting.current=true;setError('');
  try{
   const current=await ensureAudio();nextStep.current=0;nextTime.current=current.context.currentTime+.06;timeline.current=[];playingRef.current=true;setPlaying(true);setStatus('Sonando en este dispositivo. Edita los pasos para cambiar el siguiente compás.');
   const schedule=()=>{
    if(!playingRef.current||!graph.current)return;const engine=graph.current,now=engine.context.currentTime;
    if(nextTime.current<now-.2){nextTime.current=now+.04;timeline.current=[];}
    while(nextTime.current<now+.11){const value=patternRef.current,index=nextStep.current%16,at=nextTime.current;for(const id of TRACK_IDS)if(value.tracks[id].steps[index]&&!value.tracks[id].mute)scheduleHit(engine,id,at,value.bassNotes[index]);timeline.current.push({step:index,at});const duration=60/value.bpm/4;nextTime.current+=duration*(index%2?1-value.swing:1+value.swing);nextStep.current++;}
   };
   const draw=()=>{if(!playingRef.current||!graph.current)return;const now=graph.current.context.currentTime;let visible:number|undefined;while(timeline.current.length&&timeline.current[0].at<=now)visible=timeline.current.shift()!.step;if(visible!==undefined)setStep(visible);animation.current=window.requestAnimationFrame(draw);};
   schedule();scheduler.current=window.setInterval(schedule,25);animation.current=window.requestAnimationFrame(draw);
  }catch(problem){halt(false);if(mounted.current)setError(problem instanceof Error?problem.message:'No se pudo activar el audio. Toca reproducir de nuevo.');}
  finally{starting.current=false;}
 },[ensureAudio,halt]);
 const strike=useCallback(async(midi:number)=>{setError('');try{const current=await ensureAudio();playPiano(current,midi);setPressedNote(midi);setTimeout(()=>{if(mounted.current)setPressedNote(value=>value===midi?null:value);},160);}catch(problem){if(mounted.current)setError(problem instanceof Error?problem.message:'No se pudo activar el instrumento.');}},[ensureAudio]);
 const saveProject=()=>download(new Blob([JSON.stringify(patternRef.current,null,2)+'\n'],{type:'application/json'}),'atlas-musica.json');
 const importProject=async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  try{if(file.size>65536)throw Error('El proyecto debe ocupar menos de 64 KB.');const value=validatePattern(JSON.parse(await file.text()));if(!mounted.current)return;halt(false);apply(value,'Proyecto importado. Sus controles y notas se validaron antes de cargarlo.');setPreset('custom');}
  catch(problem){setError(problem instanceof Error?problem.message:'El archivo no tiene el formato musical de Atlas.');}
 };
 const exportWav=async()=>{
  if(exporting)return;setExporting(true);setError('');setStatus('Renderizando las cuatro pistas como audio WAV…');
  try{const value=clonePattern(patternRef.current),audio=await renderPattern(value,bars);if(!mounted.current)return;const raw=Array.from({length:audio.numberOfChannels},(_,i)=>audio.getChannelData(i)),channels=mastering?masterChannels(raw).channels:raw,features=audioFeatures(channels[0],audio.sampleRate);download(new Blob([encodeWav(channels,audio.sampleRate)],{type:'audio/wav'}),`atlas-${value.bpm}bpm-${bars}compases.wav`);setStatus(`WAV exportado: ${bars} compases. Pico ${features.peak.toFixed(3)}; ${features.clipped} muestras en el límite. ${mastering?'Perfil aprobado: DC eliminado y margen de pico 0,94.':'Perfil base.'} Audio procesado en este dispositivo.`);}
  catch(problem){if(mounted.current)setError(problem instanceof Error?problem.message:'No se pudo renderizar el WAV. Prueba con menos compases.');}
  finally{if(mounted.current)setExporting(false);}
 };
 const transpose=()=>{try{apply(transposePattern(patternRef.current,semitones),`Melodía transpuesta ${semitones>0?'+':''}${semitones} semitonos. Ritmo y mezcla conservados. Puedes deshacerla.`);setPreset('custom');}catch(problem){setError(problem instanceof Error?problem.message:'No se pudo transponer la melodía.');}};
 const shiftAllowed=canTranspose(pattern,semitones),shiftRange=transpositionRange(pattern);
 const activeNotes=TRACK_IDS.reduce((total,id)=>total+pattern.tracks[id].steps.filter(Boolean).length,0);

 return <section className={styles.studio} aria-label="Estudio de música de Atlas">
  {houseMusic&&<div className={styles.panelHeading}><div><strong>{houseMusic.title}</strong><p>{houseMusic.author} · <time dateTime={houseMusic.at}>{new Date(houseMusic.at).toLocaleString('es-ES')}</time></p><p>Patrón validado del trabajo de la casa. Tu sesión sigue intacta hasta que elijas cargarlo.</p></div><button type="button" disabled={exporting} onClick={()=>{halt(false);apply(houseMusic.pattern,'Patrón de '+houseMusic.author+' cargado. Tu sesión anterior está en Deshacer.');setPreset('custom');}}>Cargar propuesta musical</button></div>}
  {composition&&<div className={styles.panelHeading}><div><strong>{composition.title}</strong><p>Compuesta por {composition.author} en la nube. Puedes editarla, escucharla y exportarla.</p></div><button type="button" onClick={()=>{halt(false);apply(composition.pattern,'Composición de '+composition.author+' cargada. Puedes deshacerla.');setPreset('custom');}}>Cargar obra del habitante</button></div>}
  <header className={styles.header}><div><div className={styles.eyebrow}><span>♫</span> ATLAS / ESTUDIO DE MÚSICA</div><h1>Encuentra tu pulso.</h1><p>Un pequeño estudio que suena de verdad. Dale forma a una idea, paso a paso.</p></div>{onClose&&<button className={styles.close} type="button" onClick={()=>{halt(false);onClose();}} aria-label="Volver a la casa">← <span>Volver a la casa</span></button>}</header>
  <div className={styles.transport}>
   <button type="button" className={`${styles.play} ${playing?styles.playing:''}`} onClick={()=>void start()} aria-label={playing?'Detener patrón':'Reproducir patrón'}><span aria-hidden="true">{playing?'■':'▶'}</span><strong>{playing?'Detener':'Reproducir'}</strong></button>
   <div className={styles.tempo}><label htmlFor="atlas-music-bpm">TEMPO</label><div><input id="atlas-music-bpm" type="number" min="60" max="180" step="1" value={tempoText} onChange={event=>{setTempoText(event.target.value);const value=Number(event.target.value);if(event.target.value&&Number.isFinite(value)&&value>=60&&value<=180)edit(next=>next.bpm=Math.round(value));}} onBlur={()=>{const value=Number(tempoText);if(tempoText&&Number.isFinite(value)){const bounded=Math.max(60,Math.min(180,Math.round(value)));setTempoText(String(bounded));if(bounded!==patternRef.current.bpm)edit(next=>next.bpm=bounded);}else setTempoText(String(patternRef.current.bpm));}}/><span>BPM</span></div></div>
   <div className={styles.meter} aria-label={playing?`Paso ${step+1} de 16`:'Secuenciador detenido'}>{Array.from({length:16},(_,index)=><i className={index===step?styles.meterActive:''} key={index}/>)}</div>
   <div className={styles.transportMeta}><strong>{preset==='custom'?'Tu sesión':PRESETS.find(item=>item.id===preset)?.name}</strong><span>{activeNotes} golpes · 4 pistas · 4/4</span></div>
   <button className={styles.undo} type="button" disabled={!canUndo} onClick={()=>{const previous=undo.current.pop();if(previous){apply(previous,'Último cambio deshecho.',false);setCanUndo(undo.current.length>0);setPreset('custom');}}} aria-label="Deshacer último cambio">↶ <span>Deshacer</span></button>
  </div>
  <div className={styles.workspace}>
   <div className={styles.sequencePanel}>
    <div className={styles.panelHeading}><div><span className={styles.kicker}>01 / CONSTRUYE EL RITMO</span><h2>Tu mesa de pasos</h2></div><button type="button" className={styles.vary} onClick={()=>{apply(varyPattern(patternRef.current,Math.floor(Math.random()*0xffffffff)),'Nueva variación del patrón. Puedes deshacerla.');setPreset('custom');}}>✳ Variar patrón</button></div>
    <div className={styles.sequenceViewport} role="region" aria-label="Secuenciador de 16 pasos; desplaza horizontalmente para ver todos" tabIndex={0}><div className={styles.sequence}>
     <div className={styles.sequenceNumbers}><span>PISTA</span>{Array.from({length:16},(_,index)=><span className={index===step?styles.currentNumber:''} key={index}>{index+1}</span>)}</div>
     {TRACK_IDS.map(id=><div className={styles.track} key={id} data-track={id}><div className={styles.trackName}><span>{trackLabels[id].symbol}</span><div><strong>{trackLabels[id].name}</strong><small>{id==='bass'?`Paso ${selectedStep+1} seleccionado`:trackLabels[id].detail}</small></div></div>{pattern.tracks[id].steps.map((active,index)=><button type="button" key={index} className={`${styles.step} ${active?styles.active:''} ${step===index?styles.current:''} ${id==='bass'&&selectedStep===index?styles.selected:''} ${index%4===0?styles.beat:''}`} aria-label={`${trackLabels[id].name}, paso ${index+1}${id==='bass'?`, nota ${notes.find(item=>item.midi===pattern.bassNotes[index])?.name||pattern.bassNotes[index]}`:''}`} aria-pressed={active} onClick={()=>{if(id==='bass')setSelectedStep(index);edit(next=>next.tracks[id].steps[index]=!next.tracks[id].steps[index]);}}><span/>{id==='bass'&&active&&<small>{notes.find(item=>item.midi===pattern.bassNotes[index])?.name.replace(/ [0-9]/,'')||'♪'}</small>}</button>)}</div>)}
    </div></div>
    <div className={styles.sequenceFoot}><p><span>●</span> Toca un paso para encenderlo o apagarlo. En móvil, desliza la mesa para ver los 16.</p><label>Nota del bajo · paso {selectedStep+1}<select value={pattern.bassNotes[selectedStep]} onChange={event=>edit(next=>next.bassNotes[selectedStep]=Number(event.target.value))}>{notes.map(note=><option key={note.midi} value={note.midi}>{note.name}</option>)}</select></label></div>
    <div className={styles.sequenceFoot}><label htmlFor="atlas-music-transpose">Transponer todo el bajo<select id="atlas-music-transpose" value={semitones} onChange={event=>setSemitones(Number(event.target.value))} aria-describedby="atlas-music-transpose-help">{Array.from({length:25},(_,index)=>index-12).map(shift=><option key={shift} value={shift}>{shift>0?'+':''}{shift} {Math.abs(shift)===1?'semitono':'semitonos'}</option>)}</select></label><button type="button" className={styles.vary} disabled={semitones===0||!shiftAllowed} onClick={transpose}>Transponer melodía</button><p id="atlas-music-transpose-help">{shiftAllowed?'Conserva los intervalos, el ritmo y la mezcla. Puedes deshacer el cambio.':`Ese cambio supera el rango de notas del estudio. Esta melodía admite de ${shiftRange.min} a +${shiftRange.max} semitonos.`}</p></div>
   </div>
   <aside className={styles.mixerPanel} aria-label="Mezclador de pistas"><div className={styles.panelHeading}><div><span className={styles.kicker}>02 / EQUILIBRA</span><h2>Mezcla</h2></div><span className={styles.limiter}>LIMITADOR ACTIVO</span></div><div className={styles.mixerTracks}>{TRACK_IDS.map(id=><div className={styles.mixerTrack} key={id} data-track={id}><div><strong>{trackLabels[id].name}</strong><button type="button" aria-label={`${pattern.tracks[id].mute?'Activar':'Silenciar'} ${trackLabels[id].name}`} aria-pressed={pattern.tracks[id].mute} className={pattern.tracks[id].mute?styles.muted:''} onClick={()=>edit(next=>next.tracks[id].mute=!next.tracks[id].mute)}>{pattern.tracks[id].mute?'OFF':'ON'}</button></div><label><span className={styles.srOnly}>Volumen de {trackLabels[id].name}</span><input type="range" min="0" max="100" value={Math.round(pattern.tracks[id].volume*100)} onChange={event=>edit(next=>next.tracks[id].volume=Number(event.target.value)/100)}/><output>{Math.round(pattern.tracks[id].volume*100)}</output></label></div>)}</div><div className={styles.master}><label htmlFor="atlas-music-master"><strong>Volumen general</strong><span>{Math.round(pattern.master/.8*100)} %</span></label><input id="atlas-music-master" type="range" min="0" max="80" value={Math.round(pattern.master*100)} onChange={event=>edit(next=>next.master=Number(event.target.value)/100)}/></div><label className={styles.swing} htmlFor="atlas-music-swing"><span>Movimiento <b>{Math.round(pattern.swing*100)} %</b></span><input id="atlas-music-swing" type="range" min="0" max="35" value={Math.round(pattern.swing*100)} onChange={event=>edit(next=>next.swing=Number(event.target.value)/100)}/><small>Swing: retrasa los pasos alternos para darles aire.</small></label></aside>
  </div>
  <div className={styles.lower}>
   <section className={styles.instrument}><div className={styles.panelHeading}><div><span className={styles.kicker}>03 / PRUEBA UNA MELODÍA</span><h2>Teclas de luz</h2></div><span className={styles.instrumentTag}>PIANO SINTETIZADO</span></div><div className={styles.keys}>{piano.map(note=><button type="button" key={note.midi} className={`${note.name.includes('♭')?styles.blackKey:''} ${pressedNote===note.midi?styles.pressed:''}`} aria-label={`Tocar ${note.name} ${note.octave}`} onPointerDown={event=>{event.preventDefault();void strike(note.midi);}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();void strike(note.midi);}}}><span>{note.name}</span><small>{note.octave}</small></button>)}</div><p>Toca para escuchar. La melodía en vivo no se añade al patrón ni a la exportación WAV.</p></section>
   <section className={styles.presets}><div className={styles.panelHeading}><div><span className={styles.kicker}>PUNTOS DE PARTIDA</span><h2>Una atmósfera</h2></div></div><div>{PRESETS.map((item,index)=><button className={preset===item.id?styles.chosenPreset:''} type="button" key={item.id} onClick={()=>{apply(createPattern(item.id),`${item.name} cargado. Es un patrón editable, generado por reglas.`);setPreset(item.id);}}><span>0{index+1}</span><div><strong>{item.name}</strong><small>{item.description}</small></div><b>{preset===item.id?'✓':'↗'}</b></button>)}</div></section>
  </div>
  <footer className={styles.footer}>
   <div className={styles.saveInfo}><span className={styles.localDot}/><div><strong>{hydrated?'Guardado local en este dispositivo':'Restaurando proyecto…'}</strong><p>Síntesis y patrones por reglas. No usa un modelo musical ni envía tu audio a la nube.</p></div></div>
   <div className={styles.exports}><input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={event=>void importProject(event)}/><button type="button" onClick={()=>fileInput.current?.click()}>Abrir proyecto</button><button type="button" onClick={saveProject}>Guardar JSON</button><label><span className={styles.srOnly}>Compases a exportar</span><select value={bars} disabled={exporting} onChange={event=>setBars(Number(event.target.value))}><option value={2}>2 compases</option><option value={4}>4 compases</option><option value={8}>8 compases</option></select></label><button className={styles.exportWav} type="button" onClick={()=>void exportWav()} disabled={exporting}>{exporting?'Renderizando…':'↓ Exportar WAV'}<small>{Math.round(patternDuration(pattern,bars))} s + cola</small></button></div>
  </footer>
  <p className={`${styles.status} ${error?styles.error:''}`} role="status" aria-live="polite">{error||status}</p>
 </section>;
}
