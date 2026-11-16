'use client';
import {useEffect,useMemo,useState} from 'react';
import {initialLiaPerspective,transitionLiaPerspective,liaPerspectiveLevels} from '../../continuous/lia-perspective-state.mjs';
import LiaAvatar from './lia-avatar';
type Level={depth:number;label:string;focus:string};
type Conversation={id:string;title:string};
type TimelineRecord={id:string;jobId:string;claim:string;status:string;time:string|null;priorRecordId:string|null;statusChanged:boolean;comparison:string;factualAccuracyVerified:boolean;changeExplanation:string;newEvidenceReferences:string[];recordedConclusion:string};
type Hypothesis={id:string;claim:string;status:string;origin:string;evidence:Array<{type:string;reference:string;verified:boolean}>;revisionOf:string|null;conclusion:string;factualAccuracyVerified:boolean};
type TransitionJournalRecord={id:string;hypothesisId:string;timestamp:string|null;hash:string;previousHash:string|null;integrityVerifiedInCloud:boolean;transition:{previousStatus:string;nextStatus:string;rule:string;check:{kind:string;outcome:string;reference:string;executed:boolean}}};
type ExecutionEvent={id:string;kind:string;status:string;stage:string|null;updatedAt:string;checks:{answerStored:boolean;modelReported:string|null};verifiedExecution:boolean;hypothesis:null;revision:null;audit?:{review:string;reviewAttempted:boolean;citationAuditRecorded:boolean;unknownCitationLabels:string[];factualAccuracyVerified:boolean}|null;hypotheses?:Hypothesis[];transitionJournal?:TransitionJournalRecord[]};
type HistoryEvent={id:string;role:string;summary:string;vertex:string;verified:boolean;provenance:string;time:string|null};
const MAX_DEPTH=6;
const VERTICES=[
 {name:'Mundo Mental · Atlas',detail:'Hipótesis, recuerdos y simulaciones. No son observaciones verificadas.'},
 {name:'Mundo Físico · Ion',detail:'Sensores y acciones futuras requieren herramientas reales y autorización.'},
 {name:'Dios · Suceso',detail:'Lo inesperado puede motivar una revisión; no es un agente ejecutable.'}
] as const;
export default function LiaInnerWorld(){
 const [perspective,setPerspective]=useState(initialLiaPerspective);
 const [conversations,setConversations]=useState<Conversation[]>([]);
 const [selectedConversation,setSelectedConversation]=useState('');
 const [history,setHistory]=useState<HistoryEvent[]>([]);
 const [executions,setExecutions]=useState<ExecutionEvent[]>([]);
 const [timeline,setTimeline]=useState<TimelineRecord[]>([]);
 const [historyError,setHistoryError]=useState('');
 const [historyLoading,setHistoryLoading]=useState(false);
 useEffect(()=>{
  let active=true;
  fetch('/api/cloud/conversations',{credentials:'same-origin',cache:'no-store'})
   .then(async response=>{if(!response.ok)throw Error(response.status===401?'Inicia sesión para ver tus conversaciones.':'No se pudo consultar el historial.');return response.json()})
   .then(data=>{if(active)setConversations(Array.isArray(data.conversations)?data.conversations:[])})
   .catch(error=>{if(active)setHistoryError(error.message)});
  return ()=>{active=false};
 },[]);
 useEffect(()=>{
  if(!selectedConversation){setHistory([]);setExecutions([]);setTimeline([]);return;}
  const controller=new AbortController();
  setHistoryLoading(true);setHistoryError('');setHistory([]);setExecutions([]);setTimeline([]);
  fetch('/api/lia-world/conversations/'+encodeURIComponent(selectedConversation),{credentials:'same-origin',cache:'no-store',signal:controller.signal})
   .then(async response=>{if(!response.ok)throw Error('No se pudo recuperar la conversación seleccionada.');return response.json()})
   .then(data=>{setHistory(Array.isArray(data.events)?data.events:[]);setExecutions(Array.isArray(data.executionEvents)?data.executionEvents:[]);setTimeline(Array.isArray(data.hypothesisTimeline)?data.hypothesisTimeline:[])})
   .catch(error=>{if(!controller.signal.aborted)setHistoryError(error.message)})
   .finally(()=>{if(!controller.signal.aborted)setHistoryLoading(false)});
  return ()=>controller.abort();
 },[selectedConversation]);
 const depth=perspective.depth;
 const focus=(['mental','physical','god'] as const).indexOf(perspective.focus as 'mental'|'physical'|'god');
 const yaw=perspective.yaw;
 const immersive=perspective.mode==='spatial';
 const dispatch=(action:{type:string;[key:string]:unknown})=>setPerspective(previous=>transitionLiaPerspective(previous,action));
 const levels=useMemo<Level[]>(()=>liaPerspectiveLevels(perspective).map(level=>({depth:level.depth,label:level.depth===0?'Lía exterior':`Lía interior · nivel ${level.depth}`,focus:VERTICES[focus].name})),[perspective,focus]);
 return <section aria-label="Mundo interior recursivo de Lía" style={{maxWidth:820,margin:'2rem auto',padding:'1.5rem',border:'1px solid #5556',borderRadius:20}}>
  <h1>Lía · Una identidad, múltiples perspectivas</h1>
  <p>El avatar exterior y los niveles interiores son vistas de una única Lía. Esta visualización no ejecuta robots, modelos neuronales ni agentes independientes.</p>
  <div role="group" aria-label="Explorar los vértices" style={{display:'flex',flexWrap:'wrap',gap:8,margin:'1rem 0'}}>
   {VERTICES.map((vertex,i)=><button key={vertex.name} type="button" aria-pressed={focus===i} onClick={()=>dispatch({type:'focus',focus:(['mental','physical','god'] as const)[i]})} style={{padding:'0.6rem',borderRadius:10,border:'1px solid #8888',background:focus===i?'#8c83e633':'transparent',color:'inherit'}}>{vertex.name}</button>)}
  </div>
  <p role="status">{VERTICES[focus].detail}</p>
  <div role="img" aria-label={`Vista espacial de Lía con ${depth+1} representaciones anidadas, foco en ${VERTICES[focus].name}`} style={{height:330,overflow:'hidden',position:'relative',perspective:900,borderRadius:18,background:'radial-gradient(ellipse at 50% 35%,#202b50,#0b0f1d 75%)',color:'#e8eaff'}}>
   <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',transformStyle:'preserve-3d',transform:immersive?`rotateY(${yaw}deg) rotateX(-9deg)`:'none',transition:'transform 350ms ease'}}>
    {levels.map(level=><div key={level.depth} style={{position:'absolute',width:`${Math.max(90,260-level.depth*34)}px`,height:`${Math.max(90,260-level.depth*34)}px`,border:'2px solid rgba(153,176,255,.8)',borderRadius:20,boxShadow:'0 0 25px #818cf855,inset 0 0 30px #818cf822',transform:immersive?`translateZ(${(depth-level.depth)*35}px) rotateZ(${level.depth*9}deg)`:'none',display:'grid',placeItems:'start center',paddingTop:12,background:'rgba(35,48,88,.08)'}}>
     <span style={{fontSize:12,textShadow:'0 1px 4px #000'}}>{level.label}</span>
    </div>)}
    <div style={{transform:immersive?`translateZ(${depth*35+40}px)`:'none',display:'grid',placeItems:'center',gap:3,textAlign:'center',fontSize:13}}>
     <LiaAvatar size={110} mode={depth===0?'exterior':'interior'} focus={(['mental','physical','god'] as const)[focus]}/><strong>LÍA</strong>
     <span style={{maxWidth:160,fontSize:11}}>{VERTICES[focus].name}</span>
    </div>
   </div>
   {!immersive&&<div style={{position:'absolute',bottom:12,left:12,fontSize:12}}>Vista espacial en pausa</div>}
  </div>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
   <button type="button" onClick={()=>dispatch({type:'rotate',degrees:-20})} aria-label="Girar vista a la izquierda">↶ Girar</button>
   <button type="button" onClick={()=>dispatch({type:'rotate',degrees:20})} aria-label="Girar vista a la derecha">Girar ↷</button>
   <button type="button" onClick={()=>dispatch({type:'mode',mode:immersive?'static':'spatial'})} aria-pressed={immersive}>{immersive?'Vista estática':'Vista espacial'}</button>
  </div>
  <div style={{display:'flex',gap:8,marginTop:16,flexWrap:'wrap'}}>
   <button type="button" onClick={()=>dispatch({type:'enter'})} disabled={depth===MAX_DEPTH}>Entrar en la mente</button>
   <button type="button" onClick={()=>dispatch({type:'exit'})} disabled={depth===0}>Volver al exterior</button>
   <button type="button" onClick={()=>dispatch({type:'reset'})}>Restablecer vista</button>
  </div>
  <p aria-live="polite">Profundidad: {depth} de {MAX_DEPTH}. Todos los niveles comparten identidad y foco. El límite evita recursión ilimitada.</p>
  <div style={{marginTop:20,borderTop:'1px solid #8885',paddingTop:16}}>
   <h2>Memoria conversacional real</h2>
   <p>Estos acontecimientos proceden del historial del chat de Atlas, no de una simulación. No representan pensamientos internos ni observaciones físicas verificadas.</p>
   <label htmlFor="lia-history-conversation">Conversación</label>{' '}
   <select id="lia-history-conversation" value={selectedConversation} onChange={event=>setSelectedConversation(event.target.value)}>
    <option value="">Selecciona una conversación</option>
    {conversations.map(conversation=><option key={conversation.id} value={conversation.id}>{conversation.title}</option>)}
   </select>
   {historyLoading&&<p role="status">Cargando historial…</p>}
   {historyError&&<p role="alert">{historyError}</p>}
   {selectedConversation&&!historyLoading&&!historyError&&<div>
    <h3>Comparación de hipótesis registradas</h3>
    <p>Se comparan afirmaciones con texto idéntico entre ejecuciones. Un cambio de estado no demuestra aprendizaje ni validez científica.</p>
    {timeline.length?<ol style={{maxHeight:200,overflowY:'auto',paddingLeft:22}}>
     {timeline.map(item=><li key={item.id} style={{marginBottom:8}}>
      <strong>{item.statusChanged?'Cambio de estado registrado':item.comparison==='same-status'?'Estado repetido':'Primera aparición'} · {item.status}</strong>
      <div>{item.claim}</div>
      <small>Trabajo: {item.jobId} · Anterior: {item.priorRecordId||'ninguno'} · Exactitud: no verificada</small>
      {item.statusChanged&&<div>Motivo observable: {item.newEvidenceReferences.length?'nuevas referencias de evidencia registradas':'no constan referencias nuevas'}; no se puede atribuir causalidad.</div>}
      {item.recordedConclusion&&<div>Conclusión del registro: {item.recordedConclusion}</div>}
     </li>)}
    </ol>:<p>No hay hipótesis comparables registradas.</p>}
    <h3>Ejecuciones registradas</h3>
    <p>Estos estados proceden de trabajos reales de la cola. Una ejecución completada no demuestra que su respuesta sea correcta. Las hipótesis y revisiones no registradas se muestran como ausentes.</p>
    <ol style={{maxHeight:240,overflowY:'auto',paddingLeft:22}}>
     {executions.map(event=><li key={event.id} style={{marginBottom:10}}>
      <strong>{event.kind} · {event.status}</strong> · {event.updatedAt}
      <div>Etapa: {event.stage||'sin etapa registrada'} · Respuesta almacenada: {event.checks.answerStored?'sí':'no'} · Modelo declarado: {event.checks.modelReported||'desconocido'}</div>
      <small>Hipótesis: {event.hypotheses?.length?'registro explícito disponible':'no registrada'} · Revisión del modelo: {event.audit?.review==='completed'?'segunda pasada registrada':event.audit?.review==='failed'?'intentada y fallida':'no registrada'} · Auditoría de citas: {event.audit?.citationAuditRecorded?'registrada':'no registrada'} · Exactitud factual: no verificada</small>
      {event.transitionJournal?.length?<details><summary>Diario de comprobaciones ({event.transitionJournal.length})</summary>
       {event.transitionJournal.map(record=><div key={record.id} style={{padding:'6px 0'}}>
        <strong>{record.hypothesisId}: {record.transition.previousStatus} → {record.transition.nextStatus}</strong>
        <div>Regla: {record.transition.rule} · Comprobación: {record.transition.check.kind} ({record.transition.check.outcome})</div>
        <small>Referencia: {record.transition.check.reference} · SHA-256: {record.hash.slice(0,16)}… · Integridad en nube: no verificada</small>
       </div>)}
      </details>:null}
      {event.hypotheses?.map(hypothesis=><div key={hypothesis.id} style={{borderLeft:'2px solid #a89cff',paddingLeft:10,marginTop:8}}>
       <strong>{hypothesis.status} · {hypothesis.id}</strong><div>{hypothesis.claim}</div>
       <small>Origen: {hypothesis.origin} · Revisión de: {hypothesis.revisionOf||'ninguna'} · Evidencias: {hypothesis.evidence.length} · Exactitud: no verificada</small>
       {hypothesis.conclusion&&<div>Conclusión registrada: {hypothesis.conclusion}</div>}
      </div>)}
     </li>)}
    </ol>
    {!executions.length&&<p>No hay ejecuciones registradas en esta conversación.</p>}
   </div>}
   {selectedConversation&&!historyLoading&&!historyError&&<ol style={{maxHeight:260,overflowY:'auto',paddingLeft:22}}>
    {history.map(event=><li key={event.id} style={{marginBottom:12}}><strong>{event.role==='assistant'?'Lía · respuesta':'Usuario · mensaje'}</strong>{' '}<small>· {event.time||'fecha desconocida'} · no verificado</small><div>{event.summary}</div></li>)}
   </ol>}
  </div>
  <p style={{fontSize:13,opacity:.8}}>Prototipo espacial CSS 3D sin WebGL, sin sensores y sin avatar robótico. La memoria persistente y la conexión con Ion siguen pendientes.</p>
 </section>;
}
