'use client';
import {useState} from 'react';
import HouseScene,{type HouseAPI} from '../../house-scene';
import {createHouseQuest,advanceHouseQuest} from '../../../public/house/house-quest.js';
import {houseFunction} from '../../../public/house/functional-world.js';
import styles from './prototype.module.css';
type Profile={name:string;temperament:string;principles:{title:string;text:string}[]};
export default function HousePrototype({brief,profiles}:{brief:string;profiles:Record<string,Profile>}){
 const [quest,setQuest]=useState(()=>createHouseQuest(brief)),[api,setApi]=useState<HouseAPI|null>(null),[dialog,setDialog]=useState<{title:string;text:string}|null>(null),[error,setError]=useState('');
 const target=quest.tasks[quest.step],fn=target?houseFunction(target.id):null;
 const act=(id:string)=>{const result=advanceHouseQuest(quest,id),binding=houseFunction(id);setQuest(result.state);if(binding){const profile=profiles[binding.owner];setDialog({title:profile.name,text:result.message+' '+profile.temperament+(profile.principles[0]?' Criterio que conservo: '+profile.principles[0].text:'')});}};
 return <main className={styles.game}><HouseScene prototype embedded onReady={value=>{setApi(value);value.teleport('mind');}} onFunction={act} onError={setError}/>
  <header className={styles.top}><a href="/">← Casa de Lía</a><span>PROTOTIPO JUGABLE · MISMA CASA Y PERSONAJES</span><button onClick={()=>{setQuest(createHouseQuest(brief));setDialog(null);api?.teleport('mind');}}>Reiniciar</button></header>
  <section className={styles.mission} aria-label="Misión"><p>DEL CONOCIMIENTO A LÍA · {quest.step}/{quest.tasks.length}</p><h1>{quest.completed?'Una idea integrada en Lía.':target.title}</h1><p>{quest.completed?'Has recorrido archivo, construcción, contraste e integración. Puedes seguir explorando.':`Busca ${fn?.label}. Acércate y pulsa sobre el objeto o usa E mirando hacia él.`}</p><div className={styles.inventory}>Inventario: {quest.inventory.join(' → ')||'vacío'}</div><details><summary>Mapa y encargo</summary><p>{brief}</p><p>La misión usa las colisiones y los puestos reales de la casa. Sus objetos de inventario pertenecen a este prototipo; no modifica tus memorias ni tus proyectos.</p>{fn&&<button onClick={()=>api?.teleport(fn.room)}>Ir a la sala de la misión</button>}<button disabled={!api} onClick={()=>api?.overview()}>Ver mapa 3D</button></details></section>
  {dialog&&<section className={styles.dialog} role="status"><strong>{dialog.title}</strong><p>{dialog.text}</p><button onClick={()=>setDialog(null)}>Seguir explorando</button></section>}{error&&<p role="alert" className={styles.dialog}>{error}</p>}
 </main>;
}
