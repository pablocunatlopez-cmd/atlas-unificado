import {retrieve,capabilityTests,type Knowledge,type RetrievalProfile} from '../atlas-core.ts';
/** Immutable, hand-authored synthetic retrieval checks. Never populated from fetched pages. */
export const EVALUATOR_VERSION='retrieval-judge-2026-10-20-v1';
type Case={query:string;expected:string|null;docs:Knowledge[]};
function pair(query:string,goodTitle:string,badTitle:string):Case{
 const text='Registro sintético del evaluador, separado del corpus web. Este caso solo comprueba el orden de palabras de un título, no su verdad.';
 return{query,expected:'target',docs:[{id:'distractor',title:badTitle,text,kind:'Fixture sintética'},{id:'target',title:goodTitle,text,kind:'Fixture sintética'}]};
}
export const DEVELOPMENT:Case[]=[
 pair('memoria negativa','Memoria negativa de Atlas','Negativa y memoria de Atlas'),
 pair('separación temporal','Separación temporal del corpus','Temporal separación del corpus'),
 {query:'neutrinos taurinos',expected:null,docs:[{id:'task',title:'Tareas',text:'Una tarea registra su fecha de revisión y conserva el historial.',kind:'Fixture sintética'}]}
];
export const HELDOUT:Case[]=[
 pair('fuentes primarias','Fuentes primarias y procedencia','Primarias y fuentes de procedencia'),
 pair('sombras suaves','Sombras suaves en la escena','Suaves sombras en la escena'),
 pair('historial de versiones','Historial de versiones guardado','Versiones de historial guardado'),
 pair('pruebas de regresión','Pruebas de regresión conservadas','Regresión de pruebas conservadas'),
 {query:'calcula',expected:'calculator',docs:[{id:'calculator',title:'Calcula',text:'La aritmética evalúa una expresión numérica con precedencia.',kind:'Fixture sintética'}]},
 {query:'xenobiología submarina',expected:null,docs:[{id:'engine',title:'Motor gráfico',text:'La escena tridimensional ilumina cajas y esferas con sombras y reflejos.',kind:'Fixture sintética'}]}
];
export function scoreProfile(profile:RetrievalProfile,cases:Case[]){
 const casesResult=cases.map(c=>{const found=retrieve(c.query,c.docs,1,profile)[0]?.id||null;return{query:c.query,expected:c.expected,found,passed:found===c.expected};});
 return{passed:casesResult.filter(c=>c.passed).length,total:casesResult.length,cases:casesResult};
}
export function evaluateCandidate(active:RetrievalProfile){
 const baseline=scoreProfile(active,DEVELOPMENT),candidate=scoreProfile('focused',DEVELOPMENT);
 const selected=active==='baseline'&&candidate.passed>baseline.passed;
 // Selection uses development only. The held-out set is run once on the selected profile.
 const before=scoreProfile(active,HELDOUT),after=scoreProfile(selected?'focused':active,HELDOUT),checks=capabilityTests();
 const regression=before.cases.some((c,i)=>c.passed&&!after.cases[i].passed);
 const promoted=selected&&!regression&&after.passed>before.passed&&checks.every(c=>c.passed);
 return{version:EVALUATOR_VERSION,selected,baselineDevelopment:baseline,candidateDevelopment:candidate,before,after,checks,regression,promoted,profile:(promoted?'focused':active) as RetrievalProfile,scope:'Banco sintético de ordenación por título y abstención. No mide verdad, comprensión general ni competencia de programación.'};
}
