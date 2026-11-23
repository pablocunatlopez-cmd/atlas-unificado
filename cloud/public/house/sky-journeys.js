import {ROOMS,WALLS,blocked,movePlayer,roomAt} from './layout.js';
import {residentById} from './residents.js';

const MAX=1000000000,TTL=75000,STEP=.4,RADIUS=.22;
const focusProcesses={programming:'tools',language:'lor','3d':'creative',games:'creative',video:'video',music:'experience',conversation:'chat',research:'research',reasoning:'core',suceso:'suceso',unknown:'experience'};
const travelers={chat:'salon-centre',research:'lab-desk',tools:'body-console',review:'refutation-candidate',weights:'refutation-control',lor:'language-object',core:'language-symbol',creative:'games-desk',video:'cinema-projector',experience:'mind-desk',suceso:'mind-desk'};
const phases=new Set(['seeking','consulting','returning','blocked']);
const outcomes=new Set(['in-progress','sources-observed','references-available','no-evidence','cooldown','lookup-failed','cancelled','interrupted']);
const terminals=new Set(['returning','blocked']);
const count=value=>Number.isSafeInteger(value)&&value>=0&&value<=MAX;
const stamp=value=>typeof value==='string'&&value.length<=35&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const cancelled=event=>event.outcome==='cancelled'||event.outcome==='interrupted';
export const ICARUS_MEETING_POINT=Object.freeze([1.35,-4.65]);

function eventValue(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||!/^icarus-[1-9]\d{0,9}$/.test(value.id)||Number(value.id.slice(7))>MAX||!phases.has(value.phase)||!outcomes.has(value.outcome)||!Object.hasOwn(focusProcesses,value.focus)||value.processId!==focusProcesses[value.focus])return null;
 const at=stamp(value.at),startedAt=stamp(value.startedAt),terminal=terminals.has(value.phase),success=['sources-observed','references-available'].includes(value.outcome);
 if(!at||!startedAt||Date.parse(at)<Date.parse(startedAt)||!count(value.sourceCount)||value.sourceCount>32||!count(value.usedReferenceCount)||value.usedReferenceCount>value.sourceCount||terminal===(value.outcome==='in-progress')||(value.phase==='returning')!==success||!terminal&&(value.sourceCount!==0||value.usedReferenceCount!==0)||success&&value.sourceCount===0)return null;
 const resident=typeof value.residentId==='string'?residentById(value.residentId):null;if(value.residentId!==undefined&&(!resident||['sky-agents','sky-sources'].includes(resident.id)))return null;
 return {...(resident?{residentId:resident.id}:{}),id:value.id,phase:value.phase,processId:value.processId,focus:value.focus,at,startedAt,sourceCount:value.sourceCount,usedReferenceCount:value.usedReferenceCount,outcome:value.outcome};
}

/** Closed presentation state; no question, URL, script or free-form dialogue. */
export function normalizeIcarusJourneys(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||value.schema!==1)return null;
 if(![value.total,value.completed,value.blocked].every(count)||value.completed+value.blocked>value.total)return null;
 const active=eventValue(value.active),recent=[],seen=new Set();
 for(const raw of (Array.isArray(value.recent)?value.recent:[]).slice(-8)){
  const event=eventValue(raw);if(!event||!terminals.has(event.phase)||seen.has(event.id))continue;
  recent.push(event);seen.add(event.id);
 }
 const pending=active&&!terminals.has(active.phase)?active:null;
 if(pending&&seen.has(pending.id)||value.total<recent.length+(pending?1:0)||value.completed<recent.filter(event=>event.phase==='returning').length||value.blocked<recent.filter(event=>event.phase==='blocked').length)return null;
 return {schema:1,total:value.total,completed:value.completed,blocked:value.blocked,active:pending,recent};
}

export function residentForIcarusEvent(event){
 const safe=eventValue(event);if(!safe)return null;
 let id=safe.residentId||travelers[safe.processId];
 if(!safe.residentId&&(safe.focus==='3d'||safe.focus==='games'))id='games-maquette';
 if(!safe.residentId&&safe.processId==='experience'&&safe.focus==='language')id='language-meaning';
 const resident=residentById(id);return resident&&(!resident.cosmetic||!!safe.residentId)&&resident.id!=='sky-agents'&&resident.id!=='sky-sources'?resident:null;
}

export function icarusEventCaption(event){
 const safe=eventValue(event);if(!safe)return 'Sin consulta registrada';
 if(safe.phase==='seeking')return 'Consulta a Ícaro · buscando';
 if(safe.phase==='consulting')return 'Consulta a Ícaro · en curso';
 if(safe.phase==='returning')return 'Consulta registrada · '+safe.sourceCount+' referencias';
 return safe.outcome==='cancelled'?'Consulta cancelada':safe.outcome==='interrupted'?'Consulta interrumpida':safe.outcome==='cooldown'?'Consulta en espera':'Consulta sin nuevas referencias';
}

const floor=(x,z)=>ROOMS.some(room=>x>=room.bounds[0]&&x<=room.bounds[2]&&z>=room.bounds[1]&&z<=room.bounds[3]);
const key=(x,z)=>x+':'+z;
function clearSegment(a,b,walls,radius){
 if(blocked(a[0],a[1],radius,walls)||blocked(b[0],b[1],radius,walls))return false;
 const step=movePlayer({x:a[0],z:a[1]},b[0]-a[0],b[1]-a[1],{radius,walls});
 return Math.hypot(step.x-b[0],step.z-b[1])<1e-6;
}
function anchor(point,walls,radius,step){
 const cx=Math.round(point[0]/step),cz=Math.round(point[1]/step),candidates=[];
 for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++){
  const ix=cx+dx,iz=cz+dz,x=ix*step,z=iz*step;
  if(floor(x,z)&&clearSegment(point,[x,z],walls,radius))candidates.push({ix,iz,distance:Math.hypot(x-point[0],z-point[1])});
 }
 return candidates.sort((a,b)=>a.distance-b.distance||a.ix-b.ix||a.iz-b.iz)[0]||null;
}

/** Routes use the same collision substeps as the player, including furniture
 * when scene.solids is supplied. No route is preferable to crossing a wall. */
export function planSkyRoute(residentOrId,{walls=WALLS,target=ICARUS_MEETING_POINT,radius=RADIUS,step=STEP}={}){
 const resident=typeof residentOrId==='string'?residentById(residentOrId):residentOrId;
 if(!resident||resident.cosmetic||['sky-agents','sky-sources'].includes(resident.id)||!Array.isArray(walls)||!Array.isArray(target)||target.length!==2||!target.every(Number.isFinite)||radius!==RADIUS||step!==STEP)return null;
 const start=[resident.position[0],resident.position[2]],first=anchor(start,walls,radius,step),last=anchor(target,walls,radius,step);
 if(!first||!last)return null;
 const firstKey=key(first.ix,first.iz),lastKey=key(last.ix,last.iz),queue=[[first.ix,first.iz]],parents=new Map([[firstKey,null]]),walkable=new Map();let cursor=0;
 const valid=(ix,iz)=>{
  const k=key(ix,iz);if(walkable.has(k))return walkable.get(k);
  const x=ix*step,z=iz*step,ok=ix>=-40&&ix<=40&&iz>=-40&&iz<=20&&floor(x,z)&&!blocked(x,z,radius,walls);walkable.set(k,ok);return ok;
 };
 while(cursor<queue.length&&queue.length<=15000){
  const [ix,iz]=queue[cursor++],k=key(ix,iz);if(k===lastKey)break;
  for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]){
   const nx=ix+dx,nz=iz+dz,nk=key(nx,nz);
   if(parents.has(nk)||!valid(nx,nz)||!clearSegment([ix*step,iz*step],[nx*step,nz*step],walls,radius))continue;
   parents.set(nk,k);queue.push([nx,nz]);
  }
 }
 if(!parents.has(lastKey))return null;
 const points=[];let current=lastKey;
 while(current){const [ix,iz]=current.split(':').map(Number);points.push([ix*step,iz*step]);current=parents.get(current);}
 points.reverse();points.unshift(start);points.push([...target]);
 const compact=points.filter((point,index)=>index===0||Math.hypot(point[0]-points[index-1][0],point[1]-points[index-1][1])>1e-6);
 const lengths=[0];for(let i=1;i<compact.length;i++)lengths.push(lengths.at(-1)+Math.hypot(compact[i][0]-compact[i-1][0],compact[i][1]-compact[i-1][1]));
 return {residentId:resident.id,points:compact,lengths,distance:lengths.at(-1),radius};
}

function routePosition(route,distance,direction=1){
 const target=Math.max(0,Math.min(route.distance,distance));let index=1;
 while(index<route.lengths.length-1&&route.lengths[index]<target)index++;
 const a=route.points[index-1],b=route.points[index],length=route.lengths[index]-route.lengths[index-1],t=length?(target-route.lengths[index-1])/length:0;
 return {position:[a[0]+(b[0]-a[0])*t,0,a[1]+(b[1]-a[1])*t],yaw:Math.atan2((b[0]-a[0])*direction,-(b[1]-a[1])*direction)};
}

/** Each event can produce one bounded visual journey. Presentation elapsed is
 * separate from backend phases: replaying a receipt never invents work or an
 * accepted change. The host and audience never become travellers. */
export function createSkyJourneys({now=Date.now,walls=WALLS,reducedMotion=false}={}){
 const jobs=new Map(),routes=new Map(),seen=new Set();let connected=false,sourceAge=Infinity,receivedAt=-Infinity;
 const fresh=(animationMs)=>connected&&Number.isFinite(sourceAge)&&sourceAge>=0&&Number.isFinite(animationMs)&&animationMs>=receivedAt&&sourceAge+animationMs-receivedAt<=TTL;
 function setState(value,{connected:online=false,sourceAgeMs=Infinity,receivedAtMs=0}={}){
  connected=online===true;sourceAge=sourceAgeMs;receivedAt=Number.isFinite(receivedAtMs)?receivedAtMs:-Infinity;
  const snapshot=normalizeIcarusJourneys(value);if(!snapshot||!fresh(receivedAt))return;
  const events=[...(snapshot.active?[snapshot.active]:[]),...snapshot.recent].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||Number(b.id.slice(7))-Number(a.id.slice(7)));
  // A newer query must not hide the terminal receipt of the journey that is
  // already being displayed for the same resident.
  for(const event of events){
   const resident=residentForIcarusEvent(event),prior=resident&&jobs.get(resident.id),age=now()-Date.parse(event.at);
   if(prior?.event.id!==event.id||age<0||age>TTL||Date.parse(event.at)<Date.parse(prior.event.at)||terminals.has(prior.event.phase)||prior.event.phase==='consulting'&&event.phase==='seeking')continue;
   prior.event=event;
  }
  const chosen=new Set();
  for(const event of events){
   const resident=residentForIcarusEvent(event);if(!resident||chosen.has(resident.id))continue;
   const age=now()-Date.parse(event.at);if(!Number.isFinite(age)||age<0||age>TTL)continue;
   chosen.add(resident.id);const prior=jobs.get(resident.id);
   if(prior?.event.id===event.id)continue;
   const priorAge=prior?now()-Date.parse(prior.event.at):Infinity,expired=!!prior&&(priorAge<0||priorAge>TTL);
   // Retire an expired presentation when a genuinely new fresh receipt arrives.
   // This resets a stale picture to the station; it is not a completed backend
   // action and does not amend any consultation or learning counter.
   if(prior&&!prior.done&&!expired||seen.has(event.id)||cancelled(event))continue;
   let route=routes.get(resident.id);if(route===undefined){route=planSkyRoute(resident.cosmetic&&event.residentId===resident.id?{...resident,cosmetic:false}:resident,{walls});routes.set(resident.id,route);}
   if(!route)continue;
   jobs.set(resident.id,{event,route,elapsed:0,lastMs:receivedAt,returnAt:null,cancelAt:null,cancelDistance:0,done:false,last:null});seen.add(event.id);
   if(seen.size>128)seen.delete(seen.values().next().value);
  }
 }
 function sample(residentId,animationMs){
  const job=jobs.get(residentId);if(!job)return null;
  const eventAge=now()-Date.parse(job.event.at),currentFresh=fresh(animationMs)&&eventAge>=0&&eventAge<=TTL,delta=Number.isFinite(animationMs)&&animationMs>=job.lastMs?Math.min(1000,animationMs-job.lastMs):0;job.lastMs=animationMs;
  if(!currentFresh)return job.last?{...job.last,fresh:false,moving:false,caption:'Consultas · señal sin actualizar'}:null;
  job.elapsed+=delta;const event=job.event,walkMs=Math.max(1200,job.route.distance/1.9*1000);let stage='outbound',distance=0,direction=1;
  if(cancelled(event)){
   if(job.cancelAt===null){job.cancelAt=job.elapsed;job.cancelDistance=Math.min(job.route.distance,job.elapsed/walkMs*job.route.distance);}
   distance=Math.max(0,job.cancelDistance-(job.elapsed-job.cancelAt)/walkMs*job.route.distance);stage=distance>0?'returning':'home';direction=-1;
  }else if(reducedMotion){stage=terminals.has(event.phase)?'home':'meeting';distance=stage==='meeting'?job.route.distance:0;}
  else if(job.elapsed<walkMs){distance=job.elapsed/walkMs*job.route.distance;}
  else if(!terminals.has(event.phase)){stage='meeting';distance=job.route.distance;}
  else{
   if(job.returnAt===null)job.returnAt=job.elapsed+2000;
   if(job.elapsed<job.returnAt){stage='meeting';distance=job.route.distance;}
   else{direction=-1;distance=Math.max(0,job.route.distance-(job.elapsed-job.returnAt)/walkMs*job.route.distance);stage=distance>0?'returning':'home';}
  }
  const resident=residentById(residentId),point=routePosition(job.route,distance,direction);job.done=stage==='home';
  if(stage==='meeting')point.yaw=Math.atan2(2.3-point.position[0],-(-5.5-point.position[2]));
  if(stage==='home'){point.position=[...resident.position];point.yaw=resident.yaw;}
  const record=terminals.has(event.phase),caption=record?icarusEventCaption(event):stage==='outbound'?'Camino al Cielo · consulta':icarusEventCaption(event);
  job.last={eventId:event.id,residentId,position:point.position,yaw:point.yaw,room:roomAt(point.position[0],point.position[2])||resident.room,stage,caption,moving:stage==='outbound'||stage==='returning',active:!job.done,fresh:true,recorded:record,sourceCount:event.sourceCount,usedReferenceCount:event.usedReferenceCount,outcome:event.outcome};
  return job.last;
 }
 return {setState,sample,positionForResident:id=>jobs.get(id)?.last?.position?.slice()||null};
}
