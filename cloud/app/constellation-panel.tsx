'use client';
import {useEffect,useState} from 'react';import styles from './workspace-tools.module.css';
type Agent={installed?:boolean;ready?:boolean;inferenceVerified?:boolean;attempts?:number;passed?:number;failed?:number;meanMs?:number|null};
type Status={online?:boolean;modelName?:string;capabilities?:{gpuMode?:string;processTelemetry?:{agents?:{aider?:Agent;smolagents?:Agent;native?:Agent;automatic?:boolean};publicDocs?:{connected:boolean;searchAvailable:boolean;toolCount:number;checkedAt?:string|null;lastSearchAt?:string|null}|null}}};
export default function ConstellationPanel(_props:{ready?:boolean}){
 const[state,setState]=useState<Status>({});
 useEffect(()=>{let alive=true;const read=async()=>{try{const response=await fetch('/api/cloud/status',{cache:'no-store'});if(!response.ok)return;const value=await response.json() as Status;if(alive)setState(value);}catch{}};void read();const timer=setInterval(read,10000);return()=>{alive=false;clearInterval(timer);};},[]);
 const agents=state.capabilities?.processTelemetry?.agents;
 const docs=state.capabilities?.processTelemetry?.publicDocs;
 const result=(agent?:Agent)=>!agent?'Esperando datos del PC':agent.attempts?`${agent.passed||0} / ${agent.attempts} tareas aprobadas${agent.meanMs?` · ${(agent.meanMs/1000).toFixed(1)} s de media`:''}`:'Disponible; sin comparativa registrada';
 return <section className={styles.panel}>
  <div className={styles.eyebrow}>Cielo · Constelación · colaboradores</div><h2>Construir, contrastar y conservar lo que funciona.</h2>
  <p><span className={styles.statusDot+' '+(state.online?styles.online:'')}/>{!state.online?'Esperando al PC':state.capabilities?.gpuMode==='training'?'La GPU está probando una candidata de Qwen':state.capabilities?.gpuMode==='video'?'La GPU está generando vídeo':'Qwen local conectado'}</p>
  <div className={styles.cards}>
   <article className={styles.card}><h3>Aider · programador gratuito</h3><p>Edita una función en un espacio aislado. El validador de sintaxis y QuickJS ejecutan contratos antes de incorporar el código.</p><strong>{agents?.aider?.inferenceVerified?'Conexión probada con Qwen':agents?.aider?.ready?'Instalado; comprobando inferencia':'Preparando conexión'}</strong><p>{result(agents?.aider)}</p><a href="https://github.com/Aider-AI/aider" target="_blank" rel="noreferrer">Código de Aider ↗</a></article>
   <article className={styles.card}><h3>smolagents · colaborador gratuito</h3><p>El agente de Hugging Face propone código con Qwen local. Las funciones se comprueban fuera del modelo antes de incorporarse.</p><strong>{agents?.smolagents?.inferenceVerified?'Conexión probada con Qwen':agents?.smolagents?.ready?'Instalado; comprobando inferencia':'Esperando instalación'}</strong><p>{result(agents?.smolagents)}</p><a href="https://github.com/huggingface/smolagents" target="_blank" rel="noreferrer">Código de smolagents ↗</a></article>
   <article className={styles.card}><h3>Constructor de Atlas</h3><p>Qwen genera y repara herramientas con los mismos contratos. Conserva candidatos, errores y versiones anteriores.</p><strong>Integrado en el loop</strong><p>{result(agents?.native)}</p></article>
   <article className={styles.card}><h3>Selección automática</h3><p>Atlas compara tareas aprobadas, fallos y tiempos. Prueba alternativas cuando falta evidencia y utiliza esos resultados para elegir el constructor.</p><strong>{agents?.automatic?'Activa en el coordinador':'Esperando telemetría'}</strong><p>Está disponible para el trabajo autónomo; no exige activar una mesa en cada conversación.</p></article>
   <article className={styles.card}><h3>OpenAI Docs · conexión MCP</h3><p>Búsqueda real en documentación oficial para temas de OpenAI y Codex. Conexión pública de lectura, sin claves; no es otro modelo de IA.</p><strong>{!state.online?'Esperando al PC':docs?.connected&&docs.searchAvailable?'Conexión y búsqueda comprobadas':'Conexión pendiente de comprobar'}</strong>{docs?.connected&&<p>{docs.toolCount} herramientas descubiertas; Atlas utiliza la búsqueda documental verificada.</p>}<a href="https://developers.openai.com/learn/docs-mcp" target="_blank" rel="noreferrer">Documentación del conector ↗</a></article>
  </div>
  <p className={styles.small}>Los tres constructores usan el mismo Qwen de tu PC, sin consultas de pago. Las cifras corresponden a tareas ejecutadas desde este registro; no son una clasificación universal de agentes ni otros modelos independientes conectados.</p>
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
