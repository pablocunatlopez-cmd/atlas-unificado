'use client';
import {useMemo,useState} from 'react';
type Level={depth:number;label:string;focus:string};
const MAX_DEPTH=6;
const VERTICES=[
 {name:'Mundo Mental · Atlas',detail:'Hipótesis, recuerdos y simulaciones. No son observaciones verificadas.'},
 {name:'Mundo Físico · Ion',detail:'Sensores y acciones futuras requieren herramientas reales y autorización.'},
 {name:'Dios · Suceso',detail:'Lo inesperado puede motivar una revisión; no es un agente ejecutable.'}
] as const;
export default function LiaInnerWorld(){
 const [depth,setDepth]=useState(0);
 const [focus,setFocus]=useState(0);
 const levels=useMemo<Level[]>(()=>Array.from({length:depth+1},(_,i)=>({depth:i,label:i===0?'Lía exterior':`Lía interior · nivel ${i}`,focus:VERTICES[focus].name})),[depth,focus]);
 return <section aria-label="Mundo interior recursivo de Lía" style={{maxWidth:820,margin:'2rem auto',padding:'1.5rem',border:'1px solid #5556',borderRadius:20}}>
  <h1>Lía · Una identidad, múltiples perspectivas</h1>
  <p>El avatar exterior y los niveles interiores son vistas de una única Lía. Esta visualización no ejecuta robots, modelos neuronales ni agentes independientes.</p>
  <div role="group" aria-label="Explorar los vértices" style={{display:'flex',flexWrap:'wrap',gap:8,margin:'1rem 0'}}>
   {VERTICES.map((vertex,i)=><button key={vertex.name} type="button" aria-pressed={focus===i} onClick={()=>setFocus(i)} style={{padding:'0.6rem',borderRadius:10,border:'1px solid #8888',background:focus===i?'#8c83e633':'transparent',color:'inherit'}}>{vertex.name}</button>)}
  </div>
  <p role="status">{VERTICES[focus].detail}</p>
  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
   {levels.map(level=><div key={level.depth} style={{width:`${Math.max(52,100-level.depth*8)}%`,padding:'0.8rem',border:'2px solid #8c83e6',borderRadius:16,background:`rgba(140,131,230,${0.04+level.depth*0.025})`,textAlign:'center'}}>
    <strong>{level.label}</strong><div style={{fontSize:13,opacity:.8}}>{level.focus}</div>
   </div>)}
  </div>
  <div style={{display:'flex',gap:8,marginTop:16,flexWrap:'wrap'}}>
   <button type="button" onClick={()=>setDepth(d=>Math.min(MAX_DEPTH,d+1))} disabled={depth===MAX_DEPTH}>Entrar en la mente</button>
   <button type="button" onClick={()=>setDepth(d=>Math.max(0,d-1))} disabled={depth===0}>Volver al exterior</button>
   <button type="button" onClick={()=>{setDepth(0);setFocus(0)}}>Restablecer vista</button>
  </div>
  <p aria-live="polite">Profundidad: {depth} de {MAX_DEPTH}. Todos los niveles comparten identidad y foco. El límite evita recursión ilimitada.</p>
  <p style={{fontSize:13,opacity:.8}}>Prototipo visual local de la espiral. La memoria persistente y la conexión con Ion siguen pendientes.</p>
 </section>;
}
