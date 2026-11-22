'use client';
import {HOUSE_FUNCTIONS,houseFunction} from '../public/house/functional-world.js';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,AudioLines,Brain,Clapperboard,FlaskConical,Gamepad2,Home,Languages,Menu,MessageCircle,Orbit,Share2,ShieldCheck,Wrench,X,type LucideIcon} from 'lucide-react';
import HouseScene,{HOUSE_ROOMS,type HouseAPI,type HousePerformance,type HouseRoom,type HouseInstallation,type HouseIcarusStatus} from './house-scene';
import LivingWorld from './living-world';
import ResidentPersonality from './resident-personality';
import HouseWorkLoop,{type HouseWorkUpdate} from './house-work-loop';
import MusicStudio from './music-studio';
import LiaEvolution from './lia-evolution';
import WorldWorkshop from './world-workshop';
import CinemaPanel from './cinema-panel';
import ConstellationPanel from './constellation-panel';
import CoreObservatory,{type CoreTelemetry} from './core-observatory';
import styles from './atlas-house.module.css';
import LiveWorkOptIn from './live-work-opt-in';
import {RESIDENTS,WORKSTATIONS,residentById,processForResident} from '../public/house/residents.js';

import {readCreativePreview} from './experience-creative-preview';
import {normalizeIcarusJourneys,residentForIcarusEvent} from '../public/house/sky-journeys.js';
import {VOCATIONS,vocationFor} from '@/lib/collaboration/vocations';
import {WORLD_ENTITIES,type WorldState} from '@/lib/evolution/world';
import {LIA_ARCHITECTURE} from '@/lib/core/identity';
import {measuredChanges,STATE_LABELS} from '../public/house/process-state.js';

type ResidentRecord={id:string;room:HouseRoom;name:string;role:string;archetype:string;processIds:string[];cosmetic:boolean;activePhases?:string[]};
type HouseResident=ResidentRecord&{status?:string;statusTone?:'idle'|'running'|'passed'|'failed'|'waiting'};
type Props={signedIn:boolean;displayName:string;signInPath:string};
type Status={provider?:string;online:boolean;modelName?:string;lastSeen?:string|null;capabilities?:{gpuMode?:'chat'|'video'|'training';processTelemetry?:(CoreTelemetry&{experience?:{creative?:unknown;icarus?:unknown}|null})|null}};
const rooms:Record<HouseRoom,{title:string;short:string;description:string;action:string;icon:LucideIcon;accent:string}>={
  salon:{title:'Lía · Salón de Atlas',short:'Salón',description:'Atlas piensa, conecta y formula la identidad de Lía desde la mente.',action:'Hablar con Lía',icon:MessageCircle,accent:'#a8e5ce'},
  music:{title:'Lía · Estudio de música',short:'Música',description:'El sonido y la música dan expresión a Lía y acompañan su entorno compartido.',action:'Hacer música',icon:AudioLines,accent:'#e7be7c'},
  lab:{title:'Lía · Laboratorio',short:'Laboratorio',description:'Ion transforma la idea en entorno 3D y prueba cómo vive Lía dentro de ese espacio.',action:'Crear en 3D',icon:FlaskConical,accent:'#a7cde4'},
  games:{title:'Lía · Taller de mundos',short:'Videojuegos',description:'Un mundo útil para Lía debe sentirse vivo, coherente y jugable.',action:'Crear un videojuego',icon:Gamepad2,accent:'#c6afe6'},
  cinema:{title:'Lía · Sala de cine',short:'Cine',description:'El lenguaje visual y la imagen de Lía se construyen también en cámara.',action:'Crear un vídeo',icon:Clapperboard,accent:'#e6ad91'},
  constellation:{title:'Lía · Cielo e Ícaro',short:'Constelación',description:'Dios / Ícaro reúne señales, agentes y perspectivas: el horizonte de Lía.',action:'Abrir la constelación',icon:Orbit,accent:'#b9c8ff'},
  mind:{title:'Lía · Mente y archivo vivo',short:'Mente',description:'La memoria de Lía conserva lo que ha visto, pensado y corregido.',action:'Explorar la mente',icon:Brain,accent:'#a6cfea'},
  body:{title:'Lía · Cuerpo de Ion',short:'Ion',description:'El cuerpo operativo de Lía ejecuta tareas, comprueba resultados y mantiene el entorno real.',action:'Entrar en el cuerpo de Ion',icon:Wrench,accent:'#e9b0a5'},
  refutation:{title:'Lía · Cámara de refutación',short:'Refutación',description:'Lía no acepta una mejora si no puede comprobarse ni sostenerse con evidencia.',action:'Ver pruebas y refutaciones',icon:ShieldCheck,accent:'#d5d3ac'},
  language:{title:'Lía · LOR-ΩΣ',short:'LOR-ΩΣ',description:'El lenguaje de Lía conserva su estructura, límites y evolución.',action:'Abrir LOR-ΩΣ',icon:Languages,accent:'#b8d5b0'},
};

export default function AtlasHouse({signedIn,displayName,signInPath}:Props){
 const [houseWork,setHouseWork]=useState<HouseWorkUpdate|null>(null);
 const [cloudJourneys,setCloudJourneys]=useState<{at:string;icarus:HouseIcarusStatus|null}|null>(null);
 useEffect(()=>{let active=true;const controller=new AbortController();const read=async()=>{try{const r=await fetch('/api/icarus',{cache:'no-store',signal:controller.signal});if(!r.ok)return;const p=await r.json() as {at:string;icarus:unknown};if(active)setCloudJourneys({at:p.at,icarus:normalizeIcarusJourneys(p.icarus) as HouseIcarusStatus|null});}catch{}};void read();const timer=setInterval(read,8000);return()=>{active=false;controller.abort();clearInterval(timer);};},[]);
 const [livingJob,setLivingJob]=useState<{status:string;actorId:string;room:string;at:string}|undefined>(),[livingBusy,setLivingBusy]=useState(false);
 const [peopleStatus,setPeopleStatus]=useState<{enabled:boolean;active:number;loading:boolean;failed:boolean;limit:number}|null>(null);
 const [worldMemory,setWorldMemory]=useState<WorldState|null>(null);
 useEffect(()=>{let active=true;const controller=new AbortController();const load=async()=>{if(document.hidden)return;try{const response=await fetch('/api/autonomy',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8000)])});if(response.ok){const value=await response.json() as {control?:{spiral?:{world?:WorldState}}};if(active)setWorldMemory(value.control?.spiral?.world||null);}}catch{}};void load();const timer=setInterval(()=>void load(),30000);return()=>{active=false;controller.abort();clearInterval(timer);};},[]);
 const[residentsOpen,setResidentsOpen]=useState(false),[selectedResident,setSelectedResident]=useState<string|null>(null),[installation,setInstallation]=useState<HouseInstallation|null>(null),[roomDetailsOpen,setRoomDetailsOpen]=useState(false);
 const residentsPanel=useRef<HTMLElement>(null),residentsToggle=useRef<HTMLButtonElement>(null);
 const charterDialog=useRef<HTMLDialogElement>(null);const [capturing,setCapturing]=useState(false),[hudHidden,setHudHidden]=useState(false);
 const captureView=async()=>{if(!api||capturing)return;setCapturing(true);try{const url=await api.capture();const link=document.createElement('a');link.href=url;link.download='lia-casa.png';link.click();}catch(e){setNotice(e instanceof Error?e.message:'No se pudo capturar.');}finally{setCapturing(false);}};
 const [spiralOpen,setSpiralOpen]=useState(false);
 const [activeFunction,setActiveFunction]=useState<ReturnType<typeof houseFunction>>(null);
 const[room,setRoom]=useState<HouseRoom>('salon'),[entered,setEntered]=useState(false),[workspace,setWorkspace]=useState<HouseRoom|null>(null),[menu,setMenu]=useState(false),[api,setApi]=useState<HouseAPI|null>(null),[performance,setPerformance]=useState<HousePerformance|null>(null),[status,setStatus]=useState<Status|null>(null),[statusFailed,setStatusFailed]=useState(false),[notice,setNotice]=useState(''),[sceneError,setSceneError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),closeButton=useRef<HTMLButtonElement>(null),previousFocus=useRef<HTMLElement|null>(null),lastRequested=useRef<HouseRoom|null>(null),pollBusy=useRef(false),roomNavigation=useRef<HTMLElement>(null);
 const active=rooms[room],ActiveIcon=active.icon;
 const triad=LIA_ARCHITECTURE.vertices.map(vertex=>({name:vertex.id==='icarus'?'Ícaro':vertex.name,role:vertex.id==='icarus'?'cielo + constelación':vertex.function.toLocaleLowerCase('es-ES'),room:vertex.room as HouseRoom}));
 useEffect(()=>{
  let alive=true;const controller=new AbortController();
  async function poll(){if(pollBusy.current||document.hidden)return;pollBusy.current=true;try{const response=await fetch('/api/cloud/status',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8000)])});if(!response.ok)throw Error('Estado no disponible');const data=await response.json() as Status;if(alive){setStatus(data);setStatusFailed(false);}}catch{if(alive)setStatusFailed(true);}finally{pollBusy.current=false;}}
  void poll();const timer=setInterval(()=>void poll(),10000),visibility=()=>{if(!document.hidden)void poll();};document.addEventListener('visibilitychange',visibility);
  return()=>{alive=false;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 const ready=useCallback((value:HouseAPI)=>{setApi(value);setSceneError('');if(lastRequested.current)value.teleport(lastRequested.current);},[]);
 const walk=useCallback((next:HouseRoom)=>{setRoomDetailsOpen(false);setEntered(true);setRoom(next);setSelectedResident(null);setResidentsOpen(false);setMenu(false);lastRequested.current=next;api?.teleport(next);},[api]);
 const open=useCallback((next:HouseRoom)=>{setActiveFunction(null);setRoomDetailsOpen(false);setRoom(next);setEntered(true);setMenu(false);previousFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setWorkspace(next);},[]);
 const activateFunction=(id:string)=>{const fn=houseFunction(id);if(!fn)return;api?.teleport(fn.room as HouseRoom);open(fn.room as HouseRoom);setActiveFunction(fn);};
 const close=useCallback(()=>{setActiveFunction(null);setWorkspace(null);},[]);
 const deepLinkHandled=useRef(false);
 useEffect(()=>{if(deepLinkHandled.current||!api)return;deepLinkHandled.current=true;const requested=new URLSearchParams(location.search).get('room');if(requested&&Object.hasOwn(rooms,requested)){const next=requested as HouseRoom;lastRequested.current=next;api.teleport(next);open(next);}},[api,open]);
 useEffect(()=>{
  const current=dialog.current;if(!current)return;
  if(workspace){if(!current.open)current.showModal();closeButton.current?.focus();}
  else if(current.open){current.close();previousFocus.current?.focus();}
 },[workspace]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(timer);},[notice]);
 useEffect(()=>{if(!menu)return;const key=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape')setMenu(false);};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[menu]);
 useEffect(()=>{const nav=roomNavigation.current,button=nav?.querySelector<HTMLButtonElement>(`[data-room="${room}"]`);if(!nav||!button)return;const left=button.offsetLeft,right=left+button.offsetWidth;if(left<nav.scrollLeft||right>nav.scrollLeft+nav.clientWidth)nav.scrollTo({left:Math.max(0,left-(nav.clientWidth-button.offsetWidth)/2),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[room]);
 const share=async()=>{try{const data={title:'Lía · Casa de ideas',text:'Atlas aporta la mente, Ion el cuerpo e Ícaro el cielo para desarrollar la casa de Lía.',url:location.origin+'/'};if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(data.url);setNotice('Enlace de Atlas copiado. Cada persona tendrá su propio historial.');}}catch(error){if(error instanceof Error&&error.name==='AbortError')return;setNotice('Puedes compartir la dirección de esta página desde el navegador.');}};
 const overview=()=>{setRoomDetailsOpen(false);setEntered(false);setMenu(false);setSelectedResident(null);setResidentsOpen(false);lastRequested.current=null;api?.overview();};
 const initials=(displayName||'Tu espacio').slice(0,1).toUpperCase();
 const connected=status?.online===true&&!statusFailed;
 const baseProcessState=useMemo(()=>{const telemetry=status?.capabilities?.processTelemetry;if(livingBusy&&livingJob?.status==='running')return{connected:true,at:livingJob.at,processes:[{id:'creative',counters:undefined,actorId:livingJob.actorId.replace('resident:',''),room:livingJob.room as HouseRoom,state:'running' as const,phase:'apply' as const}],icarus:null};if(cloudJourneys?.icarus)return{connected:true,at:cloudJourneys.at,processes:[],icarus:cloudJourneys.icarus};if(!telemetry)return {connected:false,processes:[],icarus:null};const age=telemetry.at?Date.now()-Date.parse(telemetry.at):Infinity,fresh=connected&&Number.isFinite(age)&&age>=0&&age<=75000;return {at:telemetry.at||undefined,connected:fresh,processes:fresh?telemetry.processes:telemetry.processes.map(process=>({...process,state:'waiting' as const})),icarus:normalizeIcarusJourneys(telemetry.experience?.icarus) as HouseIcarusStatus|null};},[status?.capabilities?.processTelemetry,connected,livingBusy,livingJob,cloudJourneys]);
 const processState=useMemo(()=>{if(!houseWork)return baseProcessState;const age=baseProcessState.at?Date.now()-Date.parse(baseProcessState.at):Infinity,fresh=baseProcessState.connected&&age>=0&&age<=75000;return{...baseProcessState,processes:fresh?baseProcessState.processes:baseProcessState.processes.map(p=>({...p,state:p.state==='running'?'waiting' as const:p.state,counters:undefined})),at:houseWork.at,connected:true,houseWork:houseWork.visual};},[baseProcessState,houseWork]);
 const creative=useMemo(()=>readCreativePreview(status?.capabilities?.processTelemetry?.experience?.creative),[status?.capabilities?.processTelemetry?.experience?.creative]);
 const selectedPerson=selectedResident?residentById(selectedResident):null;
 const entityId=selectedPerson?'resident:'+selectedPerson.id:'room:'+room,entity=WORLD_ENTITIES.find(e=>e.id===entityId),memory=worldMemory?.memories[entityId];
 const visitResident=(id:string)=>{const resident=residentById(id);if(!resident)return;setRoomDetailsOpen(false);setResidentsOpen(false);setEntered(true);setRoom(resident.room as HouseRoom);setSelectedResident(id);setWorkspace(null);api?.focusResident(id);};
 const visitEvolution=()=>{setRoomDetailsOpen(false);setResidentsOpen(false);setEntered(true);setRoom('games');setSelectedResident(null);api?.focusEvolution();};
 useEffect(()=>{if(!residentsOpen)return;residentsPanel.current?.focus();const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setResidentsOpen(false);residentsToggle.current?.focus();}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[residentsOpen]);
 const activeProcesses=processState.connected?processState.processes.filter(process=>process.state==='running').length:0;
 const acceptedChanges=measuredChanges(baseProcessState);
 const residentRuntime=useMemo<HouseResident[]>(()=>{
  const now=Date.now(),timestamp=baseProcessState.at?Date.parse(baseProcessState.at):NaN,age=now-timestamp,fresh=baseProcessState.connected!==false&&Number.isFinite(age)&&age>=0&&age<=75000;
  return (RESIDENTS as HouseResident[]).map(resident=>{
   const event=houseWork?.visual.events.filter(e=>e.workerId===resident.id&&now-Date.parse(e.at)>=0&&now-Date.parse(e.at)<=15000).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
   if(event){const labels={applied:'Aplicación reportada',tested:'Prueba reportada',unchanged:'Sin cambio nuevo',waiting:'En espera',rejected:'Rechazo reportado'};return{...resident,status:labels[event.status],statusTone:event.status==='rejected'?'failed':event.status==='waiting'?'waiting':'passed'};}
   const result=processForResident(baseProcessState,resident,{ageMs:age});
   const tone=fresh?result.state:resident.cosmetic?'idle':'waiting';
   return{...resident,status:fresh?(STATE_LABELS[tone as keyof typeof STATE_LABELS]||'En espera'):resident.cosmetic?'En reposo':'Sin señal reciente',statusTone:tone};
  });
 },[baseProcessState,houseWork]);
 const icarus=processState.icarus;
 const latestConsultation=icarus?.active||icarus?.recent.at(-1)||null;
 const traveler=latestConsultation?residentForIcarusEvent(latestConsultation):null;
 const consultationLabel=!processState.connected?'Sin señal reciente':!latestConsultation?'Esperando una consulta registrada':latestConsultation.phase==='seeking'?`${traveler?.name||'Atlas'} prepara su consulta`:latestConsultation.phase==='consulting'?`${traveler?.name||'Atlas'} consulta a Ícaro`:latestConsultation.phase==='returning'?`${traveler?.name||'Atlas'} vuelve con referencias`:'La consulta necesita otro intento';

 return <main className={styles.house+(hudHidden?' '+styles.cleanView:'')}>
  <div className={styles.scene}><HouseScene onAtlasModeChange={value=>{setSpiralOpen(value);if(value)setEntered(true);}} onFunction={activateFunction} onPeopleStatus={setPeopleStatus} creative={creative} onCreativeApplied={setInstallation} onResidentFocus={setSelectedResident} processState={processState} paused={false} onRoomChange={next=>{setRoomDetailsOpen(false);setRoom(next);}} onInteract={open} onReady={ready} onPerformance={setPerformance} onError={message=>{setSceneError(message);setPerformance(null);}}/></div>
  <div className={styles.vignette}/>
  <header className={styles.topbar}>
   <a className={styles.brand} href="/" aria-label="Lía, la casa de ideas"><svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="22" stroke="currentColor" opacity=".23"/><path d="m24 9 16 28H8L24 9Z" stroke="currentColor" opacity=".6"/><path d="M12 25q12-14 24 0-12 14-24 0Z" stroke="currentColor"/><circle cx="24" cy="25" r="4" fill="currentColor"/></svg><span>Lía<small>ATLAS · ION · ÍCARO</small></span></a>
   <div className={styles.topActions}>
    <button ref={residentsToggle} className={styles.residentToggle} type="button" aria-expanded={residentsOpen} aria-controls="atlas-house-residents" aria-label="Ver los habitantes y visitar cada puesto" onClick={()=>setResidentsOpen(value=>!value)}><span>{RESIDENTS.length}</span> Habitantes</button>
    <a className={styles.activityLink} href="/actividad/" aria-label="Ver actividad y herramientas de Atlas"><Brain size={16}/><span>Actividad</span></a>
    <a className={styles.activityLink} href="/espiral" aria-label="Abrir la espiral de Sites"><span>Espiral</span></a><a className={styles.activityLink} href="/funciones"><span>Funciones</span></a><a className={styles.activityLink} href="/arquitectura"><span>Tríada → Lía</span></a><button className={styles.residentToggle} type="button" disabled={!api||!peopleStatus} aria-pressed={peopleStatus?.enabled===true} onClick={()=>api?.setPeopleDetail(!peopleStatus?.enabled)} title={peopleStatus?.loading?'Cargando personajes de ERAS…':peopleStatus?.failed?'Una carga falló; se conserva la figura ligera':'Personajes humanos cercanos con animaciones de ERAS'}><span>{peopleStatus?.active||0}</span> {peopleStatus?.enabled?'Detalle auto':'Modo ligero'}</button>
    <button className={styles.residentToggle} type="button" aria-pressed={spiralOpen} disabled={!api} onClick={()=>api?.atlasMode(spiralOpen?'leave':'enter')}>{spiralOpen?'Volver a la casa':'Mapa de la tríada'}</button><button className={styles.residentToggle} onClick={()=>charterDialog.current?.showModal()}>Evolución de Lía</button><button className={styles.residentToggle} onClick={()=>void captureView()} disabled={!api||capturing}>PNG</button><button className={styles.residentToggle} onClick={()=>setHudHidden(v=>!v)}>{hudHidden?'Mostrar interfaz':'Vista limpia'}</button>{status?.provider!=='groq'&&<LiveWorkOptIn room={room} bridgeOnline={connected}/>}<span className={`${styles.modelBadge} ${status?.online&&!statusFailed?styles.online:''}`} title={status?.provider==='groq'?'Atlas en Groq. Chat e investigación sin depender del PC.':statusFailed?'No se pudo comprobar el estado del PC.':status?.online?status.capabilities?.gpuMode==='video'?'La GPU está generando vídeo. Qwen volverá al terminar.':status.capabilities?.gpuMode==='training'?'La GPU está entrenando una candidata separada. El modelo activo no se sustituye.':`${status.modelName||'Qwen'} responde desde tu PC.`:'El puente del PC no está disponible. Puedes seguir usando las funciones locales.'}><i/><span>{status?.provider==='groq'?'Atlas en la nube':statusFailed?'Estado sin verificar':status?.online?status.capabilities?.gpuMode==='video'?'GPU en vídeo':status.capabilities?.gpuMode==='training'?'Entrenando candidata':'Qwen en tu PC':status?'Qwen en espera':'Conectando…'}</span></span>
    <button className={styles.share} type="button" onClick={()=>void share()} aria-label="Compartir Lía"><Share2 size={15}/><span>Compartir</span></button>
    {signedIn?<div className={styles.profile} title={displayName}><span>{initials}</span><strong>{displayName.split(' ')[0]}</strong></div>:<a className={styles.signIn} href={signInPath} target="_top">Entrar <ArrowUpRight size={13}/></a>}
    <button className={styles.menuButton} type="button" onClick={()=>setMenu(value=>!value)} aria-label={menu?'Cerrar navegación de la casa':'Abrir navegación de la casa'} aria-expanded={menu} aria-controls="atlas-house-room-menu">{menu?<X size={19}/>:<Menu size={19}/>}</button>
   </div>
  </header>

  <nav className={styles.triadBar} aria-label="Pirámide de Lía: mente, cuerpo y cielo">
   <a className={styles.triadLabel} href="/arquitectura">LÍA</a>
   {triad.map(item=><button type="button" key={item.name} className={styles.triadBadge} onClick={()=>walk(item.room)}><strong>{item.name}</strong><small>{item.role}</small></button>)}
  </nav>

  <section className={`${styles.roomCard} ${!entered?styles.introCard:''}`} data-details-open={!entered||roomDetailsOpen} aria-label="Espacio actual" style={{'--room-accent':active.accent} as React.CSSProperties}>
   <div className={styles.eyebrow}><span>△</span> {entered?'ENTRAS EN LÍA':'ATLAS · ION · ÍCARO'}</div>
   <h1>{entered?(selectedPerson?.name||active.title):<>La pirámide vive<br/>en Lía.</>}</h1>
   <p>{entered?((selectedPerson?vocationFor(selectedPerson.id)?.title||selectedPerson.role:null)||active.description):'Atlas es la mente, Ion el cuerpo e Ícaro el cielo. Los tres desarrollan a Lía en este entorno compartido. Recorre sus habitaciones o elige adónde quieres ir.'}</p>
   {!entered?<button className={styles.enter} type="button" onClick={()=>walk('salon')}>Entrar en la casa <ArrowUpRight size={15}/></button>:<button className={styles.overview} type="button" onClick={overview}><Home size={13}/> Ver toda la casa</button>}
   {entered&&<button className={styles.detailsToggle} type="button" aria-expanded={roomDetailsOpen} aria-controls="atlas-house-room-details" onClick={()=>setRoomDetailsOpen(value=>!value)}>{roomDetailsOpen?'Ocultar detalles':'Ver detalles'} <span aria-hidden="true">{roomDetailsOpen?'−':'+'}</span></button>}
   <div className={styles.roomDetails} id="atlas-house-room-details" data-expanded={roomDetailsOpen}>
   {entered&&<details className={styles.mirrorLegend}><summary>Su espiral en Sites <span>{memory?.reflections||0} reflexiones</span></summary><p>{entity?.personality}</p><p>{memory?.consultation?`${memory.consultation.question} · ${memory.consultation.sourceIds.length} fuentes leídas · ${memory.consultation.status}`:memory?.conclusion||'Memoria preparada; todavía no tiene una consulta registrada en Sites.'}</p>{memory?.question&&<p>Pregunta pendiente: {memory.question}</p>}<a href="/espiral">Abrir memorias de salas, habitantes y módulos →</a></details>}
   {entered&&selectedPerson&&<ResidentPersonality id={selectedPerson.id}/>}
   <div className={styles.roomFoot}><i/>{sceneError?'3D no disponible en este navegador':api?'Entorno 3D en tiempo real':'Preparando el entorno…'}{performance&&performance.fps>0&&<span>{Math.round(performance.fps)} FPS</span>}</div>
   {entered&&HOUSE_FUNCTIONS.some(fn=>fn.room===room)&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}} aria-label="Herramientas del mobiliario">{HOUSE_FUNCTIONS.filter(fn=>fn.room===room).map(fn=><button key={fn.id} onClick={()=>activateFunction(fn.id)}>{fn.label} →</button>)}</div>}
   <p className={styles.compactChanges}>Cambios reportados: {acceptedChanges===null?'—':acceptedChanges.toLocaleString('es-ES')}</p>
   <details className={styles.mirrorLegend}>
    <summary>Espejo de procesos <span>{processState.connected?`${activeProcesses} en acción`:'Sin señal reciente'}</span></summary>
    <p>{WORKSTATIONS.length} puestos con habitantes y 6 espectadores. Los visitantes recorren las puertas hasta Ícaro al recibir una consulta real; los gestos de trabajo necesitan actividad comunicada.</p>
    <p>Al entrar en una sala se cargan humanos cercanos de ERAS con esqueleto y animaciones. Máximo dos en escritorio y uno en móvil; los sentados y las otras especies conservan su representación. El modo ligero evita nuevas descargas.</p><p>Los gestos de trabajo siguen tareas reales. Los recorridos que presentan las obras son animaciones programadas.</p>
    <strong>Cambios reportados en la espiral: {acceptedChanges===null?'—':acceptedChanges.toLocaleString('es-ES')}</strong>
    <p>El contador procede de telemetría reciente del coordinador, no acredita por sí solo integración ni verificación independiente.</p>
    <p>Las marcas junto a Ion conservan ese contador; la animación no añade mejoras ni proyectos.</p>
    <small title="ERAS · revisión 8a0fea077ccf84bed54d0b5c384dfc37b6aa4a86">Controles y render de ERAS · habitantes propios de Atlas</small>
   </details>
   <div className={styles.icarusStatus}>
    <span>CIELO · ÍCARO</span><strong>{consultationLabel}</strong>
    {latestConsultation?<small>{latestConsultation.sourceCount} referencias disponibles · {latestConsultation.usedReferenceCount} incorporadas al contexto de trabajo.<br/>{latestConsultation.phase==='blocked'?'Sin resultado nuevo: se conserva la pregunta para un intento posterior.':'El recorrido representa una consulta registrada; regresar con referencias no acredita todavía una mejora.'}</small>:<small>Los habitantes consultan fuentes antes de construir y contrastan el resultado después.</small>}
    {icarus&&<small>{icarus.completed.toLocaleString('es-ES')} consultas con referencias · {icarus.blocked.toLocaleString('es-ES')} sin resultado nuevo.</small>}
    <div><button type="button" onClick={()=>visitResident('sky-agents')} disabled={!api}>Visitar a Ícaro <ArrowUpRight size={13}/></button>{traveler&&<button type="button" onClick={()=>visitResident(traveler.id)} disabled={!api||!processState.connected}>Ver al visitante <ArrowUpRight size={13}/></button>}</div>
   </div>
   <div className={styles.evolutionStatus} aria-live="polite"><span>LA CASA QUE LA TRÍADA DESARROLLA</span><strong>{installation?'Aplicación 3D reportada en Lía':'Esperando un plan 3D válido para Lía'}</strong>{installation?<small>{installation.objects} formas · 6/6 contratos geométricos · {new Date(installation.at).toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}<br/>La calidad visual sigue pendiente de valoración.</small>:<small>Sus experiencias 3D se incorporan al taller y a la terraza, sin redesplegar la casa.</small>}<button type="button" disabled={!api||!installation} onClick={visitEvolution}>Ver la intervención para Lía <ArrowUpRight size={14}/></button></div>
   </div>
  </section>

  <div className={styles.controlLegend} aria-label="Controles de la casa"><span>↔ Arrastra para mirar</span><span>◉ Joystick para caminar</span><span className={styles.keyboard}>W A S D · moverse / E · usar</span></div>
  {sceneError&&<div className={styles.sceneError} role="status"><strong>La casa 3D no pudo abrirse en este navegador.</strong><p>{sceneError}</p><span>Puedes seguir entrando en cada espacio con los botones de abajo.</span></div>}
  <button className={styles.facility} type="button" onClick={()=>open(room)} style={{'--room-accent':active.accent} as React.CSSProperties} aria-label={active.action}><span className={styles.facilityIcon}><ActiveIcon size={20}/></span><span><small>{active.short.toUpperCase()}</small><strong>{active.action}</strong></span><ArrowUpRight size={18}/></button>

  <aside style={{position:"absolute",right:16,bottom:100,zIndex:7,width:"min(340px,calc(100vw - 32px))",maxHeight:"45vh",overflow:"auto",background:"#102e34ed",borderRadius:16,padding:12,color:"#eef7ef"}}><HouseWorkLoop signedIn={signedIn} onVisual={setHouseWork} onVisit={visitResident}/><LivingWorld room={room} onVisit={walk} onActivate={target=>{walk(target);api?.activateWork(target);}} onWork={(job,busy)=>{setLivingJob(job);setLivingBusy(busy);}}/></aside>
  <nav ref={roomNavigation} className={styles.roomNav} aria-label="Habitaciones de Atlas">{HOUSE_ROOMS.map(item=>{const value=rooms[item.id],Icon=value.icon;return <button type="button" key={item.id} className={room===item.id?styles.selectedRoom:''} data-room={item.id} aria-label={`Ir a ${value.title}`} aria-pressed={room===item.id} onClick={()=>walk(item.id)}><Icon size={17}/><span>{value.short}</span><i/></button>;})}</nav>
  {menu&&<><button className={styles.menuBackdrop} type="button" aria-label="Cerrar navegación de la casa" onClick={()=>setMenu(false)}/><nav id="atlas-house-room-menu" className={styles.menu} aria-label="Accesos de la casa"><span>¿ADÓNDE VAMOS?</span>{HOUSE_ROOMS.map(item=>{const value=rooms[item.id],Icon=value.icon;return <button type="button" key={item.id} onClick={()=>walk(item.id)}><Icon size={18}/><span>{value.title}<small>{value.description}</small></span><ArrowUpRight size={14}/></button>;})}<a href="/chat/" target="_blank" rel="noopener noreferrer">Chat en pantalla completa <ArrowUpRight size={14}/></a><a href="/origen/" target="_blank" rel="noopener noreferrer">Atlas original y herramientas <ArrowUpRight size={14}/></a></nav></>}
  {residentsOpen&&<aside ref={residentsPanel} tabIndex={-1} className={styles.residentsPanel} id="atlas-house-residents" aria-label="Puestos y habitantes de Lía"><header><div><span>UNA CASA PARA LÍA</span><h2>Habitantes y entornos</h2><p>{VOCATIONS.length} oficios · investigación por especialidad</p></div><button type="button" onClick={()=>{setResidentsOpen(false);residentsToggle.current?.focus();}} aria-label="Cerrar habitantes"><X size={18}/></button></header><p className={styles.rosterNote}>Cada especialista contribuye a Lía desde su función. Sus estados son reportados; una animación no acredita una mejora.</p><div className={styles.residentList}>{residentRuntime.map(resident=><button key={resident.id} type="button" disabled={!api} onClick={()=>visitResident(resident.id)} data-archetype={resident.archetype} className={selectedResident===resident.id?styles.selected:''}><i/><span><strong>{resident.name}</strong><small>{vocationFor(resident.id)?.title||resident.role}</small><small>{rooms[resident.room as HouseRoom].short}</small><em className={styles.statusPill} data-tone={resident.statusTone}>{resident.status}</em></span><ArrowUpRight size={14}/></button>)}</div><button className={styles.evolutionButton} type="button" disabled={!api} onClick={visitEvolution}>Ver evolución de la casa</button></aside>}
  {notice&&<div className={styles.toast} role="status">{notice}</div>}

  <dialog ref={dialog} className={styles.workspace} aria-labelledby="atlas-house-workspace-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}>
   {workspace&&<><div className={styles.workspaceHeader}><div><span>ATLAS / {rooms[workspace].short.toUpperCase()}</span><h2 id="atlas-house-workspace-title">{activeFunction?.label||rooms[workspace].title}</h2></div><div>{!activeFunction&&workspace==='salon'&&<a href="/chat/" target="_blank" rel="noopener noreferrer" aria-label="Abrir chat en otra pestaña"><ArrowUpRight size={17}/></a>}<button ref={closeButton} type="button" onClick={close} aria-label="Cerrar espacio y volver a la casa"><X size={20}/><span>Volver a la casa</span></button></div></div><div className={styles.workspaceBody} data-room={workspace}>
    {activeFunction&&<><p style={{padding:'12px 24px'}}>{activeFunction.utility}</p>{['memory','eras','research','chat'].includes(activeFunction.tool)&&<iframe className={styles.chatFrame} style={{minHeight:'65vh'}} title={activeFunction.label} src={activeFunction.tool==='memory'?'/origen?view=memory&scope='+encodeURIComponent(activeFunction.scope!):activeFunction.tool==='research'?'/origen?view=research':activeFunction.tool==='chat'?'/chat/':'/eras'}/>}
    {activeFunction.tool==='music'&&<MusicStudio ready={signedIn} signInPath={signInPath}/>}{activeFunction.tool==='cinema'&&<CinemaPanel houseApi={api} ready={signedIn}/>}{activeFunction.tool==='game'&&<WorldWorkshop mode="game" ready={signedIn}/>}{activeFunction.tool==='constellation'&&<ConstellationPanel ready={signedIn} onFollow={id=>{close();visitResident(id);}}/>}{activeFunction.tool==='observatory'&&<CoreObservatory mode={workspace==='language'?'language':'refutation'} telemetry={status?.capabilities?.processTelemetry} connected={connected} ready={signedIn} gpuMode={status?.capabilities?.gpuMode}/>}
    <p style={{padding:'0 24px'}}>Responsable: {residentById(activeFunction.owner)?.name} · <a href={'/origen?view=memory&scope='+encodeURIComponent('resident:'+activeFunction.owner)}>Desarrollar sus criterios y preferencias →</a></p><nav style={{display:'flex',gap:12,padding:16}} aria-label="Funciones relacionadas">{activeFunction.links.map(id=>{const next=houseFunction(id)!;return <button key={id} onClick={()=>{api?.teleport(next.room as HouseRoom);setRoom(next.room as HouseRoom);setWorkspace(next.room as HouseRoom);setActiveFunction(next);}}>{next.label} →</button>;})}</nav></>}{!activeFunction&&workspace==='salon'&&<iframe className={styles.chatFrame} title="Conversar con Lía" src="/chat/" allow="clipboard-write"/>}
    {!activeFunction&&workspace==='body'&&<p style={{padding:20}}><a href="/eras/">Abrir ERAS · motor gráfico de Ion →</a></p>}{!activeFunction&&workspace==='music'&&<MusicStudio ready={signedIn} signInPath={signInPath}/>}
    {!activeFunction&&(workspace==='lab'||workspace==='games')&&<WorldWorkshop mode={workspace==='lab'?'3d':'game'} ready={signedIn}/>}
    {!activeFunction&&workspace==='cinema'&&<CinemaPanel houseApi={api} ready={signedIn}/>}
    {!activeFunction&&workspace==='constellation'&&<ConstellationPanel ready={signedIn} onFollow={id=>{setWorkspace(null);visitResident(id);}}/>}
    {!activeFunction&&(workspace==='mind'||workspace==='body'||workspace==='refutation'||workspace==='language')&&<CoreObservatory mode={workspace} telemetry={status?.capabilities?.processTelemetry} connected={connected} ready={signedIn} gpuMode={status?.capabilities?.gpuMode}/>}
   </div></>}
  </dialog>
 <dialog ref={charterDialog} className={styles.charterDialog}><LiaEvolution onClose={()=>charterDialog.current?.close()}/></dialog></main>;
}
