import {baselineProfiles,type Capability,type Profiles,type Trial} from './benchmarks.ts';
import type {ResearchRun} from '../research/types.ts';
import {initialWorld,type WorldState} from './world.ts';
export const BRANCHES=[
 {id:'graphics',name:'Gráficos y geometría',question:'¿Qué pruebas permiten mejorar la geometría y el render sin perder rendimiento?',query:'WebGL geometry mesh quality performance',url:'https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices'},
 {id:'programming',name:'Programación y contratos',question:'¿Qué errores de entrada, persistencia y accesibilidad debe detectar el compilador?',query:'JavaScript form input validation constraints',url:'https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation'},
 {id:'audio',name:'Sonido y síntesis',question:'¿Cómo medir distorsión, picos y estabilidad en síntesis de audio?',query:'Web Audio signal clipping dynamics compressor',url:'https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode'},
 {id:'perception',name:'Percepción de señales',question:'¿Qué se puede medir en audio e imagen sin confundir señales con comprensión?',query:'Web Audio analyser signal frequency time domain',url:'https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode'}
] as const;
export type SpiralBranch={id:Capability;question:string;query:string;turns:number;depth:number;parentRunId:string|null;lastRunId:string|null;status:'ready'|'waiting';uncertainties:string[];lastTrial?:Trial};
export type SpiralState={world?:WorldState;version:1;turns:number;cursor:number;profiles:Profiles;branches:SpiralBranch[]};
export type SpiralTurn={world?:{actorId:string;roomId:string;moduleId:string;parentRunId:string|null;status:'reflected'|'waiting'};branch:Capability;parentRunId:string|null;depth:number;path:string[];trial:Trial;novelTechnicalResult:boolean};
export function initialSpiral():SpiralState{return{world:initialWorld(),version:1,turns:0,cursor:0,profiles:baselineProfiles(),branches:BRANCHES.map(b=>({id:b.id,question:b.question,query:b.query,turns:0,depth:1,parentRunId:null,lastRunId:null,status:'ready',uncertainties:[]}))};}
export function advanceSpiral(previous:SpiralState,run:ResearchRun,trial:Trial,profiles:Profiles){
 const state=structuredClone(previous),index=state.cursor%state.branches.length,branch=state.branches[index];
 const novel=!branch.lastTrial||branch.lastTrial.version!==trial.version||branch.lastTrial.candidate!==trial.candidate;
 const turn:SpiralTurn={branch:branch.id,parentRunId:branch.lastRunId,depth:branch.depth,path:['atlas',branch.id,...(branch.lastRunId?[branch.lastRunId]:[]),run.id],trial,novelTechnicalResult:novel||trial.decision==='promoted'};
 branch.turns++;branch.parentRunId=branch.lastRunId;branch.lastRunId=run.id;branch.lastTrial=trial;branch.status=run.deliberation?.status==='unavailable'?'waiting':'ready';
 const reflection=run.deliberation?.reflection;
 if(reflection){branch.question=reflection.nextQuestion;branch.query=reflection.nextQuery;branch.uncertainties=reflection.uncertainties;branch.depth++;}
 state.turns++;state.cursor=(index+1)%state.branches.length;state.profiles=profiles;
 return{state,turn,nextBranch:state.branches[state.cursor]};
}
