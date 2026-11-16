import {LIA_IDENTITY} from './lia-identity.js';
/**
 * Pure bounded proposal for Atlas's generative spiral.
 * Tangent offspring and finite resource budget; no renderer or autonomous action.
 */
export function generateAtlasTangentSpirals({depth=3,budget=24,samples=32,growthRate=.16}={}){
 if(!Number.isInteger(depth)||depth<0||depth>6||
    !Number.isInteger(budget)||budget<1||budget>128||
    !Number.isInteger(samples)||samples<12||samples>128||
    !Number.isFinite(growthRate)||growthRate<0||growthRate>1)
  throw Error('Invalid bounded spiral parameters');
 const branches=[],events=[];
 let remaining=budget;
 const normalize=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
 const curve=(origin,direction,length,phase)=>{
  const tangent=normalize(direction),side=normalize([-tangent[2],0,tangent[0]]);
  const vertical=[0,1,0];
  const points=[];
  for(let i=0;i<samples;i++){
   const t=i/(samples-1),angle=phase+t*Math.PI*3;
   // The transverse displacement starts quadratically: B'(0) follows parent tangent.
   const radius=.16*t*t*Math.exp(growthRate*t);
   points.push(Object.freeze(origin.map((v,j)=>v+length*t*tangent[j]+
    radius*(Math.cos(angle)*side[j]+Math.sin(angle)*vertical[j]))));
  }
  return Object.freeze(points);
 };
 function spawn(parent,origin,direction,level,phase,length){
  if(remaining<1||level>depth)return;
  const id='branch-'+branches.length;
  remaining--;
  const points=curve(origin,direction,length,phase);
  const branch={id,parent,level,points};
  branches.push(branch);
  events.push(Object.freeze({id:'event-'+events.length,branch:id,
   parentBranch:parent,kind:parent===null?'origin':'tangent_birth',
   sequence:events.length,intervalFromPrevious:events.length===0?null:1}));
  if(level===depth||remaining===0)return;
  // Finite-budget mycelium-inspired exploration: two possible offspring.
  for(const fraction of [.4,.75]){
   if(remaining===0)break;
   const index=Math.round(fraction*(samples-1));
   const before=points[index-1],after=points[index+1];
   const directionAt=after.map((v,j)=>v-before[j]);
   spawn(id,points[index],directionAt,level+1,phase+1.1,length*.68);
  }
 }
 spawn(null,[0,1,0],[1,.18,0],0,0,6);
 return Object.freeze({schemaVersion:1,mode:'declarative_geometry',
  branches:Object.freeze(branches.map(b=>Object.freeze(b))),
  events:Object.freeze(events),remainingBudget:remaining,
  vertices:Object.freeze(LIA_IDENTITY.vertices.map(vertex=>vertex.domain)),
  identity:LIA_IDENTITY.name,components:Object.freeze(LIA_IDENTITY.vertices.map(vertex=>vertex.component)),
  temporalIntervalsAreModelUnits:true,empiricalFungalModelVerified:false,
  codeExecuted:false,rendererCreated:false});
}
