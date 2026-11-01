'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import styles from './house-scene.module.css';

export type HouseRoom='salon'|'music'|'lab'|'games'|'cinema'|'constellation'|'mind'|'body'|'refutation'|'language';
export const HOUSE_ROOMS:ReadonlyArray<{id:HouseRoom;title:string;label:string}>=[
 {id:'salon',title:'Salón de Atlas',label:'Atlas'},
 {id:'music',title:'Estudio de música',label:'Música'},
 {id:'lab',title:'Laboratorio',label:'Laboratorio'},
 {id:'games',title:'Taller de mundos',label:'Mundos'},
 {id:'cinema',title:'Sala de cine',label:'Cine'},
 {id:'constellation',title:'Dios · Constelación',label:'Constelación'},
 {id:'mind',title:'Mente · Archivo vivo',label:'Mente'},
 {id:'body',title:'Animal · Cuerpo de Ion',label:'Ion'},
 {id:'refutation',title:'Cámara de refutación',label:'Refutación'},
 {id:'language',title:'LOR-ΩΣ · Lenguaje',label:'LOR-ΩΣ'},
];
export type HouseProcess={id:string;room?:HouseRoom;label?:string;phase?:'observe'|'understand'|'connect'|'apply'|'refute'|'retain';state:'idle'|'running'|'passed'|'failed'|'waiting';counters?:{observations?:number;trials?:number;accepted?:number;rejected?:number}};
export type HouseProcessState={at?:string;processes:HouseProcess[]};
export type HouseRecording={url:string;mime:string;filename:string;bytes:number;method:string};
export type HousePerformance={fps:number;frames:number;drawCalls:number;triangles:number;backend:string};
export type HouseAPI={
 teleport:(room:HouseRoom)=>void;
 overview:()=>void;
 capture:()=>Promise<string>;
 record:(options?:{seconds?:number})=>Promise<HouseRecording>;
 revoke:(url:string)=>void;
 pause:(value:boolean)=>void;
 setProcessState:(value:HouseProcessState)=>void;
};
type Props={activeRoom?:HouseRoom;processState?:HouseProcessState;paused?:boolean;embedded?:boolean;className?:string;onRoomChange?:(room:HouseRoom)=>void;onInteract?:(room:HouseRoom)=>void;onReady?:(api:HouseAPI)=>void;onPerformance?:(value:HousePerformance)=>void;onError?:(message:string)=>void};
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
  return {teleport:room=>send('teleport',{room}),overview:()=>send('overview'),capture:()=>request<string>('capture',{},8000),record:options=>{const seconds=Math.max(2,Math.min(16,options?.seconds||8));return request<HouseRecording>('record',{seconds},seconds*1000+10000);},revoke:url=>send('revoke',{url}),pause:value=>send('pause',{value}),setProcessState:value=>send('processes',{value})};
 },[]);
 useEffect(()=>{
  const requests=pending.current;
  function receive(event:MessageEvent){
   if(event.origin!==location.origin||event.source!==frame.current?.contentWindow||!event.data||typeof event.data!=='object')return;
   const data=event.data;
   if(data.type==='atlas:house:ready'){setReady(true);setError(null);api.pause(latest.current.paused===true);latest.current.onReady?.(api);}
   if(data.type==='atlas:house:room'&&validRoom(data.room)){currentRoom.current=data.room;latest.current.onRoomChange?.(data.room);}
   if(data.type==='atlas:house:interact'&&validRoom(data.room))latest.current.onInteract?.(data.room);
   if(data.type==='atlas:house:performance'&&[data.fps,data.frames,data.drawCalls,data.triangles].every(value=>typeof value==='number'&&Number.isFinite(value)))latest.current.onPerformance?.({fps:data.fps,frames:data.frames,drawCalls:data.drawCalls,triangles:data.triangles,backend:String(data.backend)});
   if(data.type==='atlas:house:error'){const message=typeof data.message==='string'?data.message:'No se pudo abrir el entorno 3D.';setError(message);latest.current.onError?.(message);}
   if(data.type==='atlas:house:result'&&typeof data.requestId==='string'){
    const task=requests.get(data.requestId);if(!task)return;clearTimeout(task.timeout);requests.delete(data.requestId);if(typeof data.error==='string')task.reject(Error(data.error));else task.resolve(data.result);
   }
  }
  window.addEventListener('message',receive);
  return()=>{window.removeEventListener('message',receive);frame.current?.contentWindow?.postMessage({type:'atlas:house:destroy'},location.origin);for(const task of requests.values()){clearTimeout(task.timeout);task.reject(Error('El entorno se cerró.'));}requests.clear();};
 },[api]);
 useEffect(()=>{if(ready&&props.activeRoom&&props.activeRoom!==currentRoom.current)api.teleport(props.activeRoom);},[api,props.activeRoom,ready]);
 useEffect(()=>{if(ready)api.pause(props.paused===true);},[api,props.paused,ready]);
 useEffect(()=>{if(ready&&props.processState)api.setProcessState(props.processState);},[api,props.processState,ready]);
 return <div className={[styles.scene,props.className||''].join(' ')} data-house-ready={ready} aria-busy={!ready&&!error}>
  <iframe ref={frame} title="Casa de Atlas: entorno 3D navegable" src={'/house/index.html'+(props.embedded===false?'':'?embedded=1')} allow="fullscreen; autoplay" className={styles.frame} />
 </div>;
}

export default HouseScene;
