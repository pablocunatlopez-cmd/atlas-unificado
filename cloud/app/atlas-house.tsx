'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,AudioLines,Brain,Camera,Clapperboard,Eye,FlaskConical,Gamepad2,Home,Languages,Menu,MessageCircle,Orbit,Share2,ShieldCheck,Wrench,X,type LucideIcon} from 'lucide-react';
import HouseScene,{HOUSE_ROOMS,type HouseAPI,type HousePerformance,type HouseRoom,type HouseInstallation} from './house-scene';
import MusicStudio from './music-studio';
import LiaEvolution from './lia-evolution';
import WorldWorkshop from './world-workshop';
import CinemaPanel from './cinema-panel';
import ConstellationPanel from './constellation-panel';
import CoreObservatory,{type CoreTelemetry} from './core-observatory';
import styles from './atlas-house.module.css';
import LiveWorkOptIn from './live-work-opt-in';
import {RESIDENTS,WORKSTATIONS,residentById,processForResident} from '../public/house/residents.js';
import {telemetryAge,TELEMETRY_FRESH_MS} from '../public/house/process-state.js';
import {readCreativePreview} from './experience-creative-preview';

type ResidentRecord={id:string;room:HouseRoom;name:string;role:string;archetype:string;processIds:string[];cosmetic:boolean;activePhases?:string[]};
type HouseResident=ResidentRecord&{status?:string;statusTone?:'idle'|'running'|'passed'|'failed'|'waiting'};
type Props={signedIn:boolean;displayName:string;signInPath:string};
type Status={online:boolean;modelName?:string;lastSeen?:string|null;capabilities?:{gpuMode?:'chat'|'video'|'training';processTelemetry?:(CoreTelemetry&{experience?:{creative?:unknown}|null})|null};failed?:boolean};
type ResidentMemory={id:string;processId:string;state:string;phase:string|null;text:string;at:string;observedAt:string};
function ageLabel(ageMs:number|null){
 if(ageMs===null)return 'sin hora válida';
 const seconds=Math.max(0,Math.round(ageMs/1000));
 if(seconds<5)return 'ahora';
 if(seconds<60)return `hace ${seconds} s`;
 const minutes=Math.round(seconds/60);
 if(minutes<60)return `hace ${minutes} min`;
 return `hace ${Math.round(minutes/60)} h`;
}
const rooms:Record<HouseRoom,{title:string;short:string;description:string;action:string;icon:LucideIcon;accent:string}>={
  salon:{title:'Lía · Salón de Atlas',short:'Salón',description:'Atlas piensa, conecta y formula la identidad de Lía desde la mente.',action:'Hablar con Atlas',icon:MessageCircle,accent:'#a8e5ce'},
  music:{title:'Lía · Estudio de música',short:'Música',description:'El sonido da forma al alma de Lía y ayuda a que la casa respire.',action:'Hacer música',icon:AudioLines,accent:'#e7be7c'},
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
  const[residentsOpen,setResidentsOpen]=useState(false),[selectedResident,setSelectedResident]=useState<string|null>(null),[installation,setInstallation]=useState<HouseInstallation|null>(null),[roomDetailsOpen,setRoomDetailsOpen]=useState(false),[status,setStatus]=useState<Status|null>(null),[statusAt,setStatusAt]=useState(0),[statusFailed,setStatusFailed]=useState(false),[notice,setNotice]=useState('');
  const[residentMemories,setResidentMemories]=useState<ResidentMemory[]>([]),[memoryError,setMemoryError]=useState('');
  const[charterOpen,setCharterOpen]=useState(false);
  const residentsPanel=useRef<HTMLElement>(null),residentsToggle=useRef<HTMLButtonElement>(null),charterDialog=useRef<HTMLDialogElement>(null);
  const[room,setRoom]=useState<HouseRoom>('salon'),[entered,setEntered]=useState(false),[workspace,setWorkspace]=useState<HouseRoom|null>(null),[menu,setMenu]=useState(false),[api,setApi]=useState<HouseAPI|null>(null),[performance,setPerformance]=useState<HousePerformance|undefined>(undefined),[sceneError,setSceneError]=useState(''),[capturing,setCapturing]=useState(false),[hudHidden,setHudHidden]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null),closeButton=useRef<HTMLButtonElement>(null),previousFocus=useRef<HTMLElement|null>(null),lastRequested=useRef<HouseRoom|null>(null),pollBusy=useRef(false),roomNavigation=useRef<HTMLElement|null>(null);
  const active=rooms[room],ActiveIcon=active.icon;
  const triad=[{name:'Atlas',role:'mente'},{name:'Ion',role:'cuerpo'},{name:'Ícaro',role:'cielo + constelación'}];

  useEffect(()=>{
    let alive=true;const controller=new AbortController();
    // Hard timeout so a hung network never leaves the UI in an ambiguous "checking" state.
    // Combined with the existing freshness window this fails closed (P2 truthful visibility).
    const STATUS_TIMEOUT_MS=8000;
    async function poll(){
      if(pollBusy.current||document.hidden)return;
      pollBusy.current=true;
      const timeout=new AbortController();
      const timer=setTimeout(()=>timeout.abort(),STATUS_TIMEOUT_MS);
      const signal=AbortSignal.any([controller.signal,timeout.signal]);
      try{
        const response=await fetch('/api/cloud/status',{cache:'no-store',signal});
        if(!response.ok)throw new Error('status_http_'+response.status);
        const data=await response.json() as Status;
        if(alive){ setStatus(data); setStatusAt(Date.now()); setStatusFailed(false); }
      }catch(error){
        // Aborted by unmount must not flip the badge; timeout/network/HTTP do.
        if(alive&&!controller.signal.aborted){ setStatusFailed(true); }
      }finally{
        clearTimeout(timer);
        if(alive) pollBusy.current=false;
      }
    }
    void poll();const interval=setInterval(()=>void poll(),10000),visibility=()=>{if(!document.hidden)void poll();};document.addEventListener('visibilitychange',visibility);
    return()=>{alive=false;controller.abort();clearInterval(interval);document.removeEventListener('visibilitychange',visibility);};
  },[]);

  const ready=useCallback((value:HouseAPI)=>{setApi(value);setSceneError('');if(lastRequested.current)value.teleport(lastRequested.current);},[]);
  const walk=useCallback((next:HouseRoom)=>{setRoomDetailsOpen(false);setEntered(true);setRoom(next);setSelectedResident(null);setResidentsOpen(false);setMenu(false);lastRequested.current=next;api?.teleport(next);},[api]);
  const open=useCallback((next:HouseRoom)=>{setRoomDetailsOpen(false);setRoom(next);setEntered(true);setMenu(false);previousFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setWorkspace(next);},[]);
  const close=useCallback(()=>setWorkspace(null),[]);
  const deepLinkHandled=useRef(false);
  useEffect(()=>{if(deepLinkHandled.current||!api)return;deepLinkHandled.current=true;const requested=new URLSearchParams(location.search).get('room');if(requested&&Object.hasOwn(rooms,requested)){const next=requested as HouseRoom; lastRequested.current=next; api.teleport(next); setRoom(next); setEntered(true);}},[api]);
  useEffect(()=>{const current=dialog.current;if(!current)return;if(workspace){if(!current.open)current.showModal();closeButton.current?.focus();}else if(current.open){current.close();previousFocus.current?.focus();}},[workspace]);
  useEffect(()=>{const current=charterDialog.current;if(!current)return;if(charterOpen&&!current.open)current.showModal();else if(!charterOpen&&current.open)current.close();},[charterOpen]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{if(!menu)return;const key=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape')setMenu(false);};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[menu]);
  useEffect(()=>{const key=(event:globalThis.KeyboardEvent)=>{if(event.key.toLowerCase()!=='h'||event.metaKey||event.ctrlKey||event.altKey||workspace)return;const target=event.target as HTMLElement|null;if(target&&['INPUT','TEXTAREA','SELECT'].includes(target.tagName))return;setHudHidden(value=>!value);};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[workspace]);
  useEffect(()=>{const nav=roomNavigation.current,button=nav?.querySelector<HTMLButtonElement>(`[data-room="${room}"]`);if(!nav||!button)return;const left=button.offsetLeft,right=left+button.offsetWidth;nav.scrollTo({left:Math.max(0,left-((nav.clientWidth-right)/2)),behavior:'smooth'});},[room]);

  const share=async()=>{try{const data={title:'Atlas · Casa de ideas',text:'Un espacio para conversar, crear música y construir mundos con Atlas.',url:location.origin+'/'};if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(`${data.title}\n${data.text}\n${data.url}`);setNotice('Enlace copiado.');}}catch{setNotice('No se pudo compartir esta vista.');}};
  const captureView=async()=>{if(!api||capturing)return;setCapturing(true);try{const url=await api.capture();const link=document.createElement('a');link.href=url;link.download='atlas-casa-3d.png';link.click();setNotice('Imagen PNG de la casa capturada.');}catch(problem){setNotice(problem instanceof Error?problem.message:'No se pudo capturar la imagen.');}finally{setCapturing(false);}};
  const overview=()=>{setRoomDetailsOpen(false);setEntered(false);setMenu(false);setSelectedResident(null);setResidentsOpen(false);lastRequested.current=null;api?.overview();};
  const initials=(displayName||'Tu espacio').slice(0,1).toUpperCase();
  const connected=status?.online===true&&!statusFailed;
  const processState=useMemo(()=>{const telemetry=status?.capabilities?.processTelemetry;if(!telemetry)return {connected:false,processes:[],ageMs:null,available:false};const ageMs=telemetryAge(telemetry.at,{now:statusAt});return {connected:telemetry.connected!==false&&ageMs!==null&&ageMs<=TELEMETRY_FRESH_MS,processes:telemetry.processes??[],ageMs,available:true};},[status?.capabilities?.processTelemetry,statusAt]);
  const creative=useMemo(()=>readCreativePreview(status?.capabilities?.processTelemetry?.experience?.creative),[status?.capabilities?.processTelemetry?.experience?.creative]);
  const selectedPerson=selectedResident?residentById(selectedResident):null;
  useEffect(()=>{
    if(!selectedResident){setResidentMemories([]);setMemoryError('');return;}
    let alive=true;const controller=new AbortController();setResidentMemories([]);setMemoryError('');
    fetch('/api/house/memory?resident='+encodeURIComponent(selectedResident),{cache:'no-store',signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error('');const data=await response.json() as {memories?:ResidentMemory[]};if(alive)setResidentMemories(Array.isArray(data.memories)?data.memories:[]);})
      .catch(()=>{if(alive&&!controller.signal.aborted)setMemoryError('No se pudo leer la memoria de este habitante.');});
    return()=>{alive=false;controller.abort();};
  },[selectedResident]);
  const residentRuntime=useMemo<HouseResident[]>(()=>RESIDENTS.map((resident:ResidentRecord)=>{
    const result=processForResident(processState,resident,{ageMs:processState.ageMs??Infinity});
    const toneMap={idle:'idle',running:'running',passed:'passed',failed:'failed',waiting:'waiting'} as const;
    return {
      ...resident,
      status: result.displayState ?? 'En espera',
      statusTone: toneMap[(result.state as keyof typeof toneMap)] ?? 'waiting'
    };
  }),[processState]);
  const visitResident=(id:string)=>{const resident=residentById(id);if(!resident)return;setRoomDetailsOpen(false);setResidentsOpen(false);setEntered(true);setRoom(resident.room as HouseRoom);setSelectedResident(id);setWorkspace(null);api?.focusResident(id);};
  const visitEvolution=()=>{setRoomDetailsOpen(false);setResidentsOpen(false);setEntered(true);setRoom('games');setSelectedResident(null);api?.focusEvolution();};
  useEffect(()=>{if(!residentsOpen)return;residentsPanel.current?.focus();const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setResidentsOpen(false);residentsToggle.current?.focus();}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[residentsOpen]);
  const activeProcesses=processState.connected?processState.processes.filter(process=>process.state==='running').length:0;
  const rawChanges=processState.connected?processState.processes.find(process=>process.id==='experience')?.counters?.accepted:undefined;
  const acceptedChanges=typeof rawChanges==='number'&&Number.isSafeInteger(rawChanges)&&rawChanges>=0?rawChanges:null;
  const signalLabel=!processState.available?'Sin señal reciente':processState.connected?`${activeProcesses} en acción · ${ageLabel(processState.ageMs)}`:processState.ageMs===null?'Señal con hora no válida':`Sin señal reciente · ${ageLabel(processState.ageMs)}`;

  return <main className={`${styles.house} ${hudHidden?styles.cleanView:''}`}>
   <div className={styles.scene}><HouseScene creative={creative} onCreativeApplied={setInstallation} onResidentFocus={setSelectedResident} processState={processState} paused={workspace!==null&&workspace!==undefined} onPerformance={setPerformance} onError={setSceneError} onReady={ready} /></div>
   <div className={styles.vignette}/>
   <header className={styles.topbar}>
    <a className={styles.brand} href="/" aria-label="Lía, la casa de ideas"><svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="22" stroke="currentColor" opacity=".8"/><path d="M8 24h32M24 8v32" stroke="currentColor" opacity=".4"/><circle cx="24" cy="24" r="8" fill="currentColor" opacity=".12"/></svg><span>Lía</span></a>
    <div className={styles.topActions}>
     <button ref={residentsToggle} className={styles.residentToggle} type="button" aria-expanded={residentsOpen} aria-controls="atlas-house-residents" aria-label={`Ver los ${RESIDENTS.length} habitantes y visitar cada entorno de Lía`}><Home size={15}/><span>Habitantes</span></button>
     <a className={styles.activityLink} href="/actividad/" aria-label="Ver actividad y herramientas de Atlas"><Brain size={16}/><span>Actividad</span></a>
     <button className={styles.viewButton} type="button" onClick={()=>void captureView()} disabled={!api||capturing} aria-label="Capturar imagen PNG de la casa 3D" title="Capturar imagen PNG de la casa 3D"><Camera size={15}/></button>
     <button className={styles.viewButton} type="button" onClick={()=>setHudHidden(true)} aria-label="Ocultar la interfaz para ver la casa (tecla H)" title="Ocultar interfaz (H)"><Eye size={15}/></button>
     <span className={`${styles.modelBadge} ${status?.online&&!statusFailed?styles.online:''}`} title={statusFailed?'No se pudo comprobar el estado del PC (red, timeout o servidor).':status?.online?status.capabilities?.gpuMode?`GPU: ${status.capabilities.gpuMode}`:'Estado del PC disponible':'Sin conexión del PC'}>{status?.online&&!statusFailed?'En línea':'Sin enlace'}</span>
     <LiveWorkOptIn room={room} bridgeOnline={connected}/>
     <button className={styles.share} type="button" onClick={()=>void share()} aria-label="Compartir Lía"><Share2 size={15}/><span>Compartir</span></button>
     {signedIn?<div className={styles.profile} title={displayName}><span>{initials}</span><strong>{displayName.split(' ')[0]}</strong></div>:<a className={styles.signIn} href={signInPath} target="_top">Iniciar sesión</a>}
     <button className={styles.menuButton} type="button" onClick={()=>setMenu(value=>!value)} aria-label={menu?'Cerrar navegación de la casa':'Abrir navegación de la casa'} aria-expanded={menu} aria-controls="atlas-house-room-menu"><Menu size={18}/></button>
    </div>
   </header>

   <div className={styles.triadBar} aria-label="Pirámide de Lía">
    <span className={styles.triadLabel}>LÍA</span>
    {triad.map(item=><div key={item.name} className={styles.triadBadge}><strong>{item.name}</strong><small>{item.role}</small></div>)}
   </div>

   <section className={`${styles.roomCard} ${!entered?styles.introCard:''}`} data-details-open={!entered||roomDetailsOpen} aria-label="Espacio actual" style={{'--room-accent':active.accent} as React.CSSProperties}>
    <div className={styles.eyebrow}><span>△</span> {entered?'ENTRAS EN LÍA':'ATLAS · ION · ÍCARO'}</div>
    <h1>{entered?(selectedPerson?.name||active.title):<>La pirámide vive<br/>en Lía.</>}</h1>
    <p>{entered?(selectedPerson?.role||active.description):'Atlas aporta la mente, Ion el cuerpo, Ícaro el cielo y la constelación; Lía es el objetivo del entorno y la casa que representa el estado reportado.'}</p>
    {entered&&selectedPerson&&<div className={styles.residentMemory} aria-live="polite"><span>MEMORIA OBSERVADA</span>{memoryError?<p>{memoryError}</p>:selectedPerson.processIds.length===0?<p>Este puesto no tiene un proceso asignado; no se inventan recuerdos.</p>:residentMemories.length===0?<p>Sin resultados terminales registrados todavía.</p>:<ul>{residentMemories.slice(0,3).map(memory=><li key={memory.id}><p>{memory.text}</p><small>{new Date(memory.at).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short',timeZone:'UTC'})} UTC</small></li>)}</ul>}<small>Observaciones automáticas desde telemetría fresca del coordinador. No acreditan aprendizaje, verificación independiente ni consciencia.</small></div>}
    {!entered?<button className={styles.enter} type="button" onClick={()=>walk('salon')}>Entrar en la casa <ArrowUpRight size={15}/></button>:<button className={styles.overview} type="button" onClick={overview}>Volver a la visión general</button>}
    {entered&&<button className={styles.detailsToggle} type="button" aria-expanded={roomDetailsOpen} aria-controls="atlas-house-room-details" onClick={()=>setRoomDetailsOpen(value=>!value)}>{roomDetailsOpen?'Cerrar detalles':'Ver detalles'}</button>}
    <div className={styles.roomDetails} id="atlas-house-room-details" data-expanded={roomDetailsOpen}>
     <div className={styles.roomFoot}><i/>{sceneError?'3D no disponible en este navegador':api?'Entorno 3D en tiempo real':'Preparando el entorno…'}{performance&&performance.fps>0&&<span>{Math.round(performance.fps)} FPS</span>}</div>
     <p className={styles.compactChanges}>Cambios reportados: {acceptedChanges===null?'—':acceptedChanges.toLocaleString('es-ES')}</p>
     <details className={styles.mirrorLegend} open>
      <summary>Espejo de procesos <span>{signalLabel}</span></summary>
      <p>{WORKSTATIONS.length} puestos con habitantes y 6 espectadores. La telemetría reporta actividad; no constituye verificación independiente ni integración.</p>
      <p>Mientras el juego está abierto, cada vértice cumple su función: Atlas observa, Ion actúa, Ícaro conecta el horizonte.</p>
     </details>
    </div>
   </section>

   <nav ref={roomNavigation} className={styles.roomDock} id="atlas-house-room-menu" aria-label="Salas de Lía">
    {HOUSE_ROOMS.map(id=>{const meta=rooms[id];const Icon=meta.icon;return <button key={id} type="button" data-room={id} className={room===id?styles.roomActive:undefined} onClick={()=>walk(id)} aria-current={room===id?'true':undefined}><Icon size={15}/><span>{meta.short}</span></button>;})}
   </nav>

   <aside ref={residentsPanel} id="atlas-house-residents" className={`${styles.residentsPanel} ${residentsOpen?styles.residentsOpen:''}`} tabIndex={-1} aria-label="Habitantes de Lía">
    <div className={styles.residentsHead}><strong>Habitantes</strong><button type="button" onClick={()=>setResidentsOpen(false)} aria-label="Cerrar panel de habitantes"><X size={16}/></button></div>
    <ul className={styles.residentsList}>{residentRuntime.map(person=><li key={person.id}><button type="button" onClick={()=>visitResident(person.id)} data-tone={person.statusTone}><span>{person.name}</span><small>{person.role}</small><em>{person.status}</em></button></li>)}</ul>
    <button type="button" className={styles.evolutionLink} onClick={visitEvolution}>Carta de evolución de Lía</button>
   </aside>

   {menu&&<div className={styles.mobileMenu} role="dialog" aria-label="Navegación"><button type="button" onClick={()=>setMenu(false)}>Cerrar</button>{HOUSE_ROOMS.map(id=><button key={id} type="button" onClick={()=>walk(id)}>{rooms[id].short}</button>)}</div>}

   {notice&&<div className={styles.notice} role="status">{notice}</div>}

   <dialog ref={dialog} className={styles.workspace} aria-labelledby="atlas-house-workspace-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}>
    {workspace&&<><div className={styles.workspaceHeader}><div><span>ATLAS / {rooms[workspace].short.toUpperCase()}</span><h2 id="atlas-house-workspace-title">{rooms[workspace].title}</h2></div><button type="button" className={styles.closeWorkspace} onClick={close} aria-label="Cerrar espacio"> <X size={16}/> </button></div>
     {workspace==='salon'&&<iframe className={styles.chatFrame} title="Conversar con Atlas" src="/chat/" allow="clipboard-write"/>}
     {workspace==='music'&&<MusicStudio/>}
     {(workspace==='lab'||workspace==='games')&&<WorldWorkshop mode={workspace==='lab'?'3d':'game'} ready={signedIn}/>} 
     {workspace==='cinema'&&<CinemaPanel houseApi={api} ready={signedIn}/>} 
     {workspace==='constellation'&&<ConstellationPanel/>}
     {(workspace==='mind'||workspace==='body'||workspace==='refutation'||workspace==='language')&&<CoreObservatory mode={workspace} telemetry={status?.capabilities?.processTelemetry} connected={connected} ready={signedIn} gpuMode={status?.capabilities?.gpuMode}/>}
    </>}
   </dialog>
   <dialog ref={charterDialog} className={styles.charterDialog} aria-labelledby="lia-charter-title" onCancel={event=>{event.preventDefault();setCharterOpen(false);}} onClick={event=>{if(event.target===event.currentTarget)setCharterOpen(false);}}>
    <LiaEvolution onClose={()=>setCharterOpen(false)}/>
   </dialog>
  </main>;
}
