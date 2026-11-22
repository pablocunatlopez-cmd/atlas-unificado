'use client';

import {useEffect,useRef,useState} from 'react';
import styles from './creation-library.module.css';

export type CloudCreation={id:string;kind:'music'|'video';prompt:string;model:string;content:unknown;at:string};
type Props={kind:CloudCreation['kind'];ready:boolean;signInPath?:string;disabled?:boolean;onOpen:(creation:CloudCreation)=>void};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function readCreations(raw:unknown):CloudCreation[]{
 if(!object(raw)||!Array.isArray(raw.creations))throw Error('La biblioteca no devolvió una lista válida.');
 return raw.creations.slice(0,20).flatMap(value=>{
  if(!object(value)||typeof value.id!=='string'||!value.id||value.id.length>160||!['music','video'].includes(String(value.kind))||typeof value.prompt!=='string'||value.prompt.length>4000||typeof value.model!=='string'||value.model.length>160||typeof value.at!=='string'||!Number.isFinite(Date.parse(value.at))||!object(value.content))return [];
  return [{id:value.id,kind:value.kind as CloudCreation['kind'],prompt:value.prompt,model:value.model,content:value.content,at:new Date(value.at).toISOString()}];
 });
}
function title(creation:CloudCreation){const content=creation.content;return object(content)&&typeof content.title==='string'&&content.title.trim()?content.title.trim().slice(0,120):creation.kind==='music'?'Partitura guardada':'Guion guardado';}

/** Reading the signed-in user's saved artifacts does not start an AI job. */
export default function CreationLibrary({kind,ready,signInPath,disabled=false,onOpen}:Props){
 const[open,setOpen]=useState(false),[loading,setLoading]=useState(false),[loaded,setLoaded]=useState(false),[creations,setCreations]=useState<CloudCreation[]>([]),[error,setError]=useState('');
 const openCreation=useRef(onOpen),linkHandled=useRef<string|null>(null),disabledNow=useRef(disabled);openCreation.current=onOpen;disabledNow.current=disabled;
 const mounted=useRef(true),request=useRef<AbortController|null>(null),scope=useRef({ready,kind});
 useEffect(()=>{mounted.current=true;if(!ready||scope.current.ready!==ready||scope.current.kind!==kind){request.current?.abort();request.current=null;setCreations([]);setLoaded(false);setOpen(false);setError('');setLoading(false);}scope.current={ready,kind};return()=>{mounted.current=false;request.current?.abort();};},[ready,kind]);
 useEffect(()=>{
  if(!ready||disabled)return;
  const params=new URLSearchParams(location.search),id=params.get('creation');
  if(!id||params.get('room')!==(kind==='music'?'music':'cinema')||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return;
  const key=kind+':'+id;if(linkHandled.current===key)return;
  const controller=new AbortController();setOpen(true);setLoading(true);setError('');
  void fetch('/api/create-ai?id='+encodeURIComponent(id)+'&kind='+kind,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])}).then(async response=>{
   const raw:unknown=await response.json();
   if(!response.ok||!object(raw)||!object(raw.creation))throw Error('No se pudo recuperar la creación enlazada.');
   const entries=readCreations({creations:[raw.creation]}),entry=entries.find(e=>e.id===id&&e.kind===kind);
   if(!entry)throw Error('La creación no corresponde a este taller.');
   if(!controller.signal.aborted&&!disabledNow.current&&linkHandled.current!==key){openCreation.current(entry);linkHandled.current=key;setCreations([entry]);setLoaded(true);}
  }).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:'No se pudo recuperar la creación.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[ready,kind,disabled]);
 async function read(){
  if(!ready||request.current)return;
  const controller=new AbortController();request.current=controller;setLoading(true);setError('');
  try{
   const response=await fetch('/api/create-ai?kind='+kind,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
   const raw:unknown=await response.json();
   if(!response.ok)throw Error(response.status===401?'Tu sesión ha terminado. Inicia sesión de nuevo para recuperar tu biblioteca.':object(raw)&&typeof raw.error==='string'?raw.error.slice(0,220):'No se pudo abrir tu biblioteca. Vuelve a intentarlo.');
   const entries=readCreations(raw);if(!mounted.current||controller.signal.aborted||request.current!==controller)return;
   setCreations(entries);setLoaded(true);
  }catch(problem){if(mounted.current&&!controller.signal.aborted&&request.current===controller)setError(problem instanceof Error?problem.message:'No se pudo abrir tu biblioteca.');}
  finally{if(request.current===controller){request.current=null;if(mounted.current)setLoading(false);}}
 }
 function toggle(){const next=!open;setOpen(next);if(next&&!loaded)void read();}
 function select(creation:CloudCreation){
  if(disabled)return;
  try{onOpen(creation);setError('');}catch{setError(kind==='music'?'Esta partitura guardada no pasa la validación. Se conserva tu composición actual.':'Este guion guardado no pasa la validación. Se conserva la dirección actual.');}
 }
 const entries=creations.filter(creation=>creation.kind===kind),label=kind==='music'?'partituras':'guiones';
 return <section className={styles.library} aria-label={`Biblioteca de ${label} en la nube`} aria-busy={loading}>
  <div className={styles.heading}><button type="button" className={styles.trigger} onClick={toggle} aria-expanded={open} disabled={!ready}>Mis {label} en la nube <span aria-hidden="true">{open?'−':'+'}</span></button><small>Recuperar no consume IA</small></div>
  {!ready&&<p className={styles.note}>{signInPath?<a href={signInPath} target="_top">Inicia sesión para recuperar tus creaciones.</a>:'Inicia sesión para recuperar tus creaciones.'}</p>}
  {ready&&open&&<div className={styles.body}>
   <p className={styles.note}>Tus últimas 20 {label} en la nube, también desde otro dispositivo. Abrir una {kind==='music'?'partitura':'dirección'} no inicia reproducción ni grabación.</p>
   <div className={styles.actions}><button type="button" className={styles.refresh} onClick={()=>void read()} disabled={loading}>{loading?'Consultando…':error?'Reintentar':'Actualizar biblioteca'}</button><span role="status" aria-live="polite">{loading?'Recuperando tus creaciones…':loaded?`${entries.length} ${label} recientes · máximo 20`:''}</span></div>
   {error&&<p className={styles.error} role="alert">{error}</p>}
   {loaded&&!entries.length&&!error&&<p className={styles.note}>Todavía no tienes {label} {kind==='music'?'guardadas':'guardados'} en esta cuenta. Aparecerán aquí cuando crees {kind==='music'?'una pieza con IA':'un guion con IA'}.</p>}
   {entries.length>0&&<ul className={styles.entries}>{entries.map(creation=><li key={creation.id}><div><strong>{title(creation)}</strong><time dateTime={creation.at}>{new Date(creation.at).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'})}</time><small>Modelo: {creation.model}</small></div><button type="button" className={styles.load} onClick={()=>select(creation)} disabled={disabled} aria-label={`Abrir ${title(creation)}`}>Abrir</button></li>)}</ul>}
  </div>}
 </section>;
}
