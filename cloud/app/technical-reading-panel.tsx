'use client';
import {useEffect,useRef,useState} from 'react';
import {getTechnicalCatalog,sanitizeTechnicalReading} from '../lib/research/technical-reading.mjs';
import styles from './workspace-tools.module.css';
const catalog=getTechnicalCatalog();
export default function TechnicalReadingPanel(){
 const[reading,setReading]=useState<ReturnType<typeof sanitizeTechnicalReading>>(null),[busy,setBusy]=useState<string|null>(null),[notice,setNotice]=useState('');
 const active=useRef<AbortController|null>(null);
 useEffect(()=>()=>{active.current?.abort();},[]);
 async function read(id:string){
  active.current?.abort();const controller=new AbortController();active.current=controller;setBusy(id);setNotice('Leyendo la referencia oficial…');
  try{const response=await fetch('/api/technical-reading?id='+encodeURIComponent(id),{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('read_failed');const value=sanitizeTechnicalReading(await response.json());if(!value)throw Error('invalid_reading');if(controller.signal.aborted)return;setReading(value);setNotice(value.documents.length?'Fragmento recuperado con procedencia.':'No se pudo recuperar un fragmento en este intento.');}
  catch{if(active.current===controller)setNotice(controller.signal.aborted?'Lectura cancelada.':'La referencia no respondió. Puedes reintentarlo más tarde.');}
  finally{if(active.current===controller){setBusy(null);active.current=null;}}
 }
 return <section className={styles.researchSection} aria-labelledby="atlas-technical-reading-title">
  <div className={styles.eyebrow}>Fuentes técnicas · lectura real</div><h3 id="atlas-technical-reading-title">Del enlace al conocimiento útil</h3>
  <p>Atlas puede consultar fragmentos oficiales sobre agentes, pruebas, geometría 3D, CSV y JSON Patch. El chat elige hasta dos referencias según el tema, sin enviar tu pregunta a esos sitios.</p>
  <div className={styles.row}>{catalog.map(item=><button className={styles.secondary} type="button" key={item.id} disabled={!!busy} onClick={()=>void read(item.id)}>{busy===item.id?'Leyendo…':item.title}</button>)}{busy&&<button type="button" onClick={()=>active.current?.abort()}>Cancelar lectura</button>}</div>
  <p className={styles.small} role="status" aria-live="polite">{notice||'Puedes comprobar una lectura aquí. Los extractos son datos de consulta; no ejecutan código ni entrenan los pesos de Qwen.'}</p>
  {reading?.documents.map(item=><article className={styles.card} key={item.id}><h4><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗</a></h4><p className={styles.small}>Fragmento de {item.excerpt.length} caracteres · {item.cached?'recuperado de la caché de lectura':'leído en este intento'} · {new Date(item.fetchedAt||'').toLocaleString('es-ES',{timeZone:'Europe/Madrid'})} (Madrid).</p><details><summary>Ver fragmento y procedencia</summary><p style={{whiteSpace:'pre-wrap'}}>{item.excerpt}</p><p className={styles.small}>Huella SHA256 del fragmento:</p><code style={{overflowWrap:'anywhere'}}>{item.hash}</code></details><p className={styles.small}>Extracto parcial de una fuente externa, pendiente de contrastar. No acredita haber revisado todo el documento ni haber instalado su herramienta.</p></article>)}
  {!!reading?.errors.length&&<p className={styles.small}>La lectura registra {reading.errors.length} referencia pendiente. Los fallos conservan una espera antes de reintentarse.</p>}
 </section>;
}
