'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import styles from './house-scene.module.css';
import type {PublicCreativePreview} from './experience-creative-preview';

export type HouseRoom='salon'|'music'|'lab'|'games'|'cinema'|'constellation'|'mind'|'body'|'refutation'|'language';
export const HOUSE_ROOMS:ReadonlyArray<{id:HouseRoom;title:string;label:string}>=[
 {id:'salon',title:'Lía · Entorno compartido',label:'Lía'},
 {id:'music',title:'Estudio de música',label:'Música'},
 {id:'lab',title:'Laboratorio',label:'Laboratorio'},
 {id:'games',title:'Taller de mundos',label:'Mundos'},
 {id:'cinema',title:'Sala de cine',label:'Cine'},
 {id:'constellation',title:'Cielo · Constelación',label:'Constelación'},
 {id:'mind',title:'Mente · Archivo vivo',label:'Mente'},
 {id:'body',title:'Animal · Cuerpo de Ion',label:'Ion'},
 {id:'refutation',title:'Cámara de refutación',label:'Refutación'},
 {id:'language',title:'LOR-ΩΣ · Lenguaje',label:'LOR-ΩΣ'},
];
export type HouseProcess={id:string;room?:HouseRoom;label?:string;phase?:'observe'|'understand'|'connect'|'apply'|'refute'|'retain';state:'idle'|'running'|'passed'|'failed'|'waiting';counters?:{observations?:number;trials?:number;accepted?:number;rejected?:number}};
export type HouseIcarusEvent={residentId?:string;id:string;phase:'seeking'|'consulting'|'returning'|'blocked';processId:string;focus:string;at:string;startedAt:string;sourceCount:number;usedReferenceCount:number;outcome:string};
export type HouseIcarusStatus={schema:1;active:HouseIcarusEvent|null;recent:HouseIcarusEvent[];total:number;completed:number;blocked:number};
export type HouseProcessState={houseWork?:import('./house-work-loop').HouseWorkVisual|null;at?:string;connected?:boolean;processes:HouseProcess[];icarus?:HouseIcarusStatus|null};
export type HouseInstallation={applied:true;artifactId:string;at:string;objects:number;cases:6;passed:6;renderVerified:false;source:'coordinator'|'retained'};
export type HouseFilmShot={room:string;seconds:number;framing:'wide'|'medium'|'detail';movement:'orbit'|'push'|'still'};
export type HouseRecording={url:string;mime:string;filename:string;bytes:number;method:string};
export type HousePerformance={fps:number;frames:number;drawCalls:number;triangles:number;backend:string};
export type HousePeopleStatus={enabled:boolean;active:number;loading:boolean;failed:boolean;limit:number};
export type HouseAPI={
 setPeopleDetail:(enabled:boolean)=>void;
 teleport:(room:HouseRoom)=>void;
 overview:()=>void;
 focusResident:(id:string)=>void;
 focusEvolution:()=>void;
 activateWork:(room:HouseRoom)=>void;
 setCreativeState:(value:PublicCreativePreview|null)=>void;
 capture:()=>Promise<string>;
 record:(options?:{seconds?:number;rooms?:string[];shots?:HouseFilmShot[]})=>Promise<HouseRecording>;
 revoke:(url:string)=>void;
 pause:(value:boolean)=>void;
 setProcessState:(value:HouseProcessState)=>void;
};
type Props={onPeopleStatus?:(value:HousePeopleStatus)=>void;creative?:PublicCreativePreview|null;onCreativeApplied?:(value:HouseInstallation)=>void;onResidentFocus?:(id:string)=>void;activeRoom?:HouseRoom;processState?:HouseProcessState;paused?:boolean;embedded?:boolean;className?:string;onRoomChange?:(room:HouseRoom)=>void;onInteract?:(room:HouseRoom)=>void;onReady?:(api:HouseAPI)=>void;onPerformance?:(value:HousePerformance)=>void;onError?:(message:string)=>void};
const validRoom=(value:unknown):value is HouseRoom=>typeof value==='string'&&HOUSE_ROOMS.some(room=>room.id===value);

export function HouseScene(props:Props){
 const frame=useRef<HTMLIFrameElement>(null),latest=useRef(props),currentRoom=useRef<HouseRoom|null>(null),pending=useRef(new Map<string,{resolve:(value:unknown)=>void;reject:(error:Error)=>void;timeout:ReturnType<typeof setTimeout>}>());
 const[ready,setReady]=useState(false),[error,setError]=useState<string|null>(null);latest.current=props;
 const api=useMemo<HouseAPI>(()=>{
  const send=(type:string,value:Record<string,unknown>={})=>frame.current?.contentWindow?.postMessage({type:'atlas:house:'+type,...value},location.origin);
  function request<T>(kind:string,value:Record<string,unknown>,duration:number):Promise<T>{
   return new Promise((resolve,reject)=>{
    if(!frame.current?.contentWindow){reject(Error('El entorno todavía no está listo.'));return;}
    const requestId=crypto.randomUUID(),timeout=setTimeout(()=>{pending.current.delete(requestId);reject(Error('El navegador no pudo completar la exportación a tiempo.'));},duration);
    pending.current.set(requestId,{resolve:result=>resolve(result as T),reject,timeout});send(kind,{requestId,...value});
   });
  }
  return {setPeopleDetail:value=>send('people',{value}),teleport:room=>send('teleport',{room}),overview:()=>send('overview'),focusResident:id=>send('resident',{id}),focusEvolution:()=>send('evolution'),activateWork:room=>send('work',{room}),setCreativeState:value=>send('creative',{value}),capture:()=>request<string>('capture',{},8000),record:options=>{const seconds=Math.max(2,Math.min(16,options?.seconds||8));return request<HouseRecording>('record',{seconds,rooms:options?.rooms,shots:options?.shots},seconds*1000+10000);},revoke:url=>send('revoke',{url}),pause:value=>send('pause',{value}),setProcessState:value=>send('processes',{value})};
 },[]);
 useEffect(()=>{
  const requests=pending.current;
  // The iframe can finish loading before this effect attaches its listener, so
  // retry the handshake until the runtime answers instead of relying on onLoad.
  const ping=()=>frame.current?.contentWindow?.postMessage({type:'atlas:house:hello'},location.origin);
  let attempts=0,helloTimer:ReturnType<typeof setInterval>|undefined;
  function stopHello(){if(helloTimer){clearInterval(helloTimer);helloTimer=undefined;}}
  function receive(event:MessageEvent){
   if(event.origin!==location.origin||event.source!==frame.current?.contentWindow||!event.data||typeof event.data!=='object')return;
   const data=event.data;
   if(data.type==='atlas:house:people'&&data.value&&typeof data.value==='object'&&typeof data.value.enabled==='boolean'){const v=data.value;latest.current.onPeopleStatus?.({enabled:v.enabled,active:Array.isArray(v.active)?Math.min(2,v.active.length):0,loading:Array.isArray(v.loading)&&v.loading.length>0,failed:Array.isArray(v.failed)&&v.failed.length>0,limit:v.limit===0?0:v.limit===1?1:2});}
   if(data.type==='atlas:house:ready'){setReady(true);setError(null);api.pause(latest.current.paused===true);latest.current.onReady?.(api);}
   if(data.type==='atlas:house:room'&&validRoom(data.room)){currentRoom.current=data.room;latest.current.onRoomChange?.(data.room);}
   if(data.type==='atlas:house:interact'&&validRoom(data.room))latest.current.onInteract?.(data.room);
   if(data.type==='atlas:house:performance'&&[data.fps,data.frames,data.drawCalls,data.triangles].every(value=>typeof value==='number'&&Number.isFinite(value)))latest.current.onPerformance?.({fps:data.fps,frames:data.frames,drawCalls:data.drawCalls,triangles:data.triangles,backend:String(data.backend)});
   if(data.type==='atlas:house:resident'&&typeof data.id==='string'&&/^[a-z0-9-]{1,64}$/.test(data.id))latest.current.onResidentFocus?.(data.id);
   if(data.type==='atlas:house:creative'){
    const value=data.value;if(value?.applied===true&&typeof value.artifactId==='string'&&/^creative-[a-f0-9]{24}$/.test(value.artifactId)&&typeof value.at==='string'&&Number.isFinite(Date.parse(value.at))&&Number.isInteger(value.objects)&&value.objects>=1&&value.objects<=8&&value.cases===6&&value.passed===6)latest.current.onCreativeApplied?.({applied:true,artifactId:value.artifactId,at:value.at,objects:value.objects,cases:6,passed:6,renderVerified:false,source:value.source==='retained'?'retained':'coordinator'});
   }
   if(data.type==='atlas:house:error'){const message=typeof data.message==='string'?data.message:'No se pudo abrir el entorno 3D.';setError(message);latest.current.onError?.(message);}
   if(data.type==='atlas:house:result'&&typeof data.requestId==='string'){
    const task=requests.get(data.requestId);if(!task)return;clearTimeout(task.timeout);requests.delete(data.requestId);if(typeof data.error==='string')task.reject(Error(data.error));else task.resolve(data.result);
   }
  }
  window.addEventListener('message',receive);
  ping();helloTimer=setInterval(()=>{if(++attempts>=40){stopHello();return;}ping();},500);
  return()=>{stopHello();window.removeEventListener('message',receive);frame.current?.contentWindow?.postMessage({type:'atlas:house:destroy'},location.origin);for(const task of requests.values()){clearTimeout(task.timeout);task.reject(Error('El entorno se cerró.'));}requests.clear();};
 },[api]);
 useEffect(()=>{if(ready&&props.activeRoom&&props.activeRoom!==currentRoom.current)api.teleport(props.activeRoom);},[api,props.activeRoom,ready]);
 useEffect(()=>{if(ready)api.pause(props.paused===true);},[api,props.paused,ready]);
 useEffect(()=>{if(ready&&props.processState)api.setProcessState(props.processState);},[api,props.processState,ready]);
 useEffect(()=>{if(ready)api.setCreativeState(props.creative||null);},[api,props.creative,ready]);
 return <div className={[styles.scene,props.className||''].join(' ')} data-house-ready={ready} aria-busy={!ready&&!error}>
  <iframe ref={frame} onLoad={()=>frame.current?.contentWindow?.postMessage({type:'atlas:house:hello'},location.origin)} title="Casa de Atlas: entorno 3D navegable" src={'/house/index.html?v=quality1'+(props.embedded===false?'':'&embedded=1')} allow="fullscreen; autoplay" className={styles.frame} />
 </div>;
}

export default HouseScene;
