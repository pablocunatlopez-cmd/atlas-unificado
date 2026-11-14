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

type HouseResident={id:string;room:HouseRoom;name:string;role:string;archetype:string;processIds:string[];cosmetic:boolean;activePhases?:string[];status?:string;statusTone?:'idle'|'running'|'passed'|'failed'|'waiting'};
type Props={signedIn:boolean;displayName:string;signInPath:string};
type Status={online:boolean;modelName?:string;lastSeen?:string|null;capabilities?:{gpuMode?:'chat'|'video'|'training';processTelemetry?:(CoreTelemetry&{experience?:{creative?:unknown}|null})|null};failed?:boolean};
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
  const[residentsOpen,setResidentsOpen]=useState(false),[selectedResident,setSelectedResident]=useState<string|null>(null),[installation,setInstallation]=useState<HouseInstallation|null>(null),[roomDetailsOpen,setRoomDetailsOpen]=useState(false),[status,setStatus]=useState<Status|null>(null),[statusFailed,setStatusFailed]=useState(false),[notice,setNotice]=useState('');
  const residentsPanel=useRef<HTMLElement>(null),residentsToggle=useRef<HTMLButtonElement>(null);
  const[room,setRoom]=useState<HouseRoom>('salon'),[entered,setEntered]=useState(false),[workspace,setWorkspace]=useState<HouseRoom|null>(null),[menu,setMenu]=useState(false),[api,setApi]=useState<HouseAPI|null>(null),[performance,setPerformance]=useState<HousePerformance|undefined>(undefined),[sceneError,setSceneError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null),closeButton=useRef<HTMLButtonElement>(null),previousFocus=useRef<HTMLElement|null>(null),lastRequested=useRef<HouseRoom|null>(null),pollBusy=useRef(false),roomNavigation=useRef<HTMLElement|null>(null);
  const active=rooms[room],ActiveIcon=active.icon;
  const triad=[{name:'Atlas',role:'mente'},{name:'Ion',role:'cuerpo'},{name:'Ícaro',role:'cielo + constelación'}];

  useEffect(()=>{
    let alive=true;const controller=new AbortController();
    async function poll(){
      if(pollBusy.current||document.hidden)return;
      pollBusy.current=true;
      try{
        const response=await fetch('/api/cloud/status',{cache:'no-store',signal:controller.signal});
        if(!response.ok)throw new Error('');
        const data=await response.json() as Status;
        if(alive){ setStatus(data); setStatusFailed(false); }
      }catch{
        if(alive){ setStatusFailed(true); }
      }finally{
        if(alive) pollBusy.current=false;
      }
    }
    void poll();const timer=setInterval(()=>void poll(),10000),visibility=()=>{if(!document.hidden)void poll();};document.addEventListener('visibilitychange',visibility);
    return()=>{alive=false;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visibility);};
  },[]);

  const ready=useCallback((value:HouseAPI)=>{setApi(value);setSceneError('');if(lastRequested.current)value.teleport(lastRequested.current);},[]);
  const walk=useCallback((next:HouseRoom)=>{setRoomDetailsOpen(false);setEntered(true);setRoom(next);setSelectedResident(null);setResidentsOpen(false);setMenu(false);lastRequested.current=next;api?.teleport(next);},[api]);
  const open=useCallback((next:HouseRoom)=>{setRoomDetailsOpen(false);setRoom(next);setEntered(true);setMenu(false);previousFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setWorkspace(next);},[]);
  const close=useCallback(()=>setWorkspace(null),[]);
  const deepLinkHandled=useRef(false);
  useEffect(()=>{if(deepLinkHandled.current||!api)return;deepLinkHandled.current=true;const requested=new URLSearchParams(location.search).get('room');if(requested&&Object.hasOwn(rooms,requested)){const next=requested as HouseRoom; lastRequested.current=next; api.teleport(next); setRoom(next); setEntered(true);}},[api]);
  useEffect(()=>{const current=dialog.current;if(!current)return;if(workspace){if(!current.open)current.showModal();closeButton.current?.focus();}else if(current.open){current.close();previousFocus.current?.focus();}},[workspace]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{if(!menu)return;const key=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape')setMenu(false);};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[menu]);
  useEffect(()=>{const nav=roomNavigation.current,button=nav?.querySelector<HTMLButtonElement>(`[data-room="${room}"]`);if(!nav||!button)return;const left=button.offsetLeft,right=left+button.offsetWidth;nav.scrollTo({left:Math.max(0,left-((nav.clientWidth-right)/2)),behavior:'smooth'});},[room]);

  const share=async()=>{try{const data={title:'Atlas · Casa de ideas',text:'Un espacio para conversar, crear música y construir mundos con Atlas.',url:location.origin+'/'};if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(`${data.title}\n${data.text}\n${data.url}`);setNotice('Enlace copiado.');}}catch{setNotice('No se pudo compartir esta vista.');}};
  const overview=()=>{setRoomDetailsOpen(false);setEntered(false);setMenu(false);setSelectedResident(null);setResidentsOpen(false);lastRequested.current=null;api?.overview();};
  const initials=(displayName||'Tu espacio').slice(0,1).toUpperCase();
  const connected=status?.online===true&&!statusFailed;
  const processState=useMemo(()=>{const telemetry=status?.capabilities?.processTelemetry;if(!telemetry)return {connected:false,processes:[]};const age=telemetry.at?Date.now()-Date.parse(telemetry.at):Infinity; return {connected:age<60000,processes:telemetry.processes??[]};},[status?.capabilities?.processTelemetry]);
  const creative=useMemo(()=>readCreativePreview(status?.capabilities?.processTelemetry?.experience?.creative),[status?.capabilities?.processTelemetry?.experience?.creative]);
  const selectedPerson=selectedResident?residentById(selectedResident):null;
  const residentRuntime=useMemo<HouseResident[]>(()=>RESIDENTS.filter((resident)=>!resident.cosmetic).map((resident)=>{
    const result=processForResident(processState,resident,{ageMs:60000});
    const toneMap={idle:'idle',running:'running',passed:'passed',failed:'failed',waiting:'waiting'} as const;
    return {
      ...resident,
      status: result.displayState ?? 'En espera',
      statusTone: toneMap[(result.state as keyof typeof toneMap)] ?? 'waiting'
    };
  }),[processState]);
  const visitResident=(id:string)=>{const resident=residentById(id);if(!resident)return;setRoomDetailsOpen(false);setResidentsOpen(false);setEntered(true);setRoom(resident.room as HouseRoom);setSelectedResident(id);setWorkspace(null);};
  const visitEvolution=()=>{setRoomDetailsOpen(false);setResidentsOpen(false);setEntered(true);setRoom('games');setSelectedResident(null);api?.focusEvolution();};
  useEffect(()=>{if(!residentsOpen)return;residentsPanel.current?.focus();const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setResidentsOpen(false);residentsToggle.current?.focus();}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[residentsOpen]);
  const activeProcesses=processState.connected?processState.processes.filter(process=>process.state==='running').length:0;
  const rawChanges=processState.processes.find(process=>process.id==='experience')?.counters?.accepted;
  const acceptedChanges=typeof rawChanges==='number'&&Number.isSafeInteger(rawChanges)&&rawChanges>=0?rawChanges:null;

  return <main className={styles.house}>
   <div className={styles.scene}><HouseScene creative={creative} onCreativeApplied={setInstallation} onResidentFocus={setSelectedResident} processState={processState} paused={workspace!==null&&workspace!==undefined} onPerformance={setPerformance} onError={setSceneError} onReady={ready} /></div>
   <div className={styles.vignette}/>
   <header className={styles.topbar}>
    <a className={styles.brand} href="/" aria-label="Lía, la casa de ideas"><svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="22" stroke="currentColor" opacity=".8"/><path d="M8 24h32M24 8v32" stroke="currentColor" opacity=".4"/><circle cx="24" cy="24" r="8" fill="currentColor" opacity=".12"/></svg><span>Lía</span></a>
    <div className={styles.topActions}>
     <button ref={residentsToggle} className={styles.residentToggle} type="button" aria-expanded={residentsOpen} aria-controls="atlas-house-residents" aria-label="Ver los habitantes y visitar cada entorno de Lía"><Home size={15}/><span>Habitantes</span></button>
     <a className={styles.activityLink} href="/actividad/" aria-label="Ver actividad y herramientas de Atlas"><Brain size={16}/><span>Actividad</span></a>
     <span className={`${styles.modelBadge} ${status?.online&&!statusFailed?styles.online:''}`} title={statusFailed?'No se pudo comprobar el estado del PC.':status?.online?status.capabilities?.gpuMode?`GPU: ${status.capabilities.gpuMode}`:'Estado del PC disponible':'Sin conexión del PC'}>{status?.online&&!statusFailed?'En línea':'Sin enlace'}</span>
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
    <p>{entered?(selectedPerson?.role||active.description):'Atlas aporta la mente, Ion el cuerpo, Ícaro el cielo y la constelación; Lía es el objetivo del entorno y la casa que se mejora a sí misma.'}</p>
    {!entered?<button className={styles.enter} type="button" onClick={()=>walk('salon')}>Entrar en la casa <ArrowUpRight size={15}/></button>:<button className={styles.overview} type="button" onClick={overview}>Volver a la visión general</button>}
    {entered&&<button className={styles.detailsToggle} type="button" aria-expanded={roomDetailsOpen} aria-controls="atlas-house-room-details" onClick={()=>setRoomDetailsOpen(value=>!value)}>{roomDetailsOpen?'Cerrar detalles':'Ver detalles'}</button>}
    <div className={styles.roomDetails} id="atlas-house-room-details" data-expanded={roomDetailsOpen}>
     <div className={styles.roomFoot}><i/>{sceneError?'3D no disponible en este navegador':api?'Entorno 3D en tiempo real':'Preparando el entorno…'}{performance&&performance.fps>0&&<span>{Math.round(performance.fps)} FPS</span>}</div>
     <p className={styles.compactChanges}>Cambios medidos: {acceptedChanges===null?'—':acceptedChanges.toLocaleString('es-ES')}</p>
     <details className={styles.mirrorLegend} open>
      <summary>Espejo de procesos <span>{processState.connected?`${activeProcesses} en acción`:'Sin señal reciente'}</span></summary>
      <p>{WORKSTATIONS.length} puestos con habitantes y 6 espectadores. La casa de Lía solo mejora cuando las tareas reales se ejecutan y se verifican.</p>
      <p>Mientras el juego está abierto, cada vértice cumple su función: Atlas observa, Ion ejecuta, Ícaro conecta y Lía se vuelve mejor.</p>
      <strong>Cambios medidos en la espiral: {acceptedChanges===null?'—':acceptedChanges.toLocaleString('es-ES')}</strong>
      <p>Las marcas junto a Ion vigilan la mejora real; la animación no sustituye ni crea proyectos por sí sola.</p>
      <small title="ERAS · revisión 8a0fea077ccf84bed54d0b5c384dfc37b6aa4a86">Lía, Atlas, Ion e Ícaro · entorno vivo de la casa</small>
     </details>
     <div className={styles.evolutionStatus} aria-live="polite"><span>LA CASA QUE ATLAS CONSTRUYE</span><strong>{installation?'Intervención 3D integrada en Lía':'Esperando un plan 3D validado para Lía'}</strong>{installation?<button type="button" onClick={()=>setWorkspace('lab')}>Revisar entorno</button>:null}</div>
    </div>
   </section>

   <div className={styles.controlLegend} aria-label="Controles de la casa"><span>↔ Arrastra para mirar</span><span>◉ Joystick para caminar</span><span className={styles.keyboard}>W A S D · mover</span></div>
   {sceneError&&<div className={styles.sceneError} role="status"><strong>La casa 3D no pudo abrirse en este navegador.</strong><p>{sceneError}</p><span>Puedes seguir entrando en cada espacio con la arquitectura de Lía.</span></div>}
   <button className={styles.facility} type="button" onClick={()=>open(room)} style={{'--room-accent':active.accent} as React.CSSProperties} aria-label={active.action}><span className={styles.facilityIcon}><ActiveIcon size={15}/></span><span>{active.action}</span></button>

   <nav ref={roomNavigation} className={styles.roomNav} aria-label="Habitaciones de Atlas">{HOUSE_ROOMS.map(item=>{const value=rooms[item.id],Icon=value.icon;return <button type="button" key={item.id} data-room={item.id} className={room===item.id?styles.active:''} onClick={()=>walk(item.id)} style={{'--room-accent':value.accent} as React.CSSProperties}><Icon size={15}/><span>{value.short}</span></button>;})}</nav>
   {menu&&<><button className={styles.menuBackdrop} type="button" aria-label="Cerrar navegación de la casa" onClick={()=>setMenu(false)}/><nav id="atlas-house-room-menu" className={styles.menu} aria-label="Menú de la casa">{HOUSE_ROOMS.map(item=><button type="button" key={item.id} className={room===item.id?styles.active:''} onClick={()=>open(item.id)}><span>{rooms[item.id].title}</span><ArrowUpRight size={13}/></button>)}</nav></>}
   {residentsOpen&&<aside ref={residentsPanel} tabIndex={-1} className={styles.residentsPanel} id="atlas-house-residents" aria-label="Puestos y habitantes de Lía"><header><div><span>UNA CASA PARA LÍA</span><h2>Habitantes y entornos</h2></div><button type="button" onClick={()=>setResidentsOpen(false)} aria-label="Cerrar panel de habitantes"><X size={16}/></button></header><div className={styles.residentList}>{residentRuntime.map(resident=><button type="button" key={resident.id} className={selectedResident===resident.id?styles.selected:''} onClick={()=>visitResident(resident.id)}><span>{resident.name}</span><small>{resident.role}</small><em className={styles.statusPill} data-tone={resident.statusTone}>{resident.status}</em></button>)}</div><button className={styles.evolutionButton} type="button" onClick={visitEvolution}>Ver evolución</button></aside>}
   {notice&&<div className={styles.toast} role="status">{notice}</div>}

   <dialog ref={dialog} className={styles.workspace} aria-labelledby="atlas-house-workspace-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}>
    {workspace&&<><div className={styles.workspaceHeader}><div><span>ATLAS / {rooms[workspace].short.toUpperCase()}</span><h2 id="atlas-house-workspace-title">{rooms[workspace].title}</h2></div><button type="button" className={styles.closeWorkspace} onClick={close} aria-label="Cerrar espacio"> <X size={16}/> </button></div>
     {workspace==='salon'&&<iframe className={styles.chatFrame} title="Conversar con Atlas" src="/chat/" allow="clipboard-write"/>}
     {workspace==='music'&&<MusicStudio/>}
     {(workspace==='lab'||workspace==='games')&&<WorldWorkshop mode={workspace==='lab'?'3d':'game'} ready={signedIn}/>} 
     {workspace==='cinema'&&<CinemaPanel houseApi={api} ready={signedIn}/>} 
     {workspace==='constellation'&&<ConstellationPanel/>}
     {(workspace==='mind'||workspace==='body'||workspace==='refutation'||workspace==='language')&&<CoreObservatory mode={workspace} telemetry={status?.capabilities?.processTelemetry} connected={connected}/>} 
    </>}
   </dialog>
  </main>;
}
