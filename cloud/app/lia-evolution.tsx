'use client';

import {Box,Brain,Music,Printer,ShieldCheck,Sparkles,X} from 'lucide-react';
import {
 LIA_EVOLUTION_CAPABILITIES,
 LIA_EVOLUTION_PRINCIPLES,
 LIA_EVOLUTION_PURPOSE,
 LIA_EVOLUTION_RULES,
 LIA_EVOLUTION_STAGES,
 LIA_EVOLUTION_TITLE,
 type EvolutionStatus,
} from '@/lib/lia-evolution';
import styles from './lia-evolution.module.css';

const statusLabel:Record<EvolutionStatus,string>={implemented:'Existe',partial:'Parcial',research:'Investigación'};
const capabilityIcon:Record<string,typeof Box>={house:Sparkles,memory:Brain,workshop:Box,music:Music,'music-spatial':Music,body:Printer,ai:Brain};

export default function LiaEvolution({onClose}:{onClose:()=>void}){
 return <section className={styles.charter} aria-labelledby="lia-charter-title">
  <header className={styles.header}>
   <div><span>LÍA / DIRECCIÓN</span><h2 id="lia-charter-title">{LIA_EVOLUTION_TITLE}</h2><p>Una prioridad con límites, no una promesa de consciencia.</p></div>
   <button type="button" onClick={onClose} autoFocus aria-label="Cerrar la carta de evolución"><X size={17}/></button>
  </header>

  <div className={styles.purpose}><span>PROPÓSITO</span><p>{LIA_EVOLUTION_PURPOSE}</p></div>

  <div className={styles.principles}>{LIA_EVOLUTION_PRINCIPLES.map((principle,index)=><article key={principle.id}><span>{String(index+1).padStart(2,'0')}</span><h3>{principle.title}</h3><p>{principle.text}</p></article>)}</div>

  <section className={styles.section} aria-labelledby="lia-capabilities-title">
   <div className={styles.sectionHeading}><span>ESTADO COMPROBADO</span><h3 id="lia-capabilities-title">Qué existe hoy</h3></div>
   <div className={styles.capabilities}>{LIA_EVOLUTION_CAPABILITIES.map(capability=>{const Icon=capabilityIcon[capability.id]||Box;return <article key={capability.id} data-status={capability.status}><div><Icon size={16}/><strong>{capability.title}</strong><em>{statusLabel[capability.status]}</em></div><p>{capability.detail}</p></article>;})}</div>
  </section>

  <section className={styles.section} aria-labelledby="lia-stages-title">
   <div className={styles.sectionHeading}><span>HORIZONTE</span><h3 id="lia-stages-title">El camino, por etapas</h3></div>
   <ol className={styles.stages}>{LIA_EVOLUTION_STAGES.map(stage=><li key={stage.id} data-status={stage.status}><div><strong>{stage.title}</strong><em>{stage.status==='active'?'En curso':stage.status==='next'?'Siguiente':'Investigación'}</em></div><p>{stage.detail}</p></li>)}</ol>
  </section>

  <section className={styles.rules} aria-labelledby="lia-rules-title">
   <div className={styles.sectionHeading}><span>NO NEGOCIABLE</span><h3 id="lia-rules-title"><ShieldCheck size={16}/> Reglas de evolución</h3></div>
   <ul>{LIA_EVOLUTION_RULES.map(rule=><li key={rule}>{rule}</li>)}</ul>
  </section>

  <footer className={styles.footer}><strong>Un principio no es una garantía.</strong><p>Ninguna IA puede prometer que nunca cometerá un error. Esta carta fija prioridades, permisos y pruebas para que el daño se busque, se detenga y se pueda revertir. La impresión 3D y la música espacial siguen siendo investigación, no capacidades actuales.</p><button type="button" onClick={onClose}>Volver a la casa</button></footer>
 </section>;
}
