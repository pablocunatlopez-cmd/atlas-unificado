'use client';

import {useCallback,useEffect,useRef,useState,type FormEvent,type KeyboardEvent,type ReactNode} from 'react';
import styles from './cloud-chat.module.css';

type LiaProvenance={identity?:string;items?:Array<{component?:string;provenance?:string;evidenceVerified?:boolean}>;unknownComponent?:string;truthVerified?:boolean};
type Message={id?:string;role:'user'|'assistant';content:string;createdAt?:string;liaProvenance?:LiaProvenance};
type Conversation={id:string;title:string;updatedAt?:string};
type MotorStatus={online:boolean;modelName?:string;lastSeen?:string|null;sessionRequired?:boolean;capabilities?:{gpuMode?:string}};
type JobStatus='queued'|'pending'|'running'|'completed'|'failed'|'cancelled'|'reconnecting';
type Job={id:string;status:JobStatus};
type JobResult={status:JobStatus;conversationId?:string;result?:{answer?:string;modelName?:string;model?:string;liaProvenance?:LiaProvenance};error?:string};
type Detail={conversation?:Conversation;messages:Message[];pendingJob?:Job|null};
type Props={signedIn:boolean;displayName:string;signInPath:string};
const prompts=[
 {icon:'code',title:'Construir con código',description:'De una idea a una solución concreta.',text:'Ayúdame a programar una idea. Empieza por preguntarme el objetivo y después propón una solución completa con sus pruebas.'},
 {icon:'orbit',title:'Dar forma a un juego',description:'Mecánicas, mundo y un primer prototipo.',text:'Diseñemos un videojuego original: un bucle jugable, controles claros y un primer prototipo. Distingue el diseño del código realmente ejecutado.'},
 {icon:'spark',title:'Explorar una pregunta',description:'Entender, conectar y contrastar.',text:'Quiero explorar una idea contigo. Ayúdame a separar lo que sabemos de lo que necesitamos comprobar.'},
 {icon:'branch',title:'Poner una idea a prueba',description:'Supuestos y contraejemplos útiles.',text:'Refuta esta idea: busca sus supuestos ocultos y el contraejemplo más fuerte. La idea es: '},
];

function Icon({name,size=20}:{name:string;size?:number}){
 const shapes:Record<string,ReactNode>={
  plus:<path d="M12 5v14M5 12h14"/>,arrow:<path d="m5 12 7-7 7 7M12 5v14"/>,
  menu:<path d="M4 6h16M4 12h16M4 18h16"/>,close:<path d="m6 6 12 12M18 6 6 18"/>,
  external:<><path d="M14 3h7v7m0-7L10 14"/><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/></>,
  chat:<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/>,
  code:<><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18"/></>,
  orbit:<><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="3"/><circle cx="19" cy="5" r="1.5"/></>,
  spark:<><path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z"/></>,
  branch:<><path d="M6 5v14m0-7h7a5 5 0 0 0 5-5V5"/><circle cx="6" cy="4" r="2"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="4" r="2"/></>,
  globe:<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z"/></>,
  share:<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4m-6.8 7 6.8 4"/></>,
  check:<path d="m5 12 4 4L19 6"/>,copy:<><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
  clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]||shapes.spark}</svg>;
}

function Eye({large=false}:{large?:boolean}){
 return <svg className={large?styles.heroEye:styles.brandEye} viewBox="0 0 240 240" fill="none" aria-hidden="true"><circle cx="120" cy="120" r="109" stroke="currentColor" strokeWidth=".8" opacity=".18"/><circle cx="120" cy="120" r="89" stroke="currentColor" strokeWidth=".8" opacity=".2"/><path d="M120 46 184 158H56L120 46Z" stroke="currentColor" strokeWidth="1.4" opacity=".55"/><path d="M75 119q45-47 90 0-45 47-90 0Z" fill="currentColor" fillOpacity=".055" stroke="currentColor" strokeWidth="2"/><circle cx="120" cy="119" r="14" fill="currentColor"/><circle cx="124" cy="114" r="3.5" fill="#eaf5ef"/><circle cx="120" cy="46" r="3.5" fill="currentColor"/><circle cx="184" cy="158" r="3.5" fill="currentColor"/><circle cx="56" cy="158" r="3.5" fill="currentColor"/></svg>;
}

function linkHref(value:string){
 try{const url=new URL(value,'https://atlas.invalid');if(value.startsWith('/')&&!value.startsWith('//'))return value;if(url.protocol==='https:'&&!url.username&&!url.password)return url.href;}catch{}
 return null;
}
function Inline({text}:{text:string}){
 const parts=text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^\s)]+\))/g);
 return <>{parts.map((part,index)=>{
  if(part.startsWith('**')&&part.endsWith('**'))return <strong key={index}>{part.slice(2,-2)}</strong>;
  if(part.startsWith('`')&&part.endsWith('`'))return <code key={index}>{part.slice(1,-1)}</code>;
  const match=/^\[([^\]]+)\]\(([^)]+)\)$/.exec(part),href=match?linkHref(match[2]):null;
  if(match&&href)return <a key={index} href={href} target="_blank" rel="noopener noreferrer">{match[1]}</a>;
  return <span key={index}>{part}</span>;
 })}</>;
}
function CodeBlock({language,code}:{language:string;code:string}){
 const[copied,setCopied]=useState(false);
 return <div className={styles.codeBlock}><div><span>{language||'Código'}</span><button type="button" onClick={()=>{void navigator.clipboard.writeText(code).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1800);}).catch(()=>{});}} aria-label="Copiar código"><Icon name={copied?'check':'copy'} size={13}/>{copied?'Copiado':'Copiar'}</button></div><pre><code>{code}</code></pre></div>;
}
function Markdown({text}:{text:string}){
 const blocks:ReactNode[]=[];const lines=text.split('\n');
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(line.startsWith('```')){const language=line.slice(3).trim(),code:string[]=[];for(i++;i<lines.length&&!lines[i].startsWith('```');i++)code.push(lines[i]);blocks.push(<CodeBlock key={i} language={language} code={code.join('\n')}/>);continue;}
  if(!line.trim())continue;
  const heading=/^(#{1,3})\s+(.+)$/.exec(line);
  if(heading){blocks.push(<h3 key={i}><Inline text={heading[2]}/></h3>);continue;}
  if(/^\s*[-*]\s+/.test(line)){const items:string[]=[];for(;i<lines.length&&/^\s*[-*]\s+/.test(lines[i]);i++)items.push(lines[i].replace(/^\s*[-*]\s+/,''));i--;blocks.push(<ul key={i}>{items.map((item,index)=><li key={index}><Inline text={item}/></li>)}</ul>);continue;}
  if(/^\s*\d+[.)]\s+/.test(line)){const items:string[]=[];for(;i<lines.length&&/^\s*\d+[.)]\s+/.test(lines[i]);i++)items.push(lines[i].replace(/^\s*\d+[.)]\s+/,''));i--;blocks.push(<ol key={i}>{items.map((item,index)=><li key={index}><Inline text={item}/></li>)}</ol>);continue;}
  if(line.startsWith('> ')){blocks.push(<blockquote key={i}><Inline text={line.slice(2)}/></blockquote>);continue;}
  const paragraph=[line];for(;i+1<lines.length&&lines[i+1].trim()&&!/^(?:```|#{1,3}\s|>\s|\s*[-*]\s|\s*\d+[.)]\s)/.test(lines[i+1]);i++)paragraph.push(lines[i+1]);
  blocks.push(<p key={i}><Inline text={paragraph.join('\n')}/></p>);
 }
 return <>{blocks}</>;
}

async function readJson<T>(url:string,options:RequestInit={}):Promise<T>{
 const response=await fetch(url,{...options,cache:'no-store'});let value:unknown;
 try{value=await response.json();}catch{throw Error('Atlas no devolvió un estado válido. Vuelve a intentarlo.');}
 if(!response.ok)throw Error(typeof value==='object'&&value&&'error'in value?String(value.error):'No se pudo conectar con Atlas.');
 return value as T;
}
function validMessages(value:unknown):Message[]{
 if(!Array.isArray(value))return [];
 return value.filter((message):message is Message=>!!message&&typeof message==='object'&&['user','assistant'].includes(message.role)&&typeof message.content==='string').slice(-1000);
}
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

export default function CloudChat({signedIn,displayName,signInPath}:Props){
 const[motor,setMotor]=useState<MotorStatus>({online:false});const[motorRead,setMotorRead]=useState(false);
 const[conversations,setConversations]=useState<Conversation[]>([]);const[archiveLoading,setArchiveLoading]=useState(signedIn);const[archiveError,setArchiveError]=useState('');
 const[conversationId,setConversationId]=useState<string|null>(null);const[title,setTitle]=useState('Una nueva conversación');const[messages,setMessages]=useState<Message[]>([]);const[visibleLimit,setVisibleLimit]=useState(80);
 const[draft,setDraft]=useState('');const[internet,setInternet]=useState(false);const[sidebarOpen,setSidebarOpen]=useState(false);
 const[job,setJob]=useState<Job|null>(null);const[polling,setPolling]=useState(false);const[submitting,setSubmitting]=useState(false);const[loadingThread,setLoadingThread]=useState(false);const[cancelling,setCancelling]=useState(false);
 const[error,setError]=useState('');const[notice,setNotice]=useState('');const[copied,setCopied]=useState(false);
 const inputRef=useRef<HTMLTextAreaElement>(null),scrollRef=useRef<HTMLDivElement>(null),bottomRef=useRef<HTMLDivElement>(null);
 const sequence=useRef(0),pollAbort=useRef<AbortController|null>(null),mounted=useRef(true),sending=useRef(false),nearBottom=useRef(true),pendingText=useRef('');
 const retry=useRef<{requestId:string;message:string;conversationId:string|null}|null>(null);
 const busy=submitting||loadingThread||!!job;

 const refreshArchive=useCallback(async()=>{
  if(!signedIn)return;setArchiveLoading(true);
  try{const data=await readJson<{conversations?:Conversation[]}>('/api/cloud/conversations',{signal:AbortSignal.timeout(12000)});if(mounted.current){setConversations((data.conversations||[]).filter(item=>typeof item.id==='string'&&typeof item.title==='string'));setArchiveError('');}}
  catch(problem){if(mounted.current)setArchiveError(problem instanceof Error?problem.message:'No se pudo cargar el historial.');}
  finally{if(mounted.current)setArchiveLoading(false);}
 },[signedIn]);

 useEffect(()=>{
  mounted.current=true;let active=true,running=false;
  async function update(){if(running||document.hidden)return;running=true;try{const data=await readJson<MotorStatus>('/api/cloud/status',{signal:AbortSignal.timeout(10000)});if(active){setMotor({...data,online:data.online===true});setMotorRead(true);}}catch{if(active){setMotor({online:false});setMotorRead(true);}}finally{running=false;}}
  void update();const interval=setInterval(()=>void update(),15000);const visible=()=>{if(!document.hidden)void update();};document.addEventListener('visibilitychange',visible);
  return()=>{active=false;mounted.current=false;sequence.current++;pollAbort.current?.abort();clearInterval(interval);document.removeEventListener('visibilitychange',visible);};
 },[]);
 useEffect(()=>{void refreshArchive();},[refreshArchive]);
 useEffect(()=>{const prompt=new URLSearchParams(window.location.search).get('prompt');if(prompt&&prompt.length<=6000)setDraft(previous=>previous||prompt);},[]);
 useEffect(()=>{
  if(!messages.length&&!job){scrollRef.current?.scrollTo({top:0,behavior:'auto'});return;}
  if(nearBottom.current)bottomRef.current?.scrollIntoView({behavior:'smooth',block:'end'});
 },[messages,job?.status]);
 useEffect(()=>{const field=inputRef.current;if(field){field.style.height='auto';field.style.height=Math.min(field.scrollHeight,180)+'px';}},[draft]);
 useEffect(()=>{if(!sidebarOpen)return;const close=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape')setSidebarOpen(false);};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[sidebarOpen]);

 async function hydrate(id:string,current:number){
  const detail=await readJson<Detail>('/api/cloud/conversations/'+encodeURIComponent(id),{signal:AbortSignal.timeout(15000)});
  if(sequence.current!==current||!mounted.current)return null;
  setConversationId(id);setTitle(detail.conversation?.title||'Conversación de Atlas');setMessages(validMessages(detail.messages));setVisibleLimit(80);nearBottom.current=true;
  return detail;
 }
 async function followJob(id:string,current:number){
  pollAbort.current?.abort();const controller=new AbortController();pollAbort.current=controller;setPolling(true);let failures=0;
  while(mounted.current&&sequence.current===current&&!controller.signal.aborted){
   try{
    const result=await readJson<JobResult>('/api/cloud/jobs/'+encodeURIComponent(id),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});
    if(sequence.current!==current||controller.signal.aborted)return;failures=0;
    if(result.status==='completed'){
     if(typeof result.result?.answer!=='string')throw Error('La respuesta terminó sin contenido.');
     if(result.conversationId)await hydrate(result.conversationId,current);
     else setMessages(previous=>[...previous,{role:'assistant',content:result.result!.answer!,liaProvenance:result.result?.liaProvenance}]);
     setJob(null);setPolling(false);setNotice('Respuesta de '+(result.result.modelName||'Qwen en tu PC')+'.');setError('');pendingText.current='';retry.current=null;void refreshArchive();return;
    }
    if(result.status==='failed'||result.status==='cancelled'){
     setJob(null);setPolling(false);setDraft(previous=>previous||pendingText.current);
     if(result.status==='failed')setError(result.error||'Atlas no pudo terminar. Tu mensaje sigue aquí para reintentarlo.');
     else setNotice('Respuesta detenida. Puedes editar y volver a enviar tu mensaje.');
     retry.current=null;void refreshArchive();return;
    }
    setJob({id,status:result.status==='running'?'running':'queued'});setError('');
   }catch(problem){
    if(controller.signal.aborted||sequence.current!==current)return;
    failures++;if(failures>=4){setJob({id,status:'reconnecting'});setPolling(false);setError('Se ha interrumpido la conexión. El mensaje está guardado en la nube; puedes volver a comprobar su respuesta.');setDraft(previous=>previous||pendingText.current);return;}
   }
   await delay(1800);
  }
 }
 async function openConversation(item:Conversation){
  if(sending.current)return;const current=++sequence.current;pollAbort.current?.abort();setSidebarOpen(false);setLoadingThread(true);setJob(null);setPolling(false);setError('');setNotice('');setDraft('');retry.current=null;
  try{const detail=await hydrate(item.id,current);if(detail?.pendingJob){pendingText.current=validMessages(detail.messages).at(-1)?.content||'';setJob(detail.pendingJob);void followJob(detail.pendingJob.id,current);}}
  catch(problem){if(sequence.current===current)setError(problem instanceof Error?problem.message:'No se pudo abrir esta conversación.');}
  finally{if(sequence.current===current)setLoadingThread(false);}
 }
 function newConversation(){
  if(sending.current)return;sequence.current++;pollAbort.current?.abort();setConversationId(null);setTitle('Una nueva conversación');setMessages([]);setDraft('');setJob(null);setPolling(false);setSidebarOpen(false);setError('');setNotice('');retry.current=null;pendingText.current='';setVisibleLimit(80);inputRef.current?.focus();
 }
 async function submit(event?:FormEvent){
  event?.preventDefault();const text=draft.trim();if(!signedIn||!text||busy||sending.current)return;
  sending.current=true;setSubmitting(true);setError('');setNotice('');nearBottom.current=true;const previous=messages,current=sequence.current;
  const sameRetry=retry.current?.message===text&&retry.current?.conversationId===conversationId;
  const requestId=sameRetry?retry.current!.requestId:crypto.randomUUID();retry.current={requestId,message:text,conversationId};pendingText.current=text;
  setMessages([...previous,{role:'user',content:text}]);
  try{
   const result=await readJson<{jobId:string;conversationId:string;status:JobStatus}>('/api/cloud/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,...(conversationId?{conversationId}:{}),requestId,internet}),signal:AbortSignal.timeout(20000)});
   if(sequence.current!==current||!mounted.current)return;
   setConversationId(result.conversationId);setTitle(previous.length?title:text.slice(0,70));setDraft('');setJob({id:result.jobId,status:result.status});retry.current=null;void refreshArchive();void followJob(result.jobId,current);
  }catch(problem){if(sequence.current===current){setMessages(previous);setError(problem instanceof Error?problem.message:'No se pudo enviar el mensaje.');}}
  finally{sending.current=false;if(mounted.current)setSubmitting(false);}
 }
 async function cancel(){
  if(!job||cancelling)return;setCancelling(true);
  try{
   const result=await readJson<JobResult>('/api/cloud/jobs/'+encodeURIComponent(job.id),{method:'DELETE',signal:AbortSignal.timeout(15000)});pollAbort.current?.abort();setJob(null);setPolling(false);retry.current=null;setError('');
   if(result.status==='completed'){
    if(result.conversationId)await hydrate(result.conversationId,sequence.current);
    else if(result.result?.answer)setMessages(previous=>[...previous,{role:'assistant',content:result.result!.answer!}]);
    setNotice('La respuesta acababa de terminar y se ha conservado.');pendingText.current='';
   }else{setDraft(previous=>previous||pendingText.current);setNotice('Parada solicitada. Tu mensaje está listo para editarlo.');}
   void refreshArchive();
  }
  catch(problem){setError(problem instanceof Error?problem.message:'No se pudo solicitar la parada.');}
  finally{setCancelling(false);}
 }
 function keyDown(event:KeyboardEvent<HTMLTextAreaElement>){if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void submit();}}
 function usePrompt(text:string){setDraft(text);inputRef.current?.focus();}
 async function share(){try{await navigator.clipboard.writeText(location.origin+'/');setCopied(true);setTimeout(()=>setCopied(false),2200);}catch{setNotice('Puedes compartir la dirección de esta página. Cada persona tendrá su propio historial.');}}
 const motorLabel=!motorRead?'Comprobando conexión':!motor.online?'Esperando a tu PC':motor.capabilities?.gpuMode==='training'?'GPU · candidato Qwen':motor.capabilities?.gpuMode==='video'?'GPU · generando vídeo':'Tu PC está conectado';
 const statusText=submitting?'Guardando tu mensaje en la nube…':loadingThread?'Abriendo conversación…':job?.status==='reconnecting'?'Conexión interrumpida':job?.status==='running'?'Qwen está preparando tu respuesta…':job?'Mensaje en cola · esperando al motor local':notice;
 const firstName=displayName.split(/\s|@/)[0]||'Tu espacio';

 return <div className={styles.shell}>
  <button type="button" className={`${styles.backdrop} ${sidebarOpen?styles.backdropOpen:''}`} onClick={()=>setSidebarOpen(false)} aria-label="Cerrar navegación" tabIndex={sidebarOpen?0:-1}/>
  <aside className={`${styles.sidebar} ${sidebarOpen?styles.sidebarOpen:''}`} aria-label="Tu espacio de Atlas">
   <a href="/" target="_top" className={styles.brand}><Eye/><span>atlas<small>Una perspectiva, con memoria.</small></span></a>
   <button className={styles.newChat} type="button" onClick={newConversation} disabled={submitting}><Icon name="plus" size={17}/><span>Nueva conversación</span><span className={styles.newArrow}>↗</span></button>
   <div className={styles.sideLabel}>TU ESPACIO</div>
   <nav className={styles.navigation} aria-label="Navegación principal"><a className={styles.activeNav} href="/chat/"><Icon name="chat" size={17}/>Conversar<span>AHORA</span></a><a href="/actividad/" target="_top"><Icon name="branch" size={17}/>Actividad y herramientas<Icon name="external" size={13}/></a><a href="/taller/" target="_top"><Icon name="code" size={17}/>Taller 3D y videojuegos<Icon name="external" size={13}/></a><a href="/?room=music" target="_top"><Icon name="spark" size={17}/>Estudio de música<Icon name="external" size={13}/></a><a href="/?room=cinema" target="_top"><Icon name="orbit" size={17}/>Cine y vídeo<Icon name="external" size={13}/></a><a href="/?room=constellation" target="_top"><Icon name="globe" size={17}/>Cielo y colaboradores<Icon name="external" size={13}/></a><a href="/" target="_top"><Icon name="branch" size={17}/>Volver a la casa<Icon name="external" size={13}/></a></nav>
   <section className={styles.archive} aria-label="Conversaciones en la nube"><div className={styles.archiveHeading}><span>CONVERSACIONES</span><span>EN LA NUBE</span></div>
    {!signedIn?<p className={styles.archiveEmpty}>Inicia sesión para guardar tus conversaciones y abrirlas desde otros dispositivos.</p>:<>
     {archiveLoading&&!conversations.length?<p className={styles.archiveEmpty}>Cargando tus conversaciones…</p>:null}
     {archiveError?<div className={styles.archiveEmpty}>{archiveError}<button type="button" onClick={()=>void refreshArchive()}>Volver a intentar</button></div>:null}
     {!archiveLoading&&!archiveError&&!conversations.length?<p className={styles.archiveEmpty}>Las ideas empiezan con una conversación.</p>:null}
     <div className={styles.threadList}>{conversations.map(item=><button type="button" key={item.id} className={item.id===conversationId?styles.selectedThread:''} onClick={()=>void openConversation(item)} disabled={submitting}><Icon name="chat" size={14}/><span>{item.title||'Conversación de Atlas'}</span></button>)}</div>
    </>}
   </section>
   <div className={styles.sidebarFoot}><div className={styles.methodNote}><span>✓</span><div>La honestidad es el método<small>Hechos, hipótesis y límites a la vista.</small></div></div><div className={styles.motorCard}><span className={`${styles.dot} ${motor.online?styles.online:''}`}/><div><strong>{motorLabel}</strong><small>{motor.modelName||'Motor Qwen local'}</small></div></div>{signedIn?<div className={styles.profile}><span>{firstName.slice(0,1).toUpperCase()}</span><div>{firstName}<small>Historial privado en la nube</small></div><a href="/signout-with-chatgpt?return_to=%2F" title="Cerrar sesión" aria-label="Cerrar sesión">↗</a></div>:<a className={styles.sidebarSignIn} href={signInPath} target="_top">Entrar en tu espacio <span>↗</span></a>}</div>
  </aside>

  <main className={styles.main}>
   <header className={styles.topbar}><div className={styles.breadcrumb}><button className={styles.menuButton} type="button" onClick={()=>setSidebarOpen(true)} aria-label="Abrir navegación"><Icon name="menu"/></button><span>Atlas</span><span>/</span><strong>Conversar</strong></div><div className={styles.topActions}><span className={styles.cloudBadge}><Icon name="globe" size={13}/><span>CONTIGO, DONDE ESTÉS</span></span><button type="button" className={styles.shareButton} onClick={()=>void share()}><Icon name={copied?'check':'share'} size={15}/><span>{copied?'Enlace copiado':'Compartir Atlas'}</span></button></div></header>
   <div className={styles.scrollPane} ref={scrollRef} onScroll={()=>{const node=scrollRef.current;if(node)nearBottom.current=node.scrollHeight-node.scrollTop-node.clientHeight<180;}}>
    <div className={styles.content}>
     <div className={styles.threadHeading}><div className={styles.eyebrow}><span>✳</span> ATLAS · ESPACIO PERSONAL</div>{messages.length?<h1>{title}</h1>:<p>Una conversación puede llevarte más lejos.</p>}</div>
     {!messages.length&&!loadingThread?<section className={styles.welcome}>
      <div className={styles.welcomeArt}><Eye large/><span className={styles.starOne}>✧</span><span className={styles.starTwo}>·</span><span className={styles.starThree}>+</span></div>
      <div className={styles.heroKicker}><span className={`${styles.dot} ${motor.online?styles.online:''}`}/>{motorRead?(motor.online?'QWEN EN TU PC · ATLAS EN LA NUBE':'LA WEB ESTÁ LISTA · CONECTANDO CON TU PC'):'ATLAS · UNA MISMA DIRECCIÓN'}</div>
      <h1>Tu perspectiva.<br/><em>Desde cualquier lugar.</em></h1>
      <p className={styles.heroDescription}>Explora una idea, construye algo o pon a prueba lo que crees saber.<br className={styles.desktopBreak}/> El mismo Atlas, ahora también desde tu móvil.</p>
      <div className={styles.promptGrid}>{prompts.map(prompt=><button type="button" key={prompt.title} onClick={()=>usePrompt(prompt.text)} disabled={busy} className={styles.promptCard}><div><Icon name={prompt.icon}/><span>↗</span></div><strong>{prompt.title}</strong><small>{prompt.description}</small></button>)}</div>
      <div className={styles.methodTrail}><span>01 <b>Observar</b></span><i/><span>02 <b>Contrastar</b></span><i/><span>03 <b>Construir</b></span></div>
     </section>:null}
     {!signedIn?<section className={styles.signInCard}><span className={styles.signInMark}>◌</span><div><h2>Tu conversación, en tu espacio.</h2><p>Inicia sesión para hablar con Atlas y conservar tu historial. Cada persona accede solo a sus conversaciones.</p></div><a href={signInPath} target="_top">Continuar con ChatGPT <span>↗</span></a></section>:null}
     <div className={styles.messages} role="log" aria-label="Conversación con Atlas" aria-live="polite" aria-relevant="additions">
      {messages.length>visibleLimit?<button type="button" className={styles.earlier} onClick={()=>setVisibleLimit(previous=>previous+80)}>Ver mensajes anteriores <span>↑</span></button>:null}
      {messages.slice(-visibleLimit).map((message,index)=><article key={message.id||`${index}-${message.role}`} className={`${styles.message} ${message.role==='user'?styles.userMessage:styles.assistantMessage}`}><div className={styles.messageAvatar}>{message.role==='user'?firstName.slice(0,1).toUpperCase():<Eye/>}</div><div className={styles.messageMain}><div className={styles.messageAuthor}>{message.role==='user'?'Tú':'Lía'}{message.role==='assistant'?<span>QWEN · TU PC</span>:null}</div><div className={styles.messageBody}>{message.role==='assistant'?<Markdown text={message.content}/>:<p>{message.content}</p>}</div>{message.role==='assistant'&&message.liaProvenance?<div role="note" aria-label="Procedencia de la respuesta" style={{fontSize:12,opacity:.78,marginTop:8}}>Lía · Atlas: {message.liaProvenance.items?.filter(item=>item.component==='Atlas').length||0} referencias · Ion: {message.liaProvenance.items?.filter(item=>item.component==='Ion').length||0} fuentes consultadas · Constelación: incertidumbre conservada. Fuentes no verificadas.</div>:null}</div></article>)}
      {job?<div className={styles.pending} role="status"><span className={styles.pendingGlyph}>✳</span><div><strong>{job.status==='running'?'Conectando las ideas…':job.status==='reconnecting'?'Tu mensaje sigue guardado.':'Tu mensaje ya está en la nube.'}</strong><span>{job.status==='running'?'Qwen está respondiendo desde tu ordenador.':job.status==='reconnecting'?'La respuesta puede seguir en curso.':'Esperando a que el motor de tu PC lo recoja.'}</span></div>{!polling?<button type="button" onClick={()=>{setError('');void followJob(job.id,sequence.current);}}>Comprobar respuesta</button>:<span className={styles.pulseDots} aria-hidden="true"><i/><i/><i/></span>}</div>:null}
     </div><div ref={bottomRef}/>
    </div>
   </div>
   <footer className={styles.composerArea}>
    <div className={styles.composerWrap}>
     <div className={styles.connectionNote}><span className={`${styles.dot} ${motor.online?styles.online:''}`}/><span>{!motorRead?'Comprobando el motor de tu ordenador…':motor.online?'Tu ordenador está conectado. Atlas puede responder.':'Puedes dejar un mensaje en cola; Qwen responderá cuando tu PC se conecte.'}</span></div>
     <form className={styles.composer} onSubmit={event=>void submit(event)}><textarea ref={inputRef} value={draft} onChange={event=>setDraft(event.target.value)} onKeyDown={keyDown} rows={2} maxLength={6000} disabled={submitting||loadingThread} placeholder={signedIn?'Pregunta lo que quieras o cuéntale qué quieres crear…':'Tu próxima idea empieza aquí…'} aria-label="Mensaje para Atlas"/><div className={styles.composerTools}><button type="button" className={`${styles.internetToggle} ${internet?styles.internetOn:''}`} onClick={()=>setInternet(previous=>!previous)} disabled={busy} aria-pressed={internet} title="Pedir una consulta de fuentes públicas para este mensaje"><Icon name="globe" size={15}/>Internet<span className={styles.switchTrack}><i/></span></button><span className={styles.composerHint}>{draft.length>5500?`${draft.length}/6000`:'Qwen · motor local'}</span>{job?<button type="button" className={styles.stopButton} disabled={cancelling} onClick={()=>void cancel()}><span>■</span>{cancelling?'Deteniendo':'Detener'}</button>:<button type="submit" className={styles.sendButton} disabled={!signedIn||!draft.trim()||busy} aria-label="Enviar mensaje"><Icon name="arrow" size={20}/></button>}</div></form>
     <div className={styles.belowComposer}><span>La web y tu historial están en la nube. Qwen responde desde tu PC; debe estar encendido.</span><span className={styles.shortcut}>↵ Enviar <b>·</b> ⇧↵ Nueva línea</span></div>
     {error?<div className={styles.error} role="alert"><span>!</span><p>{error}</p><button type="button" onClick={()=>setError('')} aria-label="Cerrar aviso"><Icon name="close" size={14}/></button></div>:null}
     <p className={styles.statusLine} role="status">{statusText||'Atlas puede equivocarse. Contrasta lo importante.'}</p>
    </div>
   </footer>
  </main>
 </div>;
}
