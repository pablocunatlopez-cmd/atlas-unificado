import {ROOM_IDS} from '../../public/house/layout.js';
import {validateLivingProposal} from '../../public/house/living-contract.js';

export const LIVING_LAB_VERSION='atlas-living-clearance-1';
export const LIVING_LAB_CANDIDATES=64;
const HALF_DIAGONAL=Math.sqrt(3)/2;
const MIN_GAIN=.005;
const bounded=v=>Math.round(Math.max(-1.5,Math.min(1.5,v))*1000)/1000;
const baseY=o=>2.32+o.y*.32;
// All supported geometries fit a unit cube. Swept spheres conservatively cover
// its rotations, largest pulse scale and full vertical float displacement.
function sweptRadii(proposal){
 return proposal.objects.map((o,index)=>{
  let pulse=0,vertical=0;
  for(const instruction of proposal.program){if(instruction.target!==index)continue;if(instruction.op==='pulse')pulse=Math.max(pulse,instruction.amount);if(instruction.op==='float')vertical=Math.max(vertical,instruction.amount);}
  return HALF_DIAGONAL*o.size*(1+pulse)+vertical;
 });
}
function gap(a,b,ra,rb){return Math.hypot(a.x-b.x,baseY(a)-baseY(b),a.z-b.z)-ra-rb;}
function clearance(proposal,radii){
 if(proposal.objects.length<2)return 0;
 let minimum=Infinity;
 for(let i=0;i<proposal.objects.length;i++)for(let j=i+1;j<proposal.objects.length;j++)minimum=Math.min(minimum,gap(proposal.objects[i],proposal.objects[j],radii[i],radii[j]));
 return minimum;
}
export function measureLivingClearance(raw){const proposal=validateLivingProposal(raw);return clearance(proposal,sweptRadii(proposal));}
function seedFor(room,iteration){let seed=2166136261;for(const char of room+':'+iteration)seed=Math.imul(seed^char.charCodeAt(0),16777619);return seed>>>0;}
function randomFor(seed){return()=>{seed=(seed+0x6d2b79f5)|0;let n=Math.imul(seed^(seed>>>15),1|seed);n^=n+Math.imul(n^(n>>>7),61|n);return((n^(n>>>14))>>>0)/4294967296;};}
function candidate(proposal,radii,round,random){
 const objects=proposal.objects.map(o=>({...o})),points=[];
 // The four exact corners provide the two-object optimum. Other rounds also
 // explore shifted grids and bounded continuous points, rather than random
 // movement that could silently worsen an accepted scene.
 for(const x of [-1.5,1.5])for(const z of [-1.5,1.5])points.push({x,z});
 const offsetX=round<4?0:(random()-.5)*.65,offsetZ=round<4?0:(random()-.5)*.65;
 for(let x=-1.5;x<=1.5;x+=.75)for(let z=-1.5;z<=1.5;z+=.75)points.push({x:bounded(x+offsetX),z:bounded(z+offsetZ)});
 for(const object of objects)points.push({x:object.x,z:object.z});
 for(let i=0;i<12;i++)points.push({x:bounded(random()*3-1.5),z:bounded(random()*3-1.5)});
 const order=objects.map((_,index)=>({index,radius:radii[index],tie:random()})).sort((a,b)=>b.radius-a.radius||a.tie-b.tie),placed=[];
 for(const {index} of order){
  let chosen=points[round%4],best=-Infinity;
  if(placed.length)for(const point of points){const trial={...objects[index],...point};let score=Infinity;for(const prior of placed)score=Math.min(score,gap(trial,objects[prior],radii[index],radii[prior]));if(score>best+1e-10){best=score;chosen=point;}}
  objects[index]={...objects[index],...chosen};placed.push(index);
 }
 return{...proposal,objects};
}

export function proposeLivingExperiment(previousProposal,room,iteration=0){
 if(!ROOM_IDS.includes(room))throw Error('ROOM');
 if(!Number.isSafeInteger(iteration)||iteration<0||iteration>1e9)throw Error('ITERATION');
 const previous=validateLivingProposal(previousProposal),radii=sweptRadii(previous),before=clearance(previous,radii),random=randomFor(seedFor(room,iteration));
 let proposal=previous,after=before;
 if(previous.objects.length>1)for(let round=0;round<LIVING_LAB_CANDIDATES;round++){
  const next=candidate(previous,radii,round,random),score=clearance(next,radii);
  if(score>after+1e-10){proposal=next;after=score;}
 }
 const improved=after-before>=MIN_GAIN;
 if(!improved){proposal=previous;after=before;}
 proposal=validateLivingProposal(proposal);
 const changes=improved?proposal.objects.flatMap((o,index)=>o.x===previous.objects[index].x&&o.z===previous.objects[index].z?[]:[`Objeto ${index+1}: X/Z ${previous.objects[index].x}, ${previous.objects[index].z} → ${o.x}, ${o.z}.`]):[];
 return{proposal,measurement:{before,after,metric:'minimum-swept-sphere-gap-m/v1',improved},changes,scope:'Experimento determinista de disposición espacial con hasta 64 candidatos, sin inferencia. La separación mínima usa esferas conservadoras que incluyen giro, pulso y flotación; una distancia negativa indica intersección de esas envolventes, no prueba de colisión entre las mallas. Sólo promueve ganancias de al menos 5 mm en esta métrica. No mide belleza, calidad general ni aprendizaje del modelo.'};
}
