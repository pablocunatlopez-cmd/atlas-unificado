/**
 * Atlas command center UI. Browser-safe markup generator with escaped content.
 * Host mounts the returned HTML and loads atlas-command-center.css.
 * This module does not inject scripts or request permissions.
 */
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STATUSES=new Set(['ready','review','blocked','offline']);
export function renderAtlasCommandCenter({project='Atlas Unificado',status='review',tasks=[],metrics={},localDiagnostics=null,diagnosticsAction=false}={}){
 if(typeof project!=='string'||project.length>100||!STATUSES.has(status)||
    !Array.isArray(tasks)||tasks.length>30)throw Error('Invalid dashboard state');
 const cards=tasks.map(t=>{
  if(!t||typeof t.title!=='string'||t.title.length>120||
    typeof t.detail!=='string'||t.detail.length>300)throw Error('Invalid task');
  return `<article class="atlas-task"><div class="atlas-task-icon" aria-hidden="true">✦</div><div><h3>${escape(t.title)}</h3><p>${escape(t.detail)}</p></div></article>`;
 }).join('');
 const localPanel=()=>{
  if(localDiagnostics===null)return '';
  const d=localDiagnostics;
  if(!d||!['candidate_ready','memory_attention','server_attention'].includes(d.status)||
   typeof d.llama?.ready!=='boolean'||typeof d.memory?.freeRamMb!=='number'||
   !Number.isFinite(d.memory.freeRamMb)||d.memory.freeRamMb<0)
   throw Error('Invalid local diagnostics');
  const state=d.status==='candidate_ready'?'Preparado para prueba':
   d.status==='memory_attention'?'Revisar memoria':'Revisar servidor';
  return '<section class="atlas-local-status" aria-label="Diagnóstico local">'+
   '<h2>Diagnóstico local (CPU)</h2><p role="status">'+escape(state)+'</p>'+
   '<p>llama.cpp: '+(d.llama.ready?'Responde':'No disponible')+'</p>'+
   '<p>RAM libre: '+escape(d.memory.freeRamMb)+' MB</p>'+
   '<p>Inferencia real: no verificada</p></section>';
 };
 const metric=(key,label)=>`<div class="atlas-metric"><span>${escape(label)}</span><strong>${Number.isFinite(metrics[key])?escape(metrics[key]):'—'}</strong></div>`;
 return `<main class="atlas-shell" aria-label="Atlas command center">
 <aside class="atlas-sidebar" aria-label="Secciones">
  <div class="atlas-mark" aria-hidden="true">A<span>·</span></div>
  <div class="atlas-side-label">ATLAS / NEXO</div>
  <div class="atlas-side-item atlas-side-active">◈ &nbsp; Centro de control</div>
  <div class="atlas-side-item">◇ &nbsp; ERAS Studio</div>
  <div class="atlas-side-item">⌘ &nbsp; Agentes</div>
  <div class="atlas-side-item">▤ &nbsp; Evaluaciones</div>
  <div class="atlas-sidebar-bottom">UNIFIED INTELLIGENCE</div>
 </aside>
 <section class="atlas-content">
  <header class="atlas-topbar"><div class="atlas-eyebrow">ATLAS / WORKSPACE</div><span class="atlas-status atlas-status-${status}"><i aria-hidden="true"></i>${escape(status)}</span></header>
  <section class="atlas-hero"><div class="atlas-orbit" aria-hidden="true"><div class="atlas-orbit-core"></div></div>
   <div class="atlas-hero-copy"><div class="atlas-eyebrow">SISTEMA DE INTELIGENCIA UNIFICADO</div><h1>${escape(project)}<span>.</span></h1>
    <p>Un espacio para investigar, crear y mejorar. Atlas coordina; ERAS da forma a los mundos.</p></div>
  </section>
  <section class="atlas-overview" aria-label="Métricas">
   ${metric('proposals','Propuestas')}${metric('verified','Verificadas')}${metric('scenes','Escenas ERAS')}${metric('regressions','Regresiones')}
  </section>
  ${diagnosticsAction?'<section aria-label="Comprobación local"><button type="button" data-action="run-cpu-diagnostics">Comprobar CPU y servidor local</button></section>':''}
  ${localPanel()}
  <div class="atlas-section-head"><div><div class="atlas-eyebrow">FLUJO DE TRABAJO</div><h2>Actividad reciente</h2></div><span>Revisión supervisada</span></div>
  <section class="atlas-tasks">${cards||'<p class="atlas-empty">Sin actividad registrada todavía.</p>'}</section>
  <footer class="atlas-footer">ATLAS UNIFICADO <span>·</span> ERAS GRAPHICS ENGINE <span>·</span> LOR-ΩΣ</footer>
 </section></main>`;
}
