'use client';
import {useState,type ChangeEvent} from 'react';
import {BRANCHES,type SpiralState} from '@/lib/evolution/spiral';
import {audioFeatures,imageFeatures} from '@/lib/evolution/signals';
import styles from './atlas-evolution.module.css';
import WorldLearning from './world-learning';
export default function AtlasEvolution({spiral}:{spiral?:SpiralState}){
 const [measurement,setMeasurement]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function inspect(event:ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;setBusy(true);setError('');setMeasurement('');
  try{
   if(file.size>8*1024*1024)throw Error('El archivo supera 8 MB. Selecciona una muestra más corta.');
   if(file.type.startsWith('image/')){
    const bitmap=await createImageBitmap(file);try{const scale=Math.min(1,512/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext('2d');if(!context)throw Error('No se pudo analizar la imagen.');context.drawImage(bitmap,0,0,canvas.width,canvas.height);const result=imageFeatures(context.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);setMeasurement(`Imagen analizada a ${result.width} × ${result.height}. Luminancia ${(result.luminance*100).toFixed(1)} %, contraste ${(result.contrast*100).toFixed(1)} %, energía de bordes ${result.edgeEnergy.toFixed(4)}. Son estadísticas de píxeles; no identifican objetos ni significado.`);}finally{bitmap.close();}
   }else if(file.type.startsWith('audio/')){
    const context=new AudioContext();try{const buffer=await context.decodeAudioData(await file.arrayBuffer());if(buffer.duration>120)throw Error('Selecciona hasta dos minutos de audio.');const result=audioFeatures(buffer.getChannelData(0),buffer.sampleRate);setMeasurement(`Primer canal: ${result.duration.toFixed(2)} s, RMS ${result.rms.toFixed(4)}, pico ${result.peak.toFixed(4)}, DC ${result.mean.toFixed(5)}, ${result.clipped} muestras en el límite. Estas medidas no transcriben ni comprenden el sonido.`);}finally{await context.close();}
   }else throw Error('Selecciona una imagen o un archivo de audio compatible.');
  }catch(e){setError(e instanceof Error?e.message:'No se pudo medir el archivo.');}finally{setBusy(false);}
 }
 return <section className={styles.panel} aria-label="Espiral de capacidades">
  <header><span>ATLAS / ESPIRALES ANIDADAS</span><h2>Una historia que sigue abierta.</h2><p>Gráficos, programación, sonido y percepción avanzan por turnos, cada uno con su propia duda. La investigación continúa con Sites cerrado mediante la tarea vinculada; una cuota o una pausa conserva la pregunta pendiente.</p></header>
  <div className={styles.summary}><strong>{spiral?.turns||0} vueltas enlazadas</strong><span>Geometría: {spiral?.profiles.meshRows||12} filas por esfera</span><span>Exportación de audio: {spiral?.profiles.audioMastering?'DC y picos controlados':'perfil base'}</span></div>
  <div className={styles.branches}>{BRANCHES.map((definition,index)=>{const branch=spiral?.branches.find(b=>b.id===definition.id),trial=branch?.lastTrial;return <article key={definition.id} className={spiral?.cursor===index?styles.active:''}><div><span>ATLAS → {definition.name}</span><small>{branch?.status==='waiting'?'Espera de inferencia':spiral?.cursor===index?'Próxima espiral':'Memoria conservada'}</small></div><h3>{branch?.question||definition.question}</h3><p>{branch?.turns||0} vueltas · profundidad {branch?.depth||1}</p>{trial&&<details><summary>{trial.decision==='promoted'?'Ajuste aprobado':trial.decision==='rejected'?'Candidato rechazado':'Prueba técnica ejecutada'}</summary><p>{trial.metric}: {trial.before.toFixed(5)} → {trial.after.toFixed(5)}</p>{trial.checks.map(c=><p key={c.name}>{c.passed?'✓':'×'} {c.name}</p>)}<p>{trial.scope}</p><code>{trial.version} / {trial.candidate}</code></details>}{branch?.uncertainties.length? <details><summary>Dudas que abren espirales interiores</summary>{branch.uncertainties.map(t=><p key={t}>{t}</p>)}</details>:null}</article>;})}</div>
  <p><a href="/laboratorio">Abrir laboratorio de programas ejecutables →</a></p><WorldLearning world={spiral?.world}/>
  <div className={styles.senses}><h3>Percepción local de señales</h3><p>Selecciona una imagen o una muestra de audio. Atlas mide sus características en este navegador; el archivo no se sube ni se envía a Qwen.</p><label className={styles.file}>{busy?'Analizando…':'Analizar imagen o audio'}<input type="file" accept="image/*,audio/*" onChange={inspect} disabled={busy}/></label>{measurement&&<p role="status">{measurement}</p>}{error&&<p role="alert">{error}</p>}</div>
  <p className={styles.limit}>Una prueba repetida no es progreso nuevo. La evolución conserva perfiles medidos y programas nuevos en un lenguaje numérico acotado. Cada programa necesita pruebas ejecutadas y revisión antes de instalarse. Cambiar código, crear nuevos motores o entrenar pesos requiere otro proceso de desarrollo y evaluación.</p>
 </section>;
}
