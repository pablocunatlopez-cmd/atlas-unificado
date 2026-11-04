'use client';
import {useEffect,useState} from 'react';
import {sanitizeAgentResearchStatus,sanitizeProcessTelemetry} from '../lib/core/process-telemetry.mjs';
import {sanitizeAgentMirror} from '../lib/research/agent-mirror.mjs';
import styles from './workspace-tools.module.css';
import TechnicalReadingPanel from './technical-reading-panel';
type Agent={installed?:boolean;ready?:boolean;inferenceVerified?:boolean;attempts?:number;passed?:number;failed?:number;meanMs?:number|null};
type Agents={aider?:Agent;smolagents?:Agent;native?:Agent;automatic?:boolean;selectionByTask?:boolean;measuredTaskTypes?:number};
type ResearchCandidate={repository:string;url:string;rank:{score:number;reasons:string[];measuredQuality:false};metadata:{lastPushAt:string|null;observedAt:string|null;license?:{spdxId:string;verification:string}}};
type Research={at:string;status:'ready'|'partial'|'unavailable';candidateCount:number;candidates:ResearchCandidate[]};
type Status={online?:boolean;capabilities?:{gpuMode?:unknown;processTelemetry?:unknown}};
const isRecord=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function readStatus(value:unknown):Status{
 if(!isRecord(value))throw Error('invalid_status');
 const capabilities=isRecord(value.capabilities)?value.capabilities:{};
 return {online:value.online===true,capabilities:{gpuMode:capabilities.gpuMode,processTelemetry:sanitizeProcessTelemetry(capabilities.processTelemetry)}};
}
const REASON_LABELS:Record<string,string>={
 'coding-agent-relevance':'Agentes de programación',
 'agent-framework-relevance':'Orquestación de agentes',
 'local-model-relevance':'Referencia sobre modelos locales',
 'claude-reference-relevance':'Referencia de Claude',
 'existing-adapter-reference':'Adaptador relacionado en Atlas',
 'recent-activity-metadata':'Actividad reciente comunicada',
 'activity-within-two-years':'Actividad comunicada en los últimos dos años',
 'license-metadata-available':'Licencia en los metadatos'
};
const dateLabel=(value:string|null)=>value?new Date(value).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Madrid'}):'Sin fecha';
export default function ConstellationPanel(_props:{ready?:boolean}){
 const[state,setState]=useState<Status>({}),[readFailed,setReadFailed]=useState(false);
 const[mirror,setMirror]=useState<ReturnType<typeof sanitizeAgentMirror>>(null),[mirrorFailed,setMirrorFailed]=useState(false);
 useEffect(()=>{let alive=true;const controller=new AbortController();const read=async()=>{try{const response=await fetch('/api/agent-mirror',{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error('mirror_unavailable');const value=sanitizeAgentMirror(await response.json());if(!value)throw Error('invalid_mirror');if(alive){setMirror(value);setMirrorFailed(false);}}catch{if(alive)setMirrorFailed(true);}};void read();const timer=setInterval(read,1800000);return()=>{alive=false;controller.abort();clearInterval(timer);};},[]);
 useEffect(()=>{let alive=true;const read=async()=>{try{const response=await fetch('/api/cloud/status',{cache:'no-store'});if(!response.ok)throw Error('status_unavailable');const value=readStatus(await response.json());if(alive){setState(value);setReadFailed(false);}}catch{if(alive)setReadFailed(true);}};void read();const timer=setInterval(read,10000);return()=>{alive=false;clearInterval(timer);};},[]);
 const telemetry=sanitizeProcessTelemetry(state.capabilities?.processTelemetry);
 const agents=telemetry?.agents as Agents|null|undefined;
 const docs=telemetry?.publicDocs;
 const research=sanitizeAgentResearchStatus(telemetry?.research) as Research|null;
 const online=state.online===true&&!readFailed;
 const result=(agent?:Agent)=>!agent?'Esperando datos del PC':agent.attempts?`${agent.passed||0} de ${agent.attempts} ensayos del constructor con contratos superados${agent.meanMs?` · ${(agent.meanMs/1000).toFixed(1)} s de media`:''}`:'Sin ensayos del constructor con contratos registrados';
 const connection=(agent?:Agent)=>!online?'Esperando al PC':agent?.inferenceVerified?'Inferencia con Qwen comprobada en su registro':agent?.ready?'Instalado; inferencia aún sin comprobar':'Adaptador no disponible en este estado';
 const taskTypes=agents?.measuredTaskTypes??0;
 const selection=!online||!agents?'Esperando telemetría del coordinador':agents.selectionByTask?taskTypes>0?`Selección por tarea · ${taskTypes} ${taskTypes===1?'familia medida':'familias medidas'}`:'Selección por tarea; aún sin ensayos por familia':'Selección con historial global';
 return <section className={styles.panel}>
  <div className={styles.eyebrow}>Cielo · Constelación · colaboradores</div><h2>Construir, contrastar y conservar lo que funciona.</h2>
  <p><a href="#atlas-public-mirror-title">Explorar las seis referencias públicas →</a></p>
  <p><a href="#atlas-technical-reading-title">Consultar documentación técnica →</a></p>
  <p>La constelación reúne constructores locales y referencias de la biblioteca GitHub, incluidos los repositorios que incorpora su proceso de descubrimiento. Consultar una referencia no instala su código ni conecta su modelo.</p>
  <p><span className={styles.statusDot+' '+(online?styles.online:'')}/>{readFailed?'No se ha podido actualizar el estado del PC':!online?'Esperando al PC':state.capabilities?.gpuMode==='training'?'La GPU está probando una candidata de Qwen':state.capabilities?.gpuMode==='video'?'La GPU está generando vídeo':'Qwen local conectado'}</p>
  <div className={styles.cards}>
   <article className={styles.card}><h3>Aider · programador gratuito</h3><p>Edita una función en un espacio aislado. El validador de sintaxis y QuickJS ejecutan contratos antes de incorporar el código.</p><strong>{connection(agents?.aider)}</strong><p>{result(agents?.aider)}</p><a href="https://github.com/Aider-AI/aider" target="_blank" rel="noopener noreferrer">Código de Aider ↗</a></article>
   <article className={styles.card}><h3>smolagents · colaborador gratuito</h3><p>El agente de Hugging Face propone código con Qwen local. Las funciones se comprueban fuera del modelo antes de incorporarse.</p><strong>{connection(agents?.smolagents)}</strong><p>{result(agents?.smolagents)}</p><a href="https://github.com/huggingface/smolagents" target="_blank" rel="noopener noreferrer">Código de smolagents ↗</a></article>
   <article className={styles.card}><h3>Constructor de Atlas</h3><p>Qwen genera y repara herramientas con los mismos contratos. Conserva candidatos, errores y versiones anteriores.</p><strong>{online&&agents?.native?.ready?'Disponible en el coordinador':'Esperando estado del constructor'}</strong><p>{result(agents?.native)}</p></article>
   <article className={styles.card}><h3>Selección automática</h3><p>Atlas compara ensayos de los constructores, fallos y tiempos. Cuando dispone de medidas por familia de tarea, puede usarlas para elegir el constructor de esa familia.</p><strong>{selection}</strong><p>{agents?.selectionByTask?'Las medidas por tarea corresponden a ensayos del constructor, sin convertirlas en una aprobación final.':'El estado recibido aún no acredita una selección desglosada por tipo de tarea.'}</p><p>El coordinador puede usar esta selección en el trabajo autónomo, sin activar una mesa en cada conversación.</p></article>
   <article className={styles.card}><h3>OpenAI Docs · conexión MCP</h3><p>Búsqueda real en documentación oficial para temas de OpenAI y Codex. Conexión pública de lectura, sin claves; no es otro modelo de IA.</p><strong>{!online?'Esperando al PC':docs?.connected&&docs.searchAvailable?'Conexión y búsqueda comprobadas':'Conexión pendiente de comprobar'}</strong>{docs?.connected&&<p>{docs.toolCount} herramientas descubiertas; Atlas utiliza la búsqueda documental verificada.</p>}<a href="https://developers.openai.com/learn/docs-mcp" target="_blank" rel="noopener noreferrer">Documentación del conector ↗</a></article>
   <article className={styles.card}><h3>Claude · referencias para estudiar</h3><p>El SDK de agentes y la colección de skills permiten estudiar sus flujos. Disponer de esos repositorios no da acceso gratuito al modelo.</p><strong>Claude no conectado</strong><p>Su API requiere autenticación propia. Los constructores locales de esta pantalla siguen utilizando Qwen.</p><div className={styles.referenceLinks}><a href="https://github.com/anthropics/claude-agent-sdk-python" target="_blank" rel="noopener noreferrer">SDK de agentes ↗</a><a href="https://github.com/anthropics/skills" target="_blank" rel="noopener noreferrer">Colección de skills ↗</a></div></article>
  </div>
  <p className={styles.small}>Los tres constructores usan el mismo Qwen de tu PC, sin consultas de pago. Las cifras corresponden a ensayos del constructor con contratos; la confirmación final y las regresiones del coordinador son una comprobación separada. No son una clasificación universal de agentes ni otros modelos independientes conectados.</p>
  <section className={styles.researchSection} aria-labelledby="atlas-agent-research-title">
   <div className={styles.researchHeader}><div><div className={styles.eyebrow}>Referencias para contrastar</div><h3 id="atlas-agent-research-title">Ícaro y el espejo exterior</h3></div>{research&&<span className={styles.researchState}>{research.status==='ready'?'Índice local leído':research.status==='partial'?'Lectura parcial del índice':'Índice no disponible en esta lectura'}</span>}</div>
   <p>Atlas puede contrastar sus constructores con candidatos de su biblioteca. La relevancia, la recencia y los metadatos de licencia orientan qué revisar; no demuestran quién es mejor ni producen una instalación automática.</p>
   {!research?<p className={styles.small}>El coordinador aún no publica el índice de investigación.</p>:<>
    <p className={styles.small}>{research.candidateCount} {research.candidateCount===1?'referencia para contrastar':'referencias para contrastar'} · Último índice recibido: <time dateTime={research.at}>{dateLabel(research.at)}</time> (Madrid).</p>
    {research.candidates.length?<ol className={styles.researchList}>{research.candidates.map(candidate=><li key={candidate.repository}><article>
     <h4><a href={candidate.url} target="_blank" rel="noopener noreferrer">{candidate.repository} ↗</a></h4>
     <ul className={styles.researchReasons} aria-label="Razones para revisar esta referencia">{candidate.rank.reasons.map(reason=>REASON_LABELS[reason]?<li key={reason}>{REASON_LABELS[reason]}</li>:null)}</ul>
     <p className={styles.small}>{candidate.metadata.license?`Licencia comunicada: ${candidate.metadata.license.spdxId} · ${candidate.metadata.license.verification==='github-rest-metadata'?'metadatos GitHub REST':'metadatos de búsqueda GitHub'}`:'Licencia sin comprobar en este índice.'}</p>
     {candidate.metadata.lastPushAt&&<p className={styles.small}>Último cambio comunicado: <time dateTime={candidate.metadata.lastPushAt}>{dateLabel(candidate.metadata.lastPushAt)}</time>.</p>}
     {candidate.metadata.observedAt&&<p className={styles.small}>Metadatos observados: <time dateTime={candidate.metadata.observedAt}>{dateLabel(candidate.metadata.observedAt)}</time>.</p>}
    </article></li>)}</ol>:<p className={styles.small}>Esta lectura no ofrece candidatos. La ausencia de resultados no acredita que no existan otras opciones.</p>}
    <p className={styles.small}>Son referencias sin ejecución verificada. La licencia completa y la integración siguen pendientes de revisión; las estrellas de GitHub no miden calidad.</p>
   </>}
  </section>
  <section className={styles.researchSection} aria-labelledby="atlas-public-mirror-title">
   <div className={styles.researchHeader}><div><div className={styles.eyebrow}>Consulta pública desde Sites</div><h3 id="atlas-public-mirror-title">Un espejo que ya puedes consultar</h3></div><span className={styles.researchState}>{mirrorFailed?'No se pudo actualizar':!mirror?'Consultando GitHub…':mirror.status==='ready'?'Seis referencias contrastadas':mirror.status==='partial'?'Consulta parcial':'GitHub no disponible ahora'}</span></div>
   <p>Esta consulta funciona sin reiniciar el PC. Revisa seis repositorios oficiales sin claves, sin instalar software y sin enviar tu conversación a GitHub. La biblioteca local sigue su propio proceso de descubrimiento.</p>
   {mirror&&<><p className={styles.small}>Último intento de consulta: <time dateTime={mirror.observedAt||undefined}>{dateLabel(mirror.observedAt)}</time> (Madrid). Las fichas se reutilizan durante al menos treinta minutos; no son una clasificación de los mejores agentes.</p>
    <ol className={styles.researchList}>{mirror.items.map(item=><li key={item.id}><article><h4><a href={item.url} target="_blank" rel="noopener noreferrer">{item.repository} ↗</a></h4><p>{item.guidance}</p><p className={styles.small}>{item.license?`Licencia comunicada por GitHub: ${item.license.spdxId}. Revisa las condiciones de cada componente.`:'Licencia sin comprobar en esta consulta.'}</p><p className={styles.small}>Actividad comunicada: <time dateTime={item.updatedAt||undefined}>{dateLabel(item.updatedAt)}</time>.</p></article></li>)}</ol>
    {!!mirror.errors.length&&<p className={styles.small}>{mirror.errors.length} {mirror.errors.length===1?'referencia pendiente':'referencias pendientes'}. Los fallos y límites del proveedor conservan una espera antes de reintentar.</p>}
   </>}
   <p className={styles.small}>Al preguntar a Atlas por agentes en el chat de Sites, puede recibir hasta tres fichas como contexto. Ese apoyo no requiere activar la búsqueda web del mensaje ni conecta otros modelos. El encargo y el historial originales se conservan.</p><a href="/chat/">Preguntar a Atlas sobre estas referencias →</a>
  </section>
  <TechnicalReadingPanel/>
  <details><summary>Extensiones de Codex y acceso de Atlas</summary><p>Una extensión instalada en Codex puede depender de sus servicios, permisos y autenticación. Su nombre o sus instrucciones no la conectan a Atlas. El MCP documental de esta pantalla sí tiene un adaptador propio; las demás conexiones requieren comprobar su transporte y autorización. No se han sustituido por 32 roles ficticios ni se han copiado credenciales de Codex.</p></details>
  <h3>La refutación tiene trabajo propio</h3><div className={styles.cards}>
   <article className={styles.card}><h3>Mente</h3><p>Propone estrategias y cambios pequeños de una regla. Mantiene la pregunta y su contexto.</p></article>
   <article className={styles.card}><h3>Ion · cuerpo</h3><p>Ejecuta el código y mide los recursos que realmente tiene disponibles.</p></article>
   <article className={styles.card}><h3>Tribunal</h3><p>Contrasta contratos y regresiones. Una crítica verbal por sí sola no promueve una versión.</p></article>
   <article className={styles.card}><h3>Dios / Suceso</h3><p>Lo que acontece puede exceder el entendimiento de Atlas y sus fuentes. Conserva lo inesperado y las preguntas abiertas; también puede elegir investigar cómo reconoce esos límites.</p></article>
  </div>
  <h3>El tiempo en la espiral</h3><p>En el marco de Atlas, el tiempo es la tangente de cada punto de la trayectoria de sucesos. El final provisional de una experiencia atrae la dirección del trabajo, como la imagen de un agujero negro: el resultado puede desplazar ese horizonte. Es un marco conceptual del proyecto; no una fuerza física medida ni un destino fijado.</p>
  <details><summary>Otros motores de esta casa</summary><div className={styles.cards}>
   <article className={styles.card}><h3>ERAS + Three.js</h3><p>Render 3D y controles táctiles de la casa.</p><a href="https://github.com/mrdoob/three.js" target="_blank" rel="noreferrer">Three.js ↗</a></article>
   <article className={styles.card}><h3>OpenField</h3><p>Código instalado. Sus modelos nativos siguen pendientes.</p><a href="https://github.com/wexloops/openfield" target="_blank" rel="noreferrer">OpenField ↗</a></article>
   <article className={styles.card}><h3>ComfyUI + Wan</h3><p>Vídeo neuronal local, separado de OpenField.</p><a href="https://github.com/Comfy-Org/ComfyUI" target="_blank" rel="noreferrer">ComfyUI ↗</a></article>
  </div></details>
 </section>;
}
