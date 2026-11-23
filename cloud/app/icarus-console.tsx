'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {residentById} from '../public/house/residents.js';
import {MISSIONS,missionFor} from '../lib/collaboration/missions';
import CharacterNetwork from './character-network';
import styles from './icarus-console.module.css';

type MissionKind='resident'|'room'|'module'|'core'|'domain'|'process'|'sense'|'character'|'zone'|'building';
type Mission={id:string;name:string;kind:MissionKind;residentId:string;room:string;domain:string;title:string;question:string;targetProject:'atlas'|'eras';application:string;validation:string[]};
const kinds:Record<MissionKind,string>={resident:'Habitantes de Atlas',room:'Salas de Atlas',module:'Módulos',core:'Núcleo',domain:'Ámbitos personales',process:'Procesos',sense:'Percepción',character:'Personajes de ERAS',zone:'Mundos de ERAS',building:'Edificios de ERAS'};
type Source={id:string;title:string;url:string;excerpt:string;readAt:string};
type Proposal={change:string;reason:string;validation:string[];sourceIds:string[]};
type Receipt={project_id:string;commit_sha:string;version_id:string;summary:string;checks:{name:string;passed:boolean}[];reportedAt:string};
type Consultation={id:string;requestId:string;actorId:string;residentId:string;actorName:string;domain:string;title:string;question:string;targetProject:'atlas'|'eras';application:string;validation:string[];status:string;at:string;completedAt?:string;sources:Source[];proposal?:Proposal;agents:{role:string;model:string;status:string}[];attempts:{provider:string;ok:boolean;detail:string}[];error?:string;receipt?:Receipt};
type Payload={at:string;enabled:boolean;busy:boolean;missions:Mission[];consultations:Consultation[];total:number};
const statuses:Record<string,{label:string;detail:string}>={
 consulting:{label:'Consultando con Ícaro',detail:'La consulta está en curso.'},
 'evidence-collected':{label:'Fuentes recogidas',detail:'Hay documentación disponible. La propuesta y su aplicación siguen pendientes.'},
 proposed:{label:'Propuesta para comprobar',detail:'Los modelos han propuesto y revisado un cambio. Su aplicación todavía necesita pruebas.'},
 rejected:{label:'Propuesta descartada',detail:'Se conserva lo anterior; este intento no acredita una mejora.'},
 blocked:{label:'Consulta pendiente',detail:'Esta lectura no ha conseguido evidencia suficiente para continuar.'},
 'reported-applied':{label:'Publicación comunicada',detail:'La tarea de nube ha comunicado una publicación y sus pruebas. El recibo se conserva para revisarlo.'}
};
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max=500)=>typeof value==='string'?value.slice(0,max):'';
const list=(value:unknown,max=12)=>Array.isArray(value)?value.slice(0,max):[];
const strings=(value:unknown,max=12)=>list(value,max).filter((s):s is string=>typeof s==='string').map(s=>s.slice(0,500));
const residentId=(value:unknown)=>typeof value==='string'&&!!residentById(value)?value:null;
const stamp=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))?value:null;
function link(value:unknown){try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
const project=(value:unknown):'atlas'|'eras'=>value==='eras'?'eras':'atlas';
function readMission(value:unknown):Mission|null{
 if(!record(value))return null;
 const known=typeof value.id==='string'?missionFor(value.id):typeof value.residentId==='string'?missionFor('resident:'+value.residentId):null;
 if(!known||!residentId(known.residentId)||!Object.hasOwn(kinds,known.kind))return null;
 return{id:known.id,name:known.name,kind:known.kind,residentId:known.residentId,room:known.room,domain:known.domain,title:known.title,question:known.question,targetProject:known.targetProject,application:known.application,validation:[...known.validation]};
}
function readConsultation(value:unknown):Consultation|null{
 if(!record(value)||typeof value.id!=='string'||!/^icarus-[1-9]\d{0,9}$/.test(value.id)||!Object.hasOwn(statuses,String(value.status)))return null;
 const id=residentId(value.residentId),at=stamp(value.at),mission=missionFor(typeof value.actorId==='string'?value.actorId:'resident:'+String(value.residentId));if(!id||!at||!mission||mission.residentId!==id)return null;
 const sources=list(value.sources,32).flatMap(raw=>{if(!record(raw))return[];const url=link(raw.url);if(!url||typeof raw.id!=='string')return[];return[{id:text(raw.id,100),title:text(raw.title,240),url,excerpt:text(raw.excerpt,1200),readAt:stamp(raw.readAt)||at}];});
 let proposal:Proposal|undefined;if(record(value.proposal)&&typeof value.proposal.change==='string')proposal={change:text(value.proposal.change,3000),reason:text(value.proposal.reason,2000),validation:strings(value.proposal.validation),sourceIds:strings(value.proposal.sourceIds,32).filter(id=>sources.some(source=>source.id===id))};
 let receipt:Receipt|undefined;if(record(value.receipt)&&value.receipt.verification==='reported-by-cloud-workflow'&&typeof value.receipt.commit_sha==='string'&&/^[a-f0-9]{40}$/i.test(value.receipt.commit_sha))receipt={project_id:text(value.receipt.project_id,120),commit_sha:value.receipt.commit_sha,version_id:text(value.receipt.version_id,240),summary:text(value.receipt.summary,2000),checks:list(value.receipt.checks,20).flatMap(check=>record(check)&&typeof check.name==='string'?[{name:text(check.name,500),passed:check.passed===true}]:[]),reportedAt:stamp(value.receipt.reportedAt)||at};
 return{id:value.id,requestId:text(value.requestId,120),actorId:mission.id,residentId:id,actorName:mission.name,domain:text(value.domain,80),title:text(value.title,200),question:text(value.question,1000),targetProject:project(value.targetProject),application:text(value.application,1500),validation:strings(value.validation),status:String(value.status),at,completedAt:stamp(value.completedAt)||undefined,sources,proposal,receipt,error:text(value.error,1000)||undefined,agents:list(value.agents,8).flatMap(agent=>record(agent)?[{role:text(agent.role,80),model:text(agent.model,120),status:text(agent.status,50)}]:[]),attempts:list(value.attempts,12).flatMap(attempt=>record(attempt)?[{provider:text(attempt.provider,100),ok:attempt.ok===true,detail:text(attempt.detail,500)}]:[])};
}
function readPayload(value:unknown):Payload{
 if(!record(value)||!stamp(value.at)||(!Array.isArray(value.missions)&&!Array.isArray(value.residents))||!Array.isArray(value.consultations))throw Error('No se pudo interpretar la consulta de Ícaro.');
 const total=record(value.icarus)&&Number.isSafeInteger(value.icarus.total)?Number(value.icarus.total):0;
 const missions=new Map<string,Mission>();for(const raw of list(Array.isArray(value.missions)?value.missions:value.residents,MISSIONS.length)){const item=readMission(raw);if(item)missions.set(item.id,item);}
 return{at:String(value.at),enabled:value.enabled!==false,busy:value.busy===true,missions:[...missions.values()],consultations:list(value.consultations,12).flatMap(raw=>{const item=readConsultation(raw);return item?[item]:[];}),total};
}
const date=(value:string)=>new Date(value).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'});

export default function IcarusConsole({ready=true,onFollow,initialActorId}:{ready?:boolean;onFollow?:(id:string)=>void;initialActorId?:string}){
 const[data,setData]=useState<Payload|null>(null),[actor,setActor]=useState(()=>initialActorId?missionFor(initialActorId)?.id||'':''),[selection,setSelection]=useState<string|null>(null),[pending,setPending]=useState(false),[error,setError]=useState(''),[readError,setReadError]=useState('');
 useEffect(()=>{const mission=initialActorId?missionFor(initialActorId):null;if(mission){setActor(mission.id);setSelection(null);setError('');}},[initialActorId]);
 const mounted=useRef(false),sequence=useRef(0),busy=useRef(false),controllers=useRef(new Set<AbortController>()),retry=useRef<{actor:string;id:string}|null>(null);
 const apply=useCallback((raw:unknown)=>{const next=readPayload(raw);if(!mounted.current)return;setData(next);setReadError('');setActor(previous=>next.missions.some(v=>v.id===previous)?previous:next.missions[0]?.id||'');if(retry.current&&next.consultations.some(c=>c.requestId===retry.current?.id&&c.status!=='consulting'))retry.current=null;},[]);
 const refresh=useCallback(async()=>{if(document.hidden)return;const request=++sequence.current,controller=new AbortController();controllers.current.add(controller);try{const response=await fetch('/api/icarus',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});if(!response.ok)throw Error('No se pudo actualizar Ícaro.');const raw:unknown=await response.json();if(request===sequence.current)apply(raw);}catch(problem){if(mounted.current&&!controller.signal.aborted)setReadError(problem instanceof Error?problem.message:'No se pudo actualizar Ícaro.');}finally{controllers.current.delete(controller);}},[apply]);
 useEffect(()=>{mounted.current=true;void refresh();const timer=setInterval(()=>void refresh(),8000),visibility=()=>{if(!document.hidden)void refresh();};document.addEventListener('visibilitychange',visibility);return()=>{mounted.current=false;clearInterval(timer);document.removeEventListener('visibilitychange',visibility);for(const controller of controllers.current)controller.abort();controllers.current.clear();};},[refresh]);
 async function consult(){
  if(busy.current||!actor||!ready||!data?.enabled||data.busy)return;busy.current=true;setPending(true);setError('');const requested=actor,requestId=retry.current?.actor===requested?retry.current.id:crypto.randomUUID();retry.current={actor:requested,id:requestId};
  const controller=new AbortController();controllers.current.add(controller);++sequence.current;
  try{const response=await fetch('/api/icarus',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(100000)]),body:JSON.stringify({action:'consult',requestId,actorId:requested})}),raw:unknown=await response.json();if(!response.ok)throw Error(record(raw)&&typeof raw.error==='string'?raw.error:'Ícaro no pudo completar la consulta.');if(!mounted.current)return;++sequence.current;apply(raw);if(record(raw)){const consultation=readConsultation(raw.consultation);if(consultation)setSelection(consultation.id);}retry.current=null;}
  catch(problem){if(mounted.current&&!controller.signal.aborted)setError(problem instanceof Error?problem.message:'La conexión se interrumpió. Puedes reintentar la misma consulta.');}
  finally{controllers.current.delete(controller);busy.current=false;if(mounted.current)setPending(false);void refresh();}
 }
 const vocation=data?.missions.find(v=>v.id===actor),consultation=data?.consultations.find(c=>c.id===selection&&c.actorId===actor)||data?.consultations.find(c=>c.actorId===actor),status=consultation?statuses[consultation.status]:null;
 const groups=(Object.keys(kinds) as MissionKind[]).map(kind=>({kind,label:kinds[kind],missions:data?.missions.filter(m=>m.kind===kind)||[]})).filter(group=>group.missions.length);
 return <section className={styles.console} aria-labelledby="icarus-console-title">
  <header className={styles.header}><div><span className={styles.eyebrow}>COLABORAR DESDE CADA OFICIO</span><h3 id="icarus-console-title">Una pregunta propia. Una ayuda concreta.</h3></div><span className={styles.count}>{data?.total||0} consultas registradas</span></header>
  <p className={styles.intro}>Todos los encargos tienen un objetivo común: mejorar a Lía. Atlas aporta la mente, Ion el cuerpo e Ícaro conecta con el cielo. Cada especialista contribuye desde su oficio con propuestas, pruebas y aplicaciones.</p>
  {data&&<p className={styles.small}>{data.missions.length} funciones registradas · {data.missions.filter(m=>m.targetProject==='atlas').length} en Atlas · {data.missions.filter(m=>m.targetProject==='eras').length} en ERAS. Las salas y los módulos colaboran mediante un habitante delegado.</p>}
  {data&&<CharacterNetwork missions={data.missions} locked={pending} onSelect={id=>{setActor(id);setSelection(null);setError('');}}/>}
  <div className={styles.workflow} aria-label="Ciclo de trabajo"><span>Problema del oficio</span><b aria-hidden="true">→</b><span>Consulta con Ícaro</span><b aria-hidden="true">→</b><span>Propuesta y pruebas</span><b aria-hidden="true">→</b><span>Aplicación y memoria</span></div>
  <div className={styles.workspace}>
   <div className={styles.assignment}><label htmlFor="icarus-resident">¿Qué función consulta?</label><select id="icarus-resident" value={actor} disabled={pending||!data?.missions.length} onChange={event=>{setActor(event.target.value);setSelection(null);setError('');}}>{!data?.missions.length&&<option value="">Leyendo las funciones…</option>}{groups.map(group=><optgroup key={group.kind} label={group.label+' · '+group.missions.length}>{group.missions.map(m=><option key={m.id} value={m.id}>{m.name} · {m.title}</option>)}</optgroup>)}</select>
    {vocation&&<><div className={styles.topic}><small>{vocation.title}</small><h4>{vocation.question}</h4></div><p>{vocation.application}</p><small className={styles.destination}>Aplicación prevista: {vocation.targetProject==='eras'?'ERAS':'Atlas'} · {vocation.domain}</small>{vocation.kind!=='resident'&&<p className={styles.small}>Delegado en la casa: {residentById(vocation.residentId)?.name||vocation.residentId}.</p>}<h5>Cómo se comprobaría</h5><ul>{vocation.validation.map((check,i)=><li key={i}>{check}</li>)}</ul></>}
    <button type="button" className={styles.consult} disabled={pending||data?.busy||!data?.enabled||!actor||!ready} onClick={()=>void consult()}>{pending?'Consultando fuentes y colaboradores…':data?.busy?'Hay una consulta en curso…':'Consultar con Ícaro'}</button>
    {!ready&&<p className={styles.notice}>Inicia sesión para encargar una consulta.</p>}{data?.enabled===false&&<p className={styles.notice}>Las consultas están pausadas.</p>}<p className={styles.small}>La lectura documental puede continuar cuando la IA espera cuota. El viaje de la casa corresponde a una consulta registrada; encontrar fuentes no significa que el cambio esté aplicado.</p>
   </div>
   <div className={styles.result} aria-live="polite" aria-busy={pending}>
    {consultation&&status?<><div className={styles.resultHeading}><span className={styles.badge} data-state={consultation.status}>{status.label}</span><time dateTime={consultation.at}>{date(consultation.at)}</time></div><h4>{consultation.question}</h4><p>{status.detail}</p>{consultation.error&&<p className={styles.notice}>{consultation.error}</p>}
     <h5>Documentación leída · {consultation.sources.length}</h5>{consultation.sources.length?<ol className={styles.sources}>{consultation.sources.map(source=><li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a><small>Leída el {date(source.readAt)}</small><details><summary>Ver extracto conservado</summary><p>{source.excerpt}</p></details></li>)}</ol>:<p className={styles.small}>Esta consulta todavía no conserva fuentes legibles.</p>}
     {consultation.proposal&&<div className={styles.proposal}><h5>Cambio propuesto</h5><p>{consultation.proposal.change}</p><small>{consultation.proposal.reason}</small><h5>Pruebas propuestas</h5><ul>{consultation.proposal.validation.map((check,i)=><li key={i}>{check}</li>)}</ul>{!!consultation.proposal.sourceIds.length&&<small>{consultation.proposal.sourceIds.length} referencias leídas enlazadas por la propuesta. Ese enlace todavía requiere contraste.</small>}</div>}
     {!!consultation.agents.length&&<details className={styles.advanced}><summary>Colaboración de modelos registrada</summary>{consultation.agents.map((agent,i)=><p key={i}>{agent.role} · {agent.model} · {agent.status==='completed'?'respuesta completada':agent.status==='unavailable'?'no disponible':agent.status}</p>)}</details>}
     {onFollow&&residentById(consultation.residentId)&&<button type="button" onClick={()=>onFollow(consultation.residentId)}>{missionFor(consultation.actorId)?.kind==='resident'?'Ver al habitante':'Ver al delegado en Atlas'}</button>}{consultation.receipt&&<div className={styles.receipt}><h5>Recibo de publicación</h5><p>{consultation.receipt.summary}</p><ul>{consultation.receipt.checks.map((check,i)=><li key={i}>{check.passed?'✓':'Pendiente'} {check.name}</li>)}</ul><small>Comunicado por la tarea de nube el {date(consultation.receipt.reportedAt)}.</small><details><summary>Identificar esta versión</summary><p>Proyecto: {consultation.receipt.project_id}</p><p>Versión: {consultation.receipt.version_id}</p><code>{consultation.receipt.commit_sha}</code></details></div>}
     {!!consultation.attempts.length&&<details className={styles.advanced}><summary>Accesos y límites de esta consulta</summary>{consultation.attempts.map((attempt,i)=><p key={i}>{attempt.provider} · {attempt.ok?'leído':'sin acceso'} · {attempt.detail}</p>)}</details>}
    </>:<div className={styles.empty}><span aria-hidden="true">✦</span><h4>{data?'Este oficio todavía no tiene una consulta en el historial reciente.':'Preparando la constelación…'}</h4><p>Elige una función del catálogo para conocer su problema y consultar referencias aplicadas a su trabajo.</p></div>}
   </div>
  </div>
  {error&&<p role="alert" className={styles.error}>{error}</p>}{readError&&<p className={styles.notice}>{readError} Se conservan los últimos datos disponibles.</p>}
  {!!data?.consultations.length&&<div className={styles.history}><h4>Consultas recientes</h4><div>{data.consultations.map(item=><button type="button" key={item.id} aria-pressed={consultation?.id===item.id} onClick={()=>{setActor(item.actorId);setSelection(item.id);setError('');}}><strong>{item.actorName}</strong><span>{item.title||item.question}</span><small>{statuses[item.status]?.label} · {date(item.at)}</small></button>)}</div></div>}
 </section>;
}
