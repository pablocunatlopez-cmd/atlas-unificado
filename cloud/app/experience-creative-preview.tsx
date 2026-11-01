'use client';

import {useEffect,useRef,useState} from 'react';
import {validateCreativePlan} from '../lib/creative/plan.mjs';
import styles from './experience-creative-preview.module.css';

type CreativePlan={version:1;title:string;variant:'gallery'|'product'|'architecture'|'forest'|'neon';lighting:'day'|'sunset'|'night';palette:'Titanio'|'Oro'|'Azul'|'Rojo'|'Verde'|'Rosa'|'Blanco'|'Negro';objects:{type:'box'|'sphere';position:[number,number,number];size:[number,number,number];material:number;yaw:number}[];design:''};
export type PublicCreativePreview={artifactId:string;at:string|null;cases:6;passed:6;executed:true;invariantsPreserved:true;renderVerified:false;plan:CreativePlan};
const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};

/** Rebuild data only. Original HTML, private titles, descriptions and paths
 * cannot become an iframe document through this public contract.
 */
export function readCreativePreview(input:unknown):PublicCreativePreview|null{
 const value=object(input);
 if(value.executed!==true||value.invariantsPreserved!==true||value.cases!==6||value.passed!==6||typeof value.artifactId!=='string'||!/^creative-[a-f0-9]{24}$/.test(value.artifactId))return null;
 const raw=object(value.plan);
 try{
  const plan=validateCreativePlan({version:1,title:'Experimento 3D de Atlas',variant:raw.variant,lighting:raw.lighting,palette:raw.palette,objects:raw.objects,design:''},'3d') as CreativePlan;
  // The shared compiler supports colour-list normalisation; this public
  // surface requires the closed single-colour transport contract instead.
  if(!Array.isArray(raw.objects)||typeof raw.palette!=='string'||raw.palette!==plan.palette)return null;
  const at=typeof value.at==='string'&&value.at.length<=35&&Number.isFinite(Date.parse(value.at))?new Date(value.at).toISOString():null;
  return {artifactId:value.artifactId,at,cases:6,passed:6,executed:true,invariantsPreserved:true,renderVerified:false,plan};
 }catch{return null;}
}

export default function ExperienceCreativePreview({value,connected}:{value:PublicCreativePreview;connected:boolean}){
 const [document,setDocument]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const generation=useRef(0);
 function close(){generation.current++;setDocument('');setLoading(false);setError('');}
 useEffect(()=>{generation.current++;setDocument('');setLoading(false);setError('');return()=>{generation.current++;};},[value.artifactId]);
 useEffect(()=>{
  if(!document)return;
  function visibility(){if(window.document.visibilityState==='hidden')close();}
  window.document.addEventListener('visibilitychange',visibility);
  return()=>window.document.removeEventListener('visibilitychange',visibility);
 },[document]);
 async function open(){
  const ticket=++generation.current;setLoading(true);setError('');
  try{
   const {generateProject}=await import('../lib/studio/generator');
   if(ticket!==generation.current)return;
   if(window.document.visibilityState==='hidden'){close();return;}
   const preview=generateProject('Experimento de Atlas','3d',{plan:value.plan}).code;
   if(ticket===generation.current)setDocument(preview);
  }catch{if(ticket===generation.current)setError('No se pudo reconstruir este plan en el navegador.');}
  finally{if(ticket===generation.current)setLoading(false);}
 }
 return <section className={styles.panel} aria-labelledby="creative-plan-heading">
  <div className={styles.heading}><div><p>ION / EXPERIMENTO VISUAL</p><h2 id="creative-plan-heading">Una idea que toma forma.</h2></div><span className={styles.check}>✓ 6/6 contratos geométricos</span></div>
  <p className={styles.intro}>Vista reconstruida del plan del último experimento. No es una reproducción comprobada del archivo HTML del laboratorio.</p>
  <div className={styles.metadata}><span>{connected?'Plan comunicado por el PC':'Último plan recibido · PC sin verificar'}</span>{value.at&&<time dateTime={value.at}>{new Date(value.at).toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</time>}</div>
  {document?<div className={styles.viewer}><div className={styles.viewerHeader}><span>RECONSTRUCCIÓN DEL PLAN · 3D</span><button type="button" onClick={close}>Cerrar vista <span aria-hidden="true">×</span></button></div><iframe key={value.artifactId} title="Reconstrucción del plan 3D de Atlas" srcDoc={document} sandbox="allow-scripts" referrerPolicy="no-referrer"/><p>Arrastra para explorar. Cerrar esta vista detiene el render; también se cierra al ocultar la pestaña.</p></div>:<div className={styles.openRow}><button type="button" onClick={()=>void open()} disabled={loading}>{loading?'Preparando la vista…':'Ver plan en 3D'}<svg viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden="true"><path d="m10 2 7 4v8l-7 4-7-4V6l7-4Zm0 0v8m7-4-7 4-7-4m7 4v8" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/></svg></button><span>El render se inicia solo cuando lo abres.</span></div>}
  {error&&<p className={styles.error} role="status">{error}</p>}
  <div className={styles.review}><span>Valoración visual pendiente</span><p>El modelo no ha observado una imagen de este resultado. Crear la escena no acredita una mejora ni jugabilidad.</p></div>
 </section>;
}
