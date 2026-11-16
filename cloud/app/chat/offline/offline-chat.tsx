'use client';
import {useState,type FormEvent} from 'react';
type Turn={role:'user'|'assistant';text:string};
export default function OfflineChat({signedIn,signInPath}:{signedIn:boolean;signInPath:string}){
 const [turns,setTurns]=useState<Turn[]>([]);
 const [draft,setDraft]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [saved,setSaved]=useState(false);
 async function saveConversation(){
  if(!signedIn||busy||turns.length===0)return;
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/state',{credentials:'same-origin',cache:'no-store'});
   if(!response.ok)throw Error('No se pudo leer el espacio privado de Atlas.');
   const snapshot=await response.json() as {state:{threads:Array<{id:string}>;[key:string]:unknown};revision:number};
   if(!snapshot.state||!Array.isArray(snapshot.state.threads)||!Number.isSafeInteger(snapshot.revision))throw Error('Estado privado no válido.');
   if(snapshot.state.threads.length>=100||turns.length>150)throw Error('Límite de conversaciones alcanzado; exporta el texto.');
   const id=crypto.randomUUID(),date=new Date().toISOString();
   const thread={id,title:(turns.find(t=>t.role==='user')?.text||'Atlas Core').slice(0,150),domain:'general',date,messages:turns.map((turn,i)=>({id:id+'-'+i,role:turn.role,text:turn.text,date}))};
   const updated=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({revision:snapshot.revision,state:{...snapshot.state,threads:[...snapshot.state.threads,thread]}})});
   if(!updated.ok){const failure=await updated.json().catch(()=>({})) as {error?:string};throw Error(failure.error||'No se pudo guardar la conversación.');}
   setSaved(true);
  }catch(problem){setError(problem instanceof Error?problem.message:'No se pudo guardar. Puedes exportar el texto.');}
  finally{setBusy(false);}
 }
 function exportConversation(){
  const transcript=turns.map(turn=>`${turn.role==='user'?'Usuario':'Atlas Core'}: ${turn.text}`).join('\n\n');
  const blob=new Blob([`Lía · Atlas Core (sesión temporal)\nMotor: reglas y recuperación, sin Qwen.\n\n${transcript}\n`],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='lia-atlas-core-conversacion.txt';link.click();URL.revokeObjectURL(url);
 }
 async function submit(event:FormEvent){
  event.preventDefault();
  const text=draft.trim();if(!signedIn||!text||busy)return;
  const previous=turns;setBusy(true);setSaved(false);setError('');
  setTurns([...previous,{role:'user',text}]);
  try{
   const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify({text,domain:'general',engine:'native',web:false,history:previous.slice(-20)})});
   const data=await response.json() as {reply?:{answer?:string;engine?:string};error?:string};
   if(!response.ok||typeof data.reply?.answer!=='string'||data.reply.engine!=='native')throw Error(data.error||'Atlas Core no devolvió una respuesta nativa válida.');
   setTurns([...previous,{role:'user',text},{role:'assistant',text:data.reply.answer}]);setDraft('');
  }catch(problem){setTurns(previous);setError(problem instanceof Error?problem.message:'No se pudo responder.');}
  finally{setBusy(false);}
 }
 return <main style={{maxWidth:780,margin:'0 auto',padding:'28px 18px',fontFamily:'system-ui',lineHeight:1.6}}>
  <nav><a href="/chat/">Volver al chat del motor local</a></nav>
  <h1>Lía · Atlas Core</h1>
  <p><strong>Modo sin ordenador.</strong> Responde el núcleo de reglas y recuperación del proyecto, no Qwen ni el motor completo de Lía. No se ejecutan acciones físicas ni se afirma que haya un modelo generativo activo.</p>
  <p role="note">Sesión temporal en este navegador: no se guarda automáticamente en el historial del motor local. Puedes guardarla explícitamente en tu espacio privado de Atlas. Al salir o recargar esta página se pierde la conversación. Atlas Core recibe hasta 20 mensajes anteriores y puede recuperar literalmente tu último mensaje cuando se lo preguntas. No utiliza ese contexto para razonar de forma general ni lo guarda como memoria persistente. Puedes exportar el texto antes de salir.</p>
  {!signedIn?<p><a href={signInPath}>Inicia sesión para conversar con Atlas Core.</a></p>:<>
   <section aria-label="Conversación" aria-live="polite" style={{display:'grid',gap:12,margin:'20px 0'}}>
    {turns.map((turn,i)=><article key={i} style={{border:'1px solid #8885',borderRadius:12,padding:14,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}><strong>{turn.role==='user'?'Tú':'Atlas Core · respuesta nativa'}</strong><div>{turn.text}</div></article>)}
   </section>
   {error?<p role="alert">{error}</p>:null}
   <form onSubmit={submit} style={{display:'grid',gap:10}}>
    <label htmlFor="offline-message">Tu mensaje</label>
    <textarea id="offline-message" rows={4} maxLength={6000} required value={draft} onChange={event=>setDraft(event.target.value)} disabled={busy} style={{width:'100%',padding:12,borderRadius:10}}/>
    <button type="submit" disabled={busy||!draft.trim()}>{busy?'Consultando Atlas Core…':'Enviar a Atlas Core'}</button>
   </form>
   <div style={{display:'flex',gap:12,marginTop:18}}><button type="button" onClick={()=>void saveConversation()} disabled={busy||turns.length===0||saved}>{saved?'Guardada en Atlas':'Guardar en mi espacio Atlas'}</button><button type="button" onClick={exportConversation} disabled={busy||turns.length===0}>Exportar conversación (.txt)</button><button type="button" onClick={()=>{setTurns([]);setSaved(false);setError('');}} disabled={busy||turns.length===0}>Limpiar sesión temporal</button></div>
  </>}
 </main>;
}
