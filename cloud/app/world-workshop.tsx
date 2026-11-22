'use client';
import {useEffect,useRef,useState} from 'react';
import AtlasStudio from './atlas-studio';
import styles from './workspace-tools.module.css';
import {createCloudStudioProject,CloudStudioProjectError,type CloudStudioJob} from '../lib/studio/cloud-project-client';
import {housePrototypeHref} from '../public/house/house-quest.js';
type Props={mode:'3d'|'game';ready:boolean};
export default function WorldWorkshop({mode,ready}:Props){
 const[prompt,setPrompt]=useState(mode==='game'?'Un videojuego 3D de exploración en un bosque, con luces para recoger y una misión que se pueda ganar':'Una casa minimalista blanca con un laboratorio, vegetación y luz de atardecer');
 const[job,setJob]=useState<CloudStudioJob|null>(null),[projectId,setProjectId]=useState<string>(),[busy,setBusy]=useState(false),[cancelling,setCancelling]=useState(false),[error,setError]=useState('');
 const alive=useRef(true),controller=useRef<AbortController|null>(null),operation=useRef(0),retry=useRef<{key:string;requestId:string}|null>(null),inFlight=useRef(false),cancellingNow=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;operation.current++;controller.current?.abort();};},[]);
 async function create(){
  if(!ready||inFlight.current||!prompt.trim())return;
  inFlight.current=true;const scope=++operation.current,key=mode+'\0'+prompt.trim();if(retry.current?.key!==key)retry.current={key,requestId:crypto.randomUUID()};
  const abort=new AbortController();controller.current=abort;const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(105000)]);setBusy(true);setJob(null);setError('');
  try{const project=await createCloudStudioProject({prompt:prompt.trim(),mode,requestId:retry.current.requestId},{signal,onJob:value=>{if(alive.current&&scope===operation.current)setJob(value);}});if(alive.current&&scope===operation.current){setProjectId(project.id);retry.current=null;setJob(value=>value?{...value,status:'completed'}:null);}}
  catch(problem){if(alive.current&&scope===operation.current&&!abort.signal.aborted){
   if(problem instanceof CloudStudioProjectError&&['failed','cancelled','input'].includes(problem.code))retry.current=null;
   setError(signal.aborted?'Se agotó la espera. Reintenta la misma descripción para recuperar el encargo sin duplicarlo.':problem instanceof Error?problem.message:'No se pudo completar el encargo.');
  }}
  finally{if(scope===operation.current){inFlight.current=false;controller.current=null;if(alive.current)setBusy(false);}}
 }
 async function cancel(){
  if(!job?.id||cancellingNow.current)return;
  cancellingNow.current=true;const id=job.id,scope=++operation.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;inFlight.current=true;setBusy(true);setCancelling(true);setError('');
  try{
   const response=await fetch('/api/cloud/jobs/'+encodeURIComponent(id),{method:'DELETE',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])}),value=await response.json() as {status?:string;error?:string};
   if(!response.ok)throw Error(value.error||'No se pudo detener el encargo.');
   if(!value||!['queued','running','completed','failed','cancelled'].includes(value.status||''))throw Error('No se pudo confirmar el estado del encargo.');
   if(alive.current&&scope===operation.current){setJob({id,status:value.status!});if(['cancelled','failed'].includes(value.status!))retry.current=null;else setError(value.status==='completed'?'El encargo ya había terminado. Pulsa crear con la misma descripción para recuperar su proyecto sin generar otro.':'El encargo sigue activo. Reintenta para consultar su estado sin duplicarlo.');}
  }catch(problem){if(alive.current&&scope===operation.current&&!abort.signal.aborted)setError((problem instanceof Error?problem.message:'No se pudo confirmar la cancelación.')+' El encargo puede continuar; reintenta la misma descripción para consultar su estado.');}
  finally{cancellingNow.current=false;if(scope===operation.current){controller.current=null;inFlight.current=false;if(alive.current){setBusy(false);setCancelling(false);}}}
 }

 return <section className={styles.panel}><div className={styles.eyebrow}>{mode==='game'?'Taller de mundos':'Laboratorio creativo'}</div><h2>{mode==='game'?'De una idea a un mundo jugable.':'Describe un lugar. Empieza a construirlo.'}</h2><p>Un modelo disponible diseña la composición y los materiales desde tu descripción. El compilador valida el plan y genera geometría 3D editable; no se trata de un modelo neuronal de mallas orgánicas.</p>
 {!ready&&<p className={styles.card}><a className={styles.button} href="/signin-with-chatgpt?return_to=%2F" target="_top">Iniciar sesión para guardar mis proyectos</a></p>}
 <label htmlFor="world-prompt">Tu {mode==='game'?'videojuego':'entorno 3D'}</label><textarea id="world-prompt" aria-label="Descripción del entorno" maxLength={4000} value={prompt} onChange={event=>setPrompt(event.target.value)} disabled={busy}/>
 <div className={styles.row}><button onClick={()=>void create()} disabled={!ready||busy||!prompt.trim()}>{busy?(cancelling?'Deteniendo…':'Creando…'):mode==='game'?'Crear videojuego 3D':'Generar entorno 3D'}</button>{busy&&job&&<button className={styles.secondary} disabled={cancelling} onClick={()=>void cancel()}>{cancelling?'Deteniendo…':'Detener'}</button>}<span className={styles.small}>Geometría procedural · archivo HTML y glTF</span></div>
 {mode==='game'&&<p><a className={styles.button} href={housePrototypeHref(prompt)} target="_blank" rel="noopener noreferrer">Jugar un prototipo con la casa de Lía ↗</a><small> Misma arquitectura, personajes, colisiones y misión de cuatro etapas. Sin consulta de IA adicional.</small></p>}
 {job&&<p className={styles.status}>{{queued:'Esperando turno de generación',running:'Diseño y compilación en curso',completed:'Proyecto guardado',cancelled:'Trabajo detenido',failed:'El trabajo no terminó'}[job.status]||job.status}</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}
 <details><summary>Cómo se construye y qué límites tiene</summary><p>El modelo diseña una composición propia con hasta 32 objetos, materiales, agrupaciones y cámara. El compilador admite cajas, esferas, cilindros y conos y valida los datos antes de construir el archivo. En videojuegos mantiene los controles y objetivos del prototipo. La validación comprueba estructura y límites; la calidad visual necesita revisarse en la vista 3D. No equivale a un generador neuronal de personajes o mallas orgánicas.</p></details>
 <div className={styles.studioPane}><AtlasStudio request={null} ready={ready} initialProjectId={projectId}/></div></section>;
}
