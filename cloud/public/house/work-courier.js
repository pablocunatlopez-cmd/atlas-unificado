import {ROOMS,WALLS,blocked,roomAt} from './layout.js';
import {residentById} from './residents.js';
import {planSkyRoute,ICARUS_MEETING_POINT} from './sky-journeys.js';

const TTL=180000,GESTURE_TTL=15000,SPEED=1.9,MESSENGER='language-symbol';
const statuses=new Set(['applied','tested','unchanged','waiting','rejected']);
const operations=new Set(['research','tool','program','engineering']);
const stamp=value=>typeof value==='string'&&value.length<=35&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const count=(value,max)=>Number.isInteger(value)&&value>=0&&value<=max;

// Closed, authenticated work receipts only: no dialogue, paths, URLs or code
// cross into the renderer. A delivered result is not a newly executed job.
export function normalizeHouseWork(value){
 if(!value||value.schema!==1||!Array.isArray(value.events))return null;
 const events=[],seen=new Set();
 for(const raw of value.events.slice(-24)){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||typeof raw.id!=='string'||raw.id.length!==41||!/^work-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(raw.id)||seen.has(raw.id)||raw.messengerId!==MESSENGER||!residentById(raw.workerId)||!statuses.has(raw.status)||!operations.has(raw.operation)||!count(raw.sourceCount,2)||!count(raw.artifactCount,4)||!count(raw.modelSteps,2)||!Array.isArray(raw.recipientIds)||raw.recipientIds.length>2||raw.recipientIds.some(id=>!residentById(id)))continue;
  const at=stamp(raw.at),startedAt=stamp(raw.startedAt);if(!at||!startedAt||Date.parse(startedAt)>Date.parse(at))continue;
  seen.add(raw.id);events.push({id:raw.id,workerId:raw.workerId,messengerId:MESSENGER,recipientIds:[...new Set(raw.recipientIds)].filter(id=>id!==MESSENGER),status:raw.status,at,startedAt,sourceCount:raw.sourceCount,artifactCount:raw.artifactCount,modelSteps:raw.modelSteps,operation:raw.operation});
 }
 return{schema:1,events};
}

function approach(id,walls){
 const r=residentById(id);if(!r)return null;
 const [x,,z]=r.position,room=ROOMS.find(room=>room.id===r.room);
 const candidates=[[x+Math.sin(r.yaw),z-Math.cos(r.yaw)],[x+1,z],[x-1,z],[x,z+1],[x,z-1],room?.spawn];
 return candidates.find(p=>Array.isArray(p)&&roomAt(...p)===r.room&&!blocked(...p,.22,walls))||null;
}
function routePoint(route,distance){
 const d=Math.max(0,Math.min(route.distance,distance));let i=1;
 while(i<route.lengths.length-1&&route.lengths[i]<d)i++;
 const a=route.points[i-1],b=route.points[i],span=route.lengths[i]-route.lengths[i-1],t=span?(d-route.lengths[i-1])/span:0;
 return{position:[a[0]+(b[0]-a[0])*t,0,a[1]+(b[1]-a[1])*t],yaw:Math.atan2(b[0]-a[0],-(b[1]-a[1]))};
}
export function planWorkDelivery(event,{walls=WALLS}={}){
 const safe=normalizeHouseWork({schema:1,events:[event]})?.events[0];
 if(!safe||safe.operation!=='research'||safe.sourceCount+safe.modelSteps===0||!safe.recipientIds.length)return null;
 const messenger=residentById(MESSENGER),stops=[{point:[...ICARUS_MEETING_POINT],stage:'meeting',targetId:'sky-agents'},...safe.recipientIds.map(id=>({point:approach(id,walls),stage:'delivering',targetId:id})),{point:[messenger.position[0],messenger.position[2]],stage:'home',targetId:MESSENGER}];
 if(stops.some(stop=>!stop.point))return null;
 let start=messenger.position;const legs=[];
 for(const stop of stops){
  const route=planSkyRoute({...messenger,position:start},{walls,target:stop.point});if(!route)return null;
  legs.push({...stop,route,duration:Math.max(500,route.distance/SPEED*1000),hold:stop.stage==='home'?0:2200});start=[stop.point[0],0,stop.point[1]];
 }
 return legs;
}

export function createWorkCourier({now=Date.now,walls=WALLS,reducedMotion=false}={}){
 const seen=new Set(),queue=[],assignments=new Map();let connected=false,sourceAge=Infinity,receivedAt=-Infinity,job=null;
 const fresh=ms=>connected&&Number.isFinite(sourceAge)&&sourceAge>=0&&Number.isFinite(ms)&&ms>=receivedAt&&sourceAge+ms-receivedAt<=TTL;
 const age=event=>now()-Date.parse(event.at);
 function remember(id){seen.add(id);if(seen.size>256)seen.delete(seen.values().next().value);}
 function start(ms){
  while(!job&&queue.length){const entry=queue.shift();if(age(entry.event)<0||age(entry.event)>TTL)continue;job={...entry,elapsed:0,lastMs:ms,last:null,done:false};}
 }
 return{
  setState(value,{connected:online=false,sourceAgeMs=Infinity,receivedAtMs=0}={}){
   connected=online===true;sourceAge=sourceAgeMs;receivedAt=Number.isFinite(receivedAtMs)?receivedAtMs:-Infinity;
   const state=normalizeHouseWork(value);if(!state||!fresh(receivedAt))return;
   if(job&&(age(job.event)<0||age(job.event)>TTL))job=null;
   for(const event of state.events){
    const elapsed=age(event);if(elapsed<0||elapsed>TTL)continue;
    const previous=assignments.get(event.workerId);if(!previous||Date.parse(previous.at)<=Date.parse(event.at))assignments.set(event.workerId,event);
    if(seen.has(event.id))continue;remember(event.id);
    const legs=planWorkDelivery(event,{walls});if(legs){queue.push({event,legs});if(queue.length>8)queue.shift();}
   }
   start(receivedAt);
  },
  workForResident(id,animationMs){
   const event=assignments.get(id);if(!event||!fresh(animationMs)||age(event)<0||age(event)>GESTURE_TTL)return null;
   return{eventId:event.id,operation:event.operation,status:event.status,state:event.status==='rejected'?'failed':event.status==='waiting'?'waiting':'passed',phase:event.status==='rejected'?'refute':'apply',gesture:event.status!=='waiting',displayState:event.status==='waiting'?'Tarea en espera':event.status==='rejected'?'Resultado rechazado · reciente':'Resultado comprobado · reciente',recorded:true};
  },
  sample(id,animationMs){
   if(id!==MESSENGER)return null;
   if(job?.done){job=null;start(animationMs);}if(!job)return null;
   const event=job.event,currentFresh=fresh(animationMs)&&age(event)>=0&&age(event)<=TTL;
   const delta=Number.isFinite(animationMs)&&animationMs>=job.lastMs?Math.min(1000,animationMs-job.lastMs):0;job.lastMs=animationMs;
   if(!currentFresh)return job.last?{...job.last,fresh:false,moving:false,caption:'Entrega · señal sin actualizar'}:null;
   job.elapsed+=delta;
   if(reducedMotion){job.done=true;return null;}
   let remaining=job.elapsed,leg=job.legs[0],moving=true;
   for(const candidate of job.legs){leg=candidate;if(remaining<candidate.duration)break;remaining-=candidate.duration;if(remaining<candidate.hold){moving=false;break;}remaining-=candidate.hold;if(candidate.stage==='home'){job.done=true;moving=false;break;}}
   const p=routePoint(leg.route,moving?remaining/leg.duration*leg.route.distance:leg.route.distance),target=residentById(leg.targetId);
   const stage=job.done?'home':moving?leg.stage==='meeting'?'outbound':leg.stage==='home'?'returning':'to-recipient':leg.stage;
   if(!moving&&target)p.yaw=Math.atan2(target.position[0]-p.position[0],-(target.position[2]-p.position[2]));
   if(job.done){p.position=[...residentById(MESSENGER).position];p.yaw=residentById(MESSENGER).yaw;}
   const caption=stage==='meeting'?'Siggy · consulta registrada':stage==='delivering'?'Siggy · entrega de resultado':stage==='to-recipient'?'Siggy · hacia especialista':stage==='returning'?'Siggy · vuelve a su puesto':'Siggy · camino al cielo';
   job.last={eventId:event.id,residentId:MESSENGER,position:p.position,yaw:p.yaw,room:roomAt(p.position[0],p.position[2])||'language',stage,caption,moving:!job.done&&moving,active:!job.done,fresh:true,recorded:true,sourceCount:event.sourceCount,usedReferenceCount:0,outcome:event.status,recipientId:stage==='delivering'?leg.targetId:null,houseWork:true};return job.last;
  },
  positionForResident(id){return id===MESSENGER?job?.last?.position?.slice()||null:null;}
 };
}
