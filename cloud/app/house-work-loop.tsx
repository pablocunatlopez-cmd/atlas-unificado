'use client';

import {useEffect,useRef,useState} from 'react';
import {residentById} from '../public/house/residents.js';
import {missionFor} from '@/lib/collaboration/missions';
import styles from './house-work-loop.module.css';

type WorkStatus='applied'|'tested'|'unchanged'|'waiting'|'rejected';
export type HouseWorkEvent={id:string;workerId:string;messengerId:'language-symbol';recipientIds:string[];status:WorkStatus;at:string;startedAt:string;sourceCount:number;artifactCount:number;modelSteps:number;operation:'research'|'tool'|'program'|'engineering'};
export type HouseWorkVisual={schema:1;events:HouseWorkEvent[]};
export type HouseWorkUpdate={at:string;visual:HouseWorkVisual};
type Work={id:string;requestId?:string;actorId?:string;residentId?:string;actorName:string;title:string;summary:string;status:WorkStatus;at:string;evidence?:{status:string;reportedImprovement:boolean;testCount:number}};
type Payload={at:string;enabled:boolean;busy:boolean;nextStepAt:string|null;counts:{runs:number;applied:number;unchanged:number;waiting:number};recent:Work[];visual:HouseWorkVisual;budget?:{backgroundAvailable:boolean;used:number;automaticLimit:number}};
type Props={signedIn:boolean;onVisual?:(value:HouseWorkUpdate)=>void;onVisit?:(residentId:string)=>void};
const INTERVAL=10000,MAX_COUNT=1e9;
const statuses:Record<WorkStatus,string>={applied:'Artefacto disponible',tested:'Prueba comunicada',unchanged:'Sin cambio nuevo',waiting:'Esperando recursos',rejected:'Propuesta descartada'};
const isObject=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max=500)=>typeof v==='string'?v.slice(0,max):'';
const count=(v:unknown,max=MAX_COUNT):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
const stamp=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
const resident=(v:unknown)=>typeof v==='string'&&residentById(v)?v:undefined;
const status=(v:unknown):v is WorkStatus=>typeof v==='string'&&Object.hasOwn(statuses,v);

function readVisual(value:unknown):HouseWorkVisual{
 if(!isObject(value)||value.schema!==1||!Array.isArray(value.events))return{schema:1,events:[]};
 const events:HouseWorkEvent[]=[];
 for(const raw of value.events.slice(-16)){
  if(!isObject(raw)||!/^work-[a-z0-9-]{1,80}$/i.test(String(raw.id))||!status(raw.status)||raw.messengerId!=='language-symbol')continue;
  const workerId=resident(raw.workerId),at=stamp(raw.at),startedAt=stamp(raw.startedAt);
  if(!workerId||!at||!startedAt||Date.parse(at)<Date.parse(startedAt)||!Array.isArray(raw.recipientIds)||raw.recipientIds.length>2||raw.recipientIds.some(id=>!resident(id)))continue;
  if(!count(raw.sourceCount,2)||!count(raw.artifactCount,4)||!count(raw.modelSteps,2)||!['research','tool','program','engineering'].includes(String(raw.operation)))continue;
  events.push({id:String(raw.id),workerId,messengerId:'language-symbol',recipientIds:[...new Set(raw.recipientIds as string[])],status:raw.status,at,startedAt,sourceCount:raw.sourceCount,artifactCount:raw.artifactCount,modelSteps:raw.modelSteps,operation:raw.operation as HouseWorkEvent['operation']});
 }
 return{schema:1,events};
}

function readPayload(raw:unknown):Payload{
 if(!isObject(raw)||!stamp(raw.at)||typeof raw.enabled!=='boolean'||typeof raw.busy!=='boolean'||!isObject(raw.counts))throw Error('No se pudo interpretar el trabajo de la casa.');
 const c=raw.counts;if(![c.runs,c.applied,c.unchanged,c.waiting].every(v=>count(v)))throw Error('Los contadores de trabajo no son válidos.');
 const recent:Work[]=[];
 for(const v of Array.isArray(raw.recent)?raw.recent.slice(0,8):[]){
  if(!isObject(v)||typeof v.id!=='string'||!status(v.status))continue;
  const at=stamp(v.at)||stamp(v.completedAt),id=resident(v.workerId)||resident(v.residentId),actorId=typeof v.actorId==='string'&&missionFor(v.actorId)?v.actorId:undefined;
  if(!at)continue;
  const actorName=text(v.actorName,100)||actorId&&missionFor(actorId)?.name||id&&residentById(id)?.name||'Un especialista';
  const evidenceRaw=isObject(v.evidence)?v.evidence:null,evidenceReview=evidenceRaw&&isObject(evidenceRaw.review)?evidenceRaw.review:evidenceRaw,evidence=evidenceReview&&['consistent_report','inconsistent','invalid','incomplete','stale','absent'].includes(String(evidenceReview.status))?{status:String(evidenceReview.status),reportedImprovement:evidenceRaw?.reportedImprovement===true,testCount:evidenceRaw&&isObject(evidenceRaw.report)&&Array.isArray(evidenceRaw.report.tests)?Math.min(32,evidenceRaw.report.tests.length):count(evidenceReview.testCount,32)?evidenceReview.testCount:0}:undefined;
  recent.push({id:v.id.slice(0,100),requestId:text(v.requestId,120)||undefined,actorId,residentId:id,actorName,title:text(v.title,240)||'Trabajo de la casa',summary:text(v.summary,700),status:v.status,at,evidence});
 }
 const budget=isObject(raw.budget)&&count(raw.budget.used)&&count(raw.budget.automaticLimit)?{used:raw.budget.used,automaticLimit:raw.budget.automaticLimit,backgroundAvailable:raw.budget.backgroundAvailable===true}:undefined;
 return{at:stamp(raw.at)!,enabled:raw.enabled,busy:raw.busy,nextStepAt:stamp(raw.nextStepAt),counts:{runs:c.runs as number,applied:c.applied as number,unchanged:c.unchanged as number,waiting:c.waiting as number},recent,visual:readVisual(raw.visual),budget};
}

export default function HouseWorkLoop({signedIn,onVisual,onVisit}:Props){
 const[data,setData]=useState<Payload|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false),[control,setControl]=useState<'pause'|'resume'|null>(null);
 const sessionRef=useRef<string|null>(null),visibilityEpoch=useRef(1),visibilityState=useRef<'visible'|'hidden'>('visible');
 const callbacks=useRef({onVisual,onVisit}),wake=useRef<(()=>void)|null>(null),command=useRef<'pause'|'resume'|null>(null),retry=useRef<string|null>(null);
 callbacks.current={onVisual,onVisit};
 useEffect(()=>{
  if(!signedIn)return;
  const sessionId=sessionRef.current??=crypto.randomUUID();
  let hiddenNotified=false;
  const notifyHidden=()=>{
   if(hiddenNotified)return;hiddenNotified=true;
   if(visibilityState.current!=='hidden'){visibilityEpoch.current++;visibilityState.current='hidden';}
   try{navigator.sendBeacon('/api/house-work',new Blob([JSON.stringify({action:'visibility',sessionId,visibilityEpoch:visibilityEpoch.current,visible:false})],{type:'application/json'}));}catch{}
  };
  const markVisible=()=>{if(visibilityState.current!=='visible'){visibilityEpoch.current++;visibilityState.current='visible';}hiddenNotified=false;};
  if(!document.hidden)markVisible();
  let mounted=true,inFlight=false,current:Payload|null=null,receivedAt=performance.now(),timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|null=null,readFirst=true;
  const schedule=(delay=INTERVAL)=>{clearTimeout(timer);if(mounted&&!document.hidden)timer=setTimeout(()=>void tick(),Math.max(0,delay));};
  const due=(value:Payload)=>value.nextStepAt?Math.max(0,Date.parse(value.nextStepAt)-Date.parse(value.at)-(performance.now()-receivedAt)):0;
  const apply=(value:Payload)=>{
   current=value;receivedAt=performance.now();setData(value);setError('');callbacks.current.onVisual?.({at:value.at,visual:value.visual});
   if(retry.current&&value.recent.some(work=>work.requestId===retry.current))retry.current=null;
  };
  async function tick(){
   if(!mounted||document.hidden||inFlight)return;
   inFlight=true;setPending(true);controller=new AbortController();
   const action=command.current||(!readFirst&&current?.enabled&&!current.busy&&due(current)<=0?'step':null),requestId=action==='step'?(retry.current??=crypto.randomUUID()):null;
   try{
    const response=await fetch('/api/house-work',{method:action?'POST':'GET',cache:'no-store',headers:action?{'Content-Type':'application/json'}:undefined,body:action?JSON.stringify({action,...(requestId?{requestId,sessionId,visibilityEpoch:visibilityEpoch.current}:{})}):undefined,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(action==='step'?105000:12000)])});
    const raw:unknown=await response.json();if(!mounted)return;
    if(!response.ok){
     if(response.status===409){try{apply(readPayload(raw));}catch{}readFirst=true;return;}
     throw Error(isObject(raw)&&typeof raw.error==='string'?raw.error:'No se pudo actualizar el trabajo de la casa.');
    }
    apply(readPayload(raw));readFirst=false;
    if(action==='step')retry.current=null;
    if(action==='pause'||action==='resume'){command.current=null;setControl(null);}
   }catch(problem){if(mounted&&!controller.signal.aborted)setError(problem instanceof Error?problem.message:'Se interrumpió la conexión. El encargo conserva su identificador para reintentarlo.');}
   finally{
    controller=null;inFlight=false;
    if(mounted){setPending(false);if(command.current)schedule(action===command.current?INTERVAL:0);else if(readFirst)schedule(INTERVAL);else if(!action&&current?.enabled&&!current.busy&&due(current)<=0)schedule(0);else schedule(Math.max(INTERVAL,current?Math.min(60000,due(current)):INTERVAL));}
   }
  }
  const visible=()=>{clearTimeout(timer);if(document.hidden){notifyHidden();readFirst=true;controller?.abort();}else{markVisible();readFirst=true;schedule(0);}};
  const pageHide=()=>{clearTimeout(timer);notifyHidden();readFirst=true;controller?.abort();};
  const pageShow=()=>{if(!document.hidden){markVisible();readFirst=true;schedule(0);}};
  // A model consultation can outlast the 45-second presence lease. Renew only
  // while visible; an older heartbeat cannot revive a newer hidden epoch.
  const heartbeat=setInterval(()=>{if(!mounted||document.hidden)return;void fetch('/api/house-work',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'visibility',sessionId,visibilityEpoch:visibilityEpoch.current,visible:true}),signal:AbortSignal.timeout(5000)}).catch(()=>{});},15000);
  wake.current=()=>{if(!inFlight)schedule(0);};document.addEventListener('visibilitychange',visible);window.addEventListener('pagehide',pageHide);window.addEventListener('pageshow',pageShow);schedule(0);
  return()=>{notifyHidden();mounted=false;clearTimeout(timer);clearInterval(heartbeat);controller?.abort();wake.current=null;document.removeEventListener('visibilitychange',visible);window.removeEventListener('pagehide',pageHide);window.removeEventListener('pageshow',pageShow);};
 },[signedIn]);
 function toggle(){if(control)return;const action=data?.enabled?'pause':'resume';command.current=action;setControl(action);wake.current?.();}
 const latest=data?.recent[0];
 return <details className={styles.card} open>
  <summary><span className={styles.dot} data-active={data?.enabled&&!error}/><strong>La casa de Lía trabaja</strong><span className={styles.state}>{!signedIn?'Inicia sesión':control?'Actualizando…':data?.enabled?(pending?'En curso':'Activa'):'Pausada'}</span></summary>
  <p className={styles.intro}>Siggy — Sigma — lleva consultas al cielo y entrega resultados a los especialistas. Cada oficio conserva sus tareas y comprobaciones.</p>
  {signedIn?<>
   <div className={styles.controls}><button type="button" disabled={!data||control!==null} onClick={toggle}>{control==='pause'?'Pausando encargos…':control==='resume'?'Reanudando…':data?.enabled?'Pausar encargos':'Reanudar encargos'}</button><a href="/funciones">Ver funciones →</a></div>
   {data&&<div className={styles.counts}><span><b>{data.counts.applied}</b> artefactos compartidos</span><span><b>{data.counts.runs}</b> turnos registrados</span><span><b>{data.counts.unchanged}</b> sin cambio nuevo</span><span><b>{data.counts.waiting}</b> en espera</span></div>}
   <div className={styles.latest} aria-live="polite" aria-busy={pending}>{latest?<><small data-status={latest.status}>{statuses[latest.status]}</small><strong>{latest.actorName}</strong><p>{latest.title}</p>{latest.summary&&<p className={styles.detail}>{latest.summary}</p>}{latest.evidence&&<p className={styles.note}>{latest.evidence.status==='consistent_report'?'Informe coherente':'Evidencia pendiente de revisión'} · {latest.evidence.testCount} pruebas comunicadas. {latest.evidence.reportedImprovement?'Mejora comparativa reportada. ':'Sin mejora comparativa acreditada. '}El informe no equivale a verificación independiente.</p>}{latest.residentId&&onVisit&&<button type="button" onClick={()=>callbacks.current.onVisit?.(latest.residentId!)}>Ver al especialista →</button>}</>:<p>{data?'Esperando el primer resultado de la casa.':'Conectando con los encargos guardados…'}</p>}</div>
   {data?.budget&&!data.budget.backgroundAvailable&&<p className={styles.note}>La IA espera cuota ({data.budget.used}/{data.budget.automaticLimit} del margen automático). Las herramientas disponibles pueden seguir trabajando.</p>}
   <p className={styles.note}>Mientras esta pestaña esté visible se solicitan turnos según disponibilidad. Al ocultarla o cerrarla se detienen nuevos turnos y se avisa al servidor; una petición ya enviada al proveedor puede terminar. Un resultado repetido o una animación no cuentan como una mejora.</p>
  </>:<p className={styles.note}>Entra en tu cuenta para activar los encargos de esta casa.</p>}
  {error&&<p role="status" className={styles.error}>{error} Se conservan los últimos resultados.</p>}
 </details>;
}
