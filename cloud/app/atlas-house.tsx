'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,AudioLines,Brain,Clapperboard,FlaskConical,Gamepad2,Home,Languages,Menu,MessageCircle,Orbit,Share2,ShieldCheck,Wrench,X,type LucideIcon} from 'lucide-react';
import HouseScene,{HOUSE_ROOMS,type HouseAPI,type HousePerformance,type HouseRoom,type HouseInstallation} from './house-scene';
import MusicStudio from './music-studio';
import WorldWorkshop from './world-workshop';
import CinemaPanel from './cinema-panel';
import ConstellationPanel from './constellation-panel';
import CoreObservatory,{type CoreTelemetry} from './core-observatory';
import styles from './atlas-house.module.css';
import {RESIDENTS,WORKSTATIONS,residentById,processForResident} from '../public/house/residents.js';
import {readCreativePreview} from './experience-creative-preview';

type HouseResident={id:string;room:HouseRoom;name:string;role:string;archetype:string;processIds:string[];cosmetic:boolean;activePhases?:string[]};
type Props={signedIn:boolean;displayName:string;signInPath:string};
type Status={online:boolean;modelName?:string;lastSeen?:string|null;capabilities?:{gpuMode?:'chat'|'video'|'training';processTelemetry?:(CoreTelemetry&{experience?:{creative?:unknown}|null})|null}};
const rooms:Record<HouseRoom,{title:string;short:string;description:string;action:string;icon:LucideIcon;accent:string}>={
 salon:{title:'El salón de Atlas',short:'Salón',description:'Un lugar para conversar, conectar ideas y decidir qué construir.',action:'Hablar con Atlas',icon:MessageCircle,accent:'#a8e5ce'},
 music:{title:'El estudio de música',short:'Música',description:'Enciende un ritmo, toca una melodía y llévate tu audio.',action:'Hacer música',icon:AudioLines,accent:'#e7be7c'},
 lab:{title:'El laboratorio',short:'Laboratorio',description:'Transforma una idea en un entorno 3D que puedas explorar.',action:'Crear en 3D',icon:FlaskConical,accent:'#a7cde4'},
 games:{title:'El taller de mundos',short:'Videojuegos',description:'Diseña un mundo, prueba una mecánica y empieza a jugar.',action:'Crear un videojuego',icon:Gamepad2,accent:'#c6afe6'},
 cinema:{title:'La sala de cine',short:'Cine',description:'Encuadra la casa, graba una toma y explora las herramientas de vídeo.',action:'Crear un vídeo',icon:Clapperboard,accent:'#e6ad91'},
 constellation:{title:'Cielo · La constelación',short:'Constelación',description:'Fuentes y colaboradores para contrastar. Dios / Suceso conserva también lo que ninguna perspectiva consigue explicar.',action:'Abrir constelación',icon:Orbit,accent:'#a7d8df'},
 mind:{title:'Mente · El archivo vivo',short:'Mente',description:'Observaciones, memoria y preguntas con una perspectiva situada.',action:'Explorar la mente',icon:Brain,accent:'#a6cfea'},
 body:{title:'Animal · El cuerpo de Ion',short:'Ion',description:'Herramientas, recursos y acciones que se pueden ejecutar y comprobar.',action:'Entrar en el cuerpo de Ion',icon:Wrench,accent:'#e2bd8e'},
 refutation:{title:'La cámara de refutación',short:'Refutación',description:'Prueba una candidata, conserva sus errores y compara antes de cambiar.',action:'Ver pruebas y refutaciones',icon:ShieldCheck,accent:'#d4b9e7'},
 language:{title:'LOR-ΩΣ · El lenguaje',short:'LOR-ΩΣ',description:'La notación original de Atlas, sus marcos y un laboratorio que se puede ejecutar.',action:'Abrir LOR-ΩΣ',icon:Languages,accent:'#bbe2b2'},
};

export default function AtlasHouse({signedIn,displayName,signInPath}:Props){
 const[residentsOpen,setResidentsOpen]=useState(false),[selectedResident,setSelectedResident]=useState<string|null>(null),[installation,setInstallation]=useState<HouseInstallation|null>(null),[roomDetailsOpen,setRoomDetailsOpen]=useState(false);
 const residentsPanel=useRef<HTMLElement>(null),residentsToggle=useRef<HTMLButtonElement>(null);
 const[room,setRoom]=useState<HouseRoom>('salon'),[entered,setEntered]=useState(false),[workspace,setWorkspace]=useState<HouseRoom|null>(null),[menu,setMenu]=useState(false),[api,setApi]=useState<HouseAPI|null>(null),[performance,setPerformance]=useState<HousePerformance|null>(null),[status,setStatus]=useState<Status|null>(null),[statusFailed,setStatusFailed]=useState(false),[notice,setNotice]=useState(''),[sceneError,setSceneError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),closeButton=useRef<HTMLButtonElement>(null),previousFocus=useRef<HTMLElement|null>(null),lastRequested=useRef<HouseRoom|null>(null),pollBusy=useRef(false),roomNavigation=useRef<HTMLElement>(null);
 const active=rooms[room],ActiveIcon=active.icon;
 useEffect(()=>{
  let alive=true;const controller=new AbortController();
  async function poll(){if(pollBusy.current||document.hidden)return;pollBusy.current=true;try{const response=await fetch('/api/cloud/status',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8000)])});if(!response.ok)throw Error('Estado no disponible');const data=await response.json() as Status;if(alive){setStatus(data);setStatusFailed(false);}}catch{if(alive)setStatusFailed(true);}finally{pollBusy.current=false;}}
  void poll();const timer=setInterval(()=>void poll(),10000),visibility=()=>{if(!document.hidden)void poll();};document.addEventListener('visibilitychange',visibility);
  return()=>{alive=false;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 const ready=useCallback((value:HouseAPI)=>{setApi(value);setSceneError('');if(lastRequested.current)value.teleport(lastRequested.current);},[]);
 const walk=useCallback((next:HouseRoom)=>{setRoomDetailsOpen(false);setEntered(true);setRoom(next);setSelectedResident(null);setResidentsOpen(false);setMenu(false);lastRequested.current=next;api?.teleport(next);},[api]);
 const open=useCallback((next:HouseRoom)=>{setRoomDetailsOpen(false);setRoom(next);setEntered(true);setMenu(false);previousFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setWorkspace(next);},[]);
 const close=useCallback(()=>setWorkspace(null),[]);
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
 const share=async()=>{try{const data={title:'Atlas · Casa de ideas',text:'Un espacio para conversar, crear música y construir mundos con Atlas.',url:location.origin+'/'};if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(data.url);setNotice('Enlace de Atlas copiado. Cada persona tendrá su propio historial.');}}catch(error){if(error instanceof Error&&error.name==='AbortError')return;setNotice('Puedes compartir la dirección de esta página desde el navegador.');}};
 const overview=()=>{setRoomDetailsOpen(false);setEntered(false);setMenu(false);setSelectedResident(null);setResidentsOpen(false);lastRequested.current=null;api?.overview();};
 const initials=(displayName||'Tu espacio').slice(0,1).toUpperCase();
 const connected=status?.online===true&&!statusFailed;
 const processState=useMemo(()=>{const telemetry=status?.capabilities?.processTelemetry;if(!telemetry)return {connected:false,processes:[]};const age=telemetry.at?Date.now()-Date.parse(telemetry.at):Infinity,fresh=connected&&Number.isFinite(age)&&age>=0&&age<=75000;return {at:telemetry.at||undefined,connected:fresh,processes:fresh?telemetry.processes:telemetry.processes.map(process=>({...process,state:'waiting' as const}))};},[status?.capabilities?.processTelemetry,connected]);
 const creative=useMemo(()=>readCreativePreview(status?.capabilities?.processTelemetry?.experience?.creative),[status?.capabilities?.processTelemetry?.experience?.creative]);
 const selectedPerson=selectedResident?residentById(selectedResident):null;
 const visitResident=(id:string)=>{const resident=residentById(id);if(!resident)return;setRoomDetailsOpen(false);setResidentsOpen(false);setEntered(true);setRoom(resident.room as HouseRoom);setSelectedResident(id);api?.focusResident(id);};
 const visitEvolution=()=>{setRoomDetailsOpen(false);setResidentsOpen(false);setEntered(true);setRoom('games');setSelectedResident(null);api?.focusEvolution();};
 useEffect(()=>{if(!residentsOpen)return;residentsPanel.current?.focus();const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setResidentsOpen(false);residentsToggle.current?.focus();}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[residentsOpen]);
 const activeProcesses=processState.connected?processState.processes.filter(process=>process.state==='running').length:0;
 const rawChanges=processState.processes.find(process=>process.id==='experience')?.counters?.accepted;
 const acceptedChanges=typeof rawChanges==='number'&&Number.isSafeInteger(rawChanges)&&rawChanges>=0?rawChanges:null;

 return <main className={styles.house}>
  <div className={styles.scene}><HouseScene creative={creative} onCreativeApplied={setInstallation} onResidentFocus={setSelectedResident} processState={processState} paused={workspace!==null&&workspace!=='cinema'} onRoomChange={next=>{setRoomDetailsOpen(false);setRoom(next);}} onInteract={open} onReady={ready} onPerformance={setPerformance} onError={message=>{setSceneError(message);setPerformance(null);}}/></div>
  <div className={styles.vignette}/>
  <header className={styles.topbar}>
   <a className={styles.brand} href="/" aria-label="Atlas, tu casa de ideas"><svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="22" stroke="currentColor" opacity=".23"/><path d="m24 9 16 28H8L24 9Z" stroke="currentColor" opacity=".6"/><path d="M12 25q12-14 24 0-12 14-24 0Z" stroke="currentColor"/><circle cx="24" cy="25" r="4" fill="currentColor"/></svg><span>atlas<small>UNA CASA PARA TUS IDEAS</small></span></a>
   <div className={styles.topActions}>
    <button ref={residentsToggle} className={styles.residentToggle} type="button" aria-expanded={residentsOpen} aria-controls="atlas-house-residents" aria-label="Ver los habitantes y visitar cada puesto" onClick={()=>setResidentsOpen(value=>!value)}><span>{RESIDENTS.length}</span> Habitantes</button>
    <a className={styles.activityLink} href="/actividad/" aria-label="Ver actividad y herramientas de Atlas"><Brain size={16}/><span>Actividad</span></a>
    <span className={`${styles.modelBadge} ${status?.online&&!statusFailed?styles.online:''}`} title={statusFailed?'No se pudo comprobar el estado del PC.':status?.online?status.capabilities?.gpuMode==='video'?'La GPU está generando vídeo. Qwen volverá al terminar.':status.capabilities?.gpuMode==='training'?'La GPU está entrenando una candidata separada. El modelo activo no se sustituye.':`${status.modelName||'Qwen'} responde desde tu PC.`:'El puente del PC no está disponible. Puedes seguir usando las funciones locales.'}><i/><span>{statusFailed?'Estado sin verificar':status?.online?status.capabilities?.gpuMode==='video'?'GPU en vídeo':status.capabilities?.gpuMode==='training'?'Entrenando candidata':'Qwen en tu PC':status?'Qwen en espera':'Conectando…'}</span></span>
    <button className={styles.share} type="button" onClick={()=>void share()} aria-label="Compartir Atlas"><Share2 size={15}/><span>Compartir</span></button>
    {signedIn?<div className={styles.profile} title={displayName}><span>{initials}</span><strong>{displayName.split(' ')[0]}</strong></div>:<a className={styles.signIn} href={signInPath} target="_top">Entrar <ArrowUpRight size={13}/></a>}
    <button className={styles.menuButton} type="button" onClick={()=>setMenu(value=>!value)} aria-label={menu?'Cerrar navegación de la casa':'Abrir navegación de la casa'} aria-expanded={menu} aria-controls="atlas-house-room-menu">{menu?<X size={19}/>:<Menu size={19}/>}</button>
   </div>
  </header>

  <section className={`${styles.roomCard} ${!entered?styles.introCard:''}`} data-details-open={!entered||roomDetailsOpen} aria-label="Espacio actual" style={{'--room-accent':active.accent} as React.CSSProperties}>
   <div className={styles.eyebrow}><span>△</span> {entered?'ESTÁS EN CASA':'ATLAS / CASA DE IDEAS'}</div>
   <h1>{entered?(selectedPerson?.name||active.title):<>Cada idea<br/>tiene su lugar.</>}</h1>
   <p>{entered?(selectedPerson?.role||active.description):'Una casa para hablar, hacer música, explorar preguntas y construir mundos. Recorre sus habitaciones o elige adónde quieres ir.'}</p>
   {!entered?<button className={styles.enter} type="button" onClick={()=>walk('salon')}>Entrar en la casa <ArrowUpRight size={15}/></button>:<button className={styles.overview} type="button" onClick={overview}><Home size={13}/> Ver toda la casa</button>}
   {entered&&<button className={styles.detailsToggle} type="button" aria-expanded={roomDetailsOpen} aria-controls="atlas-house-room-details" onClick={()=>setRoomDetailsOpen(value=>!value)}>{roomDetailsOpen?'Ocultar detalles':'Ver detalles'} <span aria-hidden="true">{roomDetailsOpen?'−':'+'}</span></button>}
   <div className={styles.roomDetails} id="atlas-house-room-details" data-expanded={roomDetailsOpen}>
   <div className={styles.roomFoot}><i/>{sceneError?'3D no disponible en este navegador':api?'Entorno 3D en tiempo real':'Preparando el entorno…'}{performance&&performance.fps>0&&<span>{Math.round(performance.fps)} FPS</span>}</div>
   <p className={styles.compactChanges}>Cambios medidos: {acceptedChanges===null?'—':acceptedChanges.toLocaleString('es-ES')}</p>
   <details className={styles.mirrorLegend}>
    <summary>Espejo de procesos <span>{processState.connected?`${activeProcesses} en acción`:'Sin señal reciente'}</span></summary>
    <p>{WORKSTATIONS.length} puestos con habitantes y 6 espectadores. Humanos, robots, animales y aves permanecen en su lugar; los gestos de trabajo necesitan actividad real.</p>
    <p>Los gestos siguen trabajo comunicado por el PC. Sin datos recientes se detienen; los adornos son cosméticos.</p>
    <strong>Cambios medidos en la espiral: {acceptedChanges===null?'—':acceptedChanges.toLocaleString('es-ES')}</strong>
    <p>Las marcas junto a Ion conservan ese contador; la animación no añade mejoras ni proyectos.</p>
    <small title="ERAS · revisión 8a0fea077ccf84bed54d0b5c384dfc37b6aa4a86">Controles y render de ERAS · habitantes propios de Atlas</small>
   </details>
   <div className={styles.evolutionStatus} aria-live="polite"><span>LA CASA QUE ATLAS CONSTRUYE</span><strong>{installation?'Intervención 3D integrada':'Esperando un plan 3D validado'}</strong>{installation?<small>{installation.objects} formas · 6/6 contratos geométricos · {new Date(installation.at).toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}<br/>La calidad visual sigue pendiente de valoración.</small>:<small>Sus experiencias 3D se incorporan al taller y a la terraza, sin redesplegar la casa.</small>}<button type="button" disabled={!api||!installation} onClick={visitEvolution}>Ver la intervención de Atlas <ArrowUpRight size={14}/></button></div>
   </div>
  </section>

  <div className={styles.controlLegend} aria-label="Controles de la casa"><span>↔ Arrastra para mirar</span><span>◉ Joystick para caminar</span><span className={styles.keyboard}>W A S D · moverse / E · usar</span></div>
  {sceneError&&<div className={styles.sceneError} role="status"><strong>La casa 3D no pudo abrirse en este navegador.</strong><p>{sceneError}</p><span>Puedes seguir entrando en cada espacio con los botones de abajo.</span></div>}
  <button className={styles.facility} type="button" onClick={()=>open(room)} style={{'--room-accent':active.accent} as React.CSSProperties} aria-label={active.action}><span className={styles.facilityIcon}><ActiveIcon size={20}/></span><span><small>{active.short.toUpperCase()}</small><strong>{active.action}</strong></span><ArrowUpRight size={18}/></button>

  <nav ref={roomNavigation} className={styles.roomNav} aria-label="Habitaciones de Atlas">{HOUSE_ROOMS.map(item=>{const value=rooms[item.id],Icon=value.icon;return <button type="button" key={item.id} className={room===item.id?styles.selectedRoom:''} data-room={item.id} aria-label={`Ir a ${value.title}`} aria-pressed={room===item.id} onClick={()=>walk(item.id)}><Icon size={17}/><span>{value.short}</span><i/></button>;})}</nav>
  {menu&&<><button className={styles.menuBackdrop} type="button" aria-label="Cerrar navegación de la casa" onClick={()=>setMenu(false)}/><nav id="atlas-house-room-menu" className={styles.menu} aria-label="Accesos de la casa"><span>¿ADÓNDE VAMOS?</span>{HOUSE_ROOMS.map(item=>{const value=rooms[item.id],Icon=value.icon;return <button type="button" key={item.id} onClick={()=>walk(item.id)}><Icon size={18}/><span>{value.title}<small>{value.description}</small></span><ArrowUpRight size={14}/></button>;})}<a href="/chat/" target="_blank" rel="noopener noreferrer">Chat en pantalla completa <ArrowUpRight size={14}/></a><a href="/origen/" target="_blank" rel="noopener noreferrer">Atlas original y herramientas <ArrowUpRight size={14}/></a></nav></>}
  {residentsOpen&&<aside ref={residentsPanel} tabIndex={-1} className={styles.residentsPanel} id="atlas-house-residents" aria-label="Puestos y habitantes de Atlas"><header><div><span>UNA CASA HABITADA</span><h2>Un puesto, un habitante.</h2><p>{WORKSTATIONS.length} puestos · 6 espectadores</p></div><button type="button" onClick={()=>{setResidentsOpen(false);residentsToggle.current?.focus();}} aria-label="Cerrar habitantes"><X size={18}/></button></header><p className={styles.rosterNote}>Representan funciones de Atlas. No son modelos independientes; un personaje quieto conserva su puesto.</p><div className={styles.residentList}>{RESIDENTS.map((resident:HouseResident)=>{const live=processForResident(processState,resident,{ageMs:0}).workVerified;return <button key={resident.id} type="button" disabled={!api} onClick={()=>visitResident(resident.id)} data-archetype={resident.archetype}><i/><span><strong>{resident.name}</strong><small>{resident.role}</small><em>{rooms[resident.room as HouseRoom].short} · {resident.cosmetic?'Ambientación':live?'Actividad comunicada':'En su puesto'}</em></span><ArrowUpRight size={14}/></button>;})}</div></aside>}
  {notice&&<div className={styles.toast} role="status">{notice}</div>}

  <dialog ref={dialog} className={styles.workspace} aria-labelledby="atlas-house-workspace-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}>
   {workspace&&<><div className={styles.workspaceHeader}><div><span>ATLAS / {rooms[workspace].short.toUpperCase()}</span><h2 id="atlas-house-workspace-title">{rooms[workspace].title}</h2></div><div>{workspace==='salon'&&<a href="/chat/" target="_blank" rel="noopener noreferrer" aria-label="Abrir chat en otra pestaña"><ArrowUpRight size={17}/></a>}<button ref={closeButton} type="button" onClick={close} aria-label="Cerrar espacio y volver a la casa"><X size={20}/><span>Volver a la casa</span></button></div></div><div className={styles.workspaceBody} data-room={workspace}>
    {workspace==='salon'&&<iframe className={styles.chatFrame} title="Conversar con Atlas" src="/chat/" allow="clipboard-write"/>}
    {workspace==='music'&&<MusicStudio/>}
    {(workspace==='lab'||workspace==='games')&&<WorldWorkshop mode={workspace==='lab'?'3d':'game'} ready={signedIn}/>}
    {workspace==='cinema'&&<CinemaPanel houseApi={api} ready={signedIn}/>}
    {workspace==='constellation'&&<ConstellationPanel/>}
    {(workspace==='mind'||workspace==='body'||workspace==='refutation'||workspace==='language')&&<CoreObservatory mode={workspace} telemetry={status?.capabilities?.processTelemetry} connected={connected} ready={signedIn} gpuMode={status?.capabilities?.gpuMode}/>}
   </div></>}
  </dialog>
 </main>;
}
