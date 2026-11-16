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
 const [yaw,setYaw]=useState(0);
 const [immersive,setImmersive]=useState(true);
 const levels=useMemo<Level[]>(()=>Array.from({length:depth+1},(_,i)=>({depth:i,label:i===0?'Lía exterior':`Lía interior · nivel ${i}`,focus:VERTICES[focus].name})),[depth,focus]);
 return <section aria-label="Mundo interior recursivo de Lía" style={{maxWidth:820,margin:'2rem auto',padding:'1.5rem',border:'1px solid #5556',borderRadius:20}}>
  <h1>Lía · Una identidad, múltiples perspectivas</h1>
  <p>El avatar exterior y los niveles interiores son vistas de una única Lía. Esta visualización no ejecuta robots, modelos neuronales ni agentes independientes.</p>
  <div role="group" aria-label="Explorar los vértices" style={{display:'flex',flexWrap:'wrap',gap:8,margin:'1rem 0'}}>
   {VERTICES.map((vertex,i)=><button key={vertex.name} type="button" aria-pressed={focus===i} onClick={()=>setFocus(i)} style={{padding:'0.6rem',borderRadius:10,border:'1px solid #8888',background:focus===i?'#8c83e633':'transparent',color:'inherit'}}>{vertex.name}</button>)}
  </div>
  <p role="status">{VERTICES[focus].detail}</p>
  <div role="img" aria-label={`Vista espacial de Lía con ${depth+1} representaciones anidadas, foco en ${VERTICES[focus].name}`} style={{height:330,overflow:'hidden',position:'relative',perspective:900,borderRadius:18,background:'radial-gradient(ellipse at 50% 35%,#202b50,#0b0f1d 75%)',color:'#e8eaff'}}>
   <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',transformStyle:'preserve-3d',transform:immersive?`rotateY(${yaw}deg) rotateX(-9deg)`:'none',transition:'transform 350ms ease'}}>
    {levels.map(level=><div key={level.depth} style={{position:'absolute',width:`${Math.max(90,260-level.depth*34)}px`,height:`${Math.max(90,260-level.depth*34)}px`,border:'2px solid rgba(153,176,255,.8)',borderRadius:20,boxShadow:'0 0 25px #818cf855,inset 0 0 30px #818cf822',transform:immersive?`translateZ(${(depth-level.depth)*35}px) rotateZ(${level.depth*9}deg)`:'none',display:'grid',placeItems:'start center',paddingTop:12,background:'rgba(35,48,88,.08)'}}>
     <span style={{fontSize:12,textShadow:'0 1px 4px #000'}}>{level.label}</span>
    </div>)}
    <div style={{transform:immersive?`translateZ(${depth*35+40}px)`:'none',display:'grid',placeItems:'center',gap:3,textAlign:'center',fontSize:13}}>
     <span aria-hidden="true" style={{fontSize:42}}>◇</span><strong>LÍA</strong>
     <span style={{maxWidth:160,fontSize:11}}>{VERTICES[focus].name}</span>
    </div>
   </div>
   {!immersive&&<div style={{position:'absolute',bottom:12,left:12,fontSize:12}}>Vista espacial en pausa</div>}
  </div>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
   <button type="button" onClick={()=>setYaw(y=>(y-20)%360)} aria-label="Girar vista a la izquierda">↶ Girar</button>
   <button type="button" onClick={()=>setYaw(y=>(y+20)%360)} aria-label="Girar vista a la derecha">Girar ↷</button>
   <button type="button" onClick={()=>{setYaw(0);setImmersive(v=>!v)}} aria-pressed={immersive}>{immersive?'Vista estática':'Vista espacial'}</button>
  </div>
  <div style={{display:'flex',gap:8,marginTop:16,flexWrap:'wrap'}}>
   <button type="button" onClick={()=>setDepth(d=>Math.min(MAX_DEPTH,d+1))} disabled={depth===MAX_DEPTH}>Entrar en la mente</button>
   <button type="button" onClick={()=>setDepth(d=>Math.max(0,d-1))} disabled={depth===0}>Volver al exterior</button>
   <button type="button" onClick={()=>{setDepth(0);setFocus(0);setYaw(0)}}>Restablecer vista</button>
  </div>
  <p aria-live="polite">Profundidad: {depth} de {MAX_DEPTH}. Todos los niveles comparten identidad y foco. El límite evita recursión ilimitada.</p>
  <p style={{fontSize:13,opacity:.8}}>Prototipo espacial CSS 3D sin WebGL, sin sensores y sin avatar robótico. La memoria persistente y la conexión con Ion siguen pendientes.</p>
 </section>;
}
