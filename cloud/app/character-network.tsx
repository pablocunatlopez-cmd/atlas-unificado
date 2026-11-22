'use client';
import {useState} from 'react';
import {rankCharacters} from '../lib/collaboration/character-network';
import weights from '../data/character-network.json';
type Character={id:string;name:string;kind:string;title:string;residentId:string};
export default function CharacterNetwork({missions,locked,onSelect}:{missions:Character[];locked:boolean;onSelect:(id:string)=>void}){
 const [brief,setBrief]=useState(''),[searched,setSearched]=useState(false);
 const sections=searched?brief.split(';').map(s=>s.trim()).filter(Boolean).slice(0,3):[];
 return <details><summary>Elegir personajes para un encargo</summary>
 <p>Describe hasta tres tareas separadas por punto y coma. La red compara cada una con los oficios de Atlas y los personajes originales de ERAS. Tu texto se queda en esta pestaña.</p>
 <form onSubmit={e=>{e.preventDefault();setSearched(true);}}><label>Encargo para Lía <input value={brief} maxLength={600} onChange={e=>{setBrief(e.target.value);setSearched(false);}} placeholder="Mezcla sin recorte; ritmo de montaje"/></label> <button disabled={!brief.trim()||brief.split(';').length>3} type="submit">Buscar equipo</button></form>
 {brief.split(';').length>3&&<p>Divide el encargo en un máximo de tres tareas.</p>}
 <div aria-live="polite">{sections.map((s,i)=>{
 const matches=rankCharacters(weights,s).flatMap(id=>missions.filter(m=>m.id===id));
 return <div key={i}><strong>{s}</strong>{matches.length?<ul>{matches.map(m=><li key={m.id}><button type="button" disabled={locked} onClick={()=>onSelect(m.id)}>{m.name} · Ver oficio</button> {m.title}{m.kind==='character'?' · ERAS · delegado: '+(missions.find(d=>d.id==='resident:'+m.residentId)?.name||m.residentId):''}</li>)}</ul>:<p>No encuentro un oficio claro. Prueba con una actividad más concreta o elige la función abajo.</p>}</div>;
 })}</div><p>Elegir un oficio abre su ficha. Solo «Consultar con Ícaro» inicia una consulta.</p></details>;
}
