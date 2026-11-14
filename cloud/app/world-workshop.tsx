'use client';
import {useEffect,useRef,useState} from 'react';
import AtlasStudio from './atlas-studio';
import styles from './workspace-tools.module.css';
type Props={mode:'3d'|'game';ready:boolean};
type Work={id:string;status:string;progress?:number;stage?:string;error?:string;result?:{answer:string;creative?:{projectId:string}}};
const stages:Record<string,string>={architect:'Qwen está diseñando el entorno',critic:'El revisor está buscando problemas',repair:'Corrigiendo la geometría',revision:'Revisando el plan',queued:'Esperando turno de generación',completed:'Proyecto guardado'};
export default function WorldWorkshop({mode,ready}:Props){
 const[prompt,setPrompt]=useState(mode==='game'?'Un videojuego 3D de exploración en un bosque, con luces para recoger y una misión que se pueda ganar':'Una casa minimalista blanca con un laboratorio, vegetación y luz de atardecer');
 const[job,setJob]=useState<Work|null>(null),[projectId,setProjectId]=useState<string>(),[busy,setBusy]=useState(false),[error,setError]=useState('');const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  if(!job||['completed','failed','cancelled'].includes(job.status))return;let cancelled=false,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{try{const response=await fetch('/api/cloud/jobs/'+job.id,{cache:'no-store'}),value=await response.json() as Work;if(!response.ok)throw Error(value.error||'No se pudo consultar el trabajo.');if(cancelled)return;setJob(value);if(value.status==='completed'){setProjectId(value.result?.creative?.projectId);setBusy(false);if(!value.result?.creative?.projectId)setError('El modelo respondió, pero no devolvió un proyecto 3D validado.');}else if(['failed','cancelled'].includes(value.status)){setBusy(false);if(value.error)setError(value.error);}else timer=setTimeout(poll,1800);}catch(problem){if(!cancelled){setError(problem instanceof Error?problem.message:'No hay conexión.');timer=setTimeout(poll,5000);}}};
  timer=setTimeout(poll,800);return()=>{cancelled=true;clearTimeout(timer);};
 },[job?.id,job?.status]);
 async function create(){
  if(!ready||busy||!prompt.trim())return;setBusy(true);setError('');setProjectId(undefined);
  try{const response=await fetch('/api/cloud/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:prompt,kind:mode==='game'?'game':'world',requestId:crypto.randomUUID()})});const value=await response.json() as {jobId:string;status:string;error?:string};if(!response.ok)throw Error(value.error||'No se pudo crear el trabajo.');if(alive.current)setJob({id:value.jobId,status:value.status});}
  catch(problem){if(alive.current){setBusy(false);setError(problem instanceof Error?problem.message:'No se pudo conectar.');}}
 }
 async function cancel(){if(!job)return;const response=await fetch('/api/cloud/jobs/'+job.id,{method:'DELETE'});if(response.ok){setJob(await response.json());setBusy(false);}}
 return <section className={styles.panel}><div className={styles.eyebrow}>{mode==='game'?'Taller de mundos':'Laboratorio creativo'}</div><h2>{mode==='game'?'De una idea a un mundo jugable.':'Describe un lugar. Empieza a construirlo.'}</h2><p>Un arquitecto Qwen propone el diseño, una segunda pasada lo critica y un validador comprueba sus límites antes de generar geometría ejecutable.</p>
 {!ready&&<p className={styles.card}><a className={styles.button} href="/signin-with-chatgpt?return_to=%2F" target="_top">Iniciar sesión para guardar mis proyectos</a></p>}
 <label htmlFor="world-prompt">Tu {mode==='game'?'videojuego':'entorno 3D'}</label><textarea id="world-prompt" aria-label="Descripción del entorno" maxLength={4000} value={prompt} onChange={event=>setPrompt(event.target.value)} disabled={busy}/>
 <div className={styles.row}><button onClick={()=>void create()} disabled={!ready||busy||!prompt.trim()}>{busy?'Creando…':mode==='game'?'Crear videojuego 3D':'Generar entorno 3D'}</button>{busy&&<button className={styles.secondary} onClick={()=>void cancel()}>Detener</button>}<span className={styles.small}>Geometría procedural · archivo HTML y glTF</span></div>
 {job&&<p className={styles.status}>{stages[job.stage||'']||({queued:'En cola en Atlas',running:'Arquitecto y revisor trabajando',completed:'Entorno creado y guardado',cancelled:'Trabajo detenido',failed:'El trabajo no terminó'}[job.status]||job.status)}</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}
 <details><summary>Cómo se construye y qué límites tiene</summary><p>El plan controla iluminación, materiales y objetos dentro de escenas soportadas. El motor convierte el plan validado en un proyecto descargable. Los dos roles usan el mismo modelo; la crítica es una opinión, no una prueba independiente. El primer motor admite formas básicas y prototipos, con un máximo de 40 objetos.</p></details>
 <div className={styles.studioPane}><AtlasStudio request={null} ready={ready} initialProjectId={projectId}/></div></section>;
}
