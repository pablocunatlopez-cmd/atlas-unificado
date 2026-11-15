import {ROOMS} from './layout.js';
import {RESIDENTS} from './residents.js';
import {planSkyRoute} from './sky-journeys.js';
import {validateLivingState} from './living-contract.js';
export function createLivingPresentations({walls,reducedMotion=false}={}){
 const entries=new Map(),positions=new Map();
 return{
  setState(value){const state=validateLivingState(value);for(const resident of RESIDENTS){const artifact=state.artifacts[resident.room];if(!artifact)continue;if(resident.cosmetic||!artifact.proposal.walk||reducedMotion){entries.delete(resident.id);positions.delete(resident.id);continue;}if(entries.get(resident.id)?.artifact.id===artifact.id)continue;const room=ROOMS.find(r=>r.id===resident.room);const route=planSkyRoute(resident,{walls,target:room.spawn});positions.delete(resident.id);entries.set(resident.id,{artifact,route:route?.distance<=12?route:null});}},
  sample(id,time){const entry=entries.get(id);if(!entry||reducedMotion)return null;const {route,artifact}=entry;
   if(!route||route.distance<.1)return{artifactId:artifact.id,title:artifact.proposal.title,moving:false};
   const duration=route.distance/.45,phase=(time+(RESIDENTS.findIndex(r=>r.id===id)*1.7))%(2*duration+6),forward=phase<duration+3;
   const distance=phase<duration?phase*.45:phase<duration+3?route.distance:phase<2*duration+3?route.distance-(phase-duration-3)*.45:0,moving=phase<duration||phase>=duration+3&&phase<2*duration+3;
   let index=1;while(index<route.lengths.length-1&&route.lengths[index]<distance)index++;
   const a=route.points[index-1],b=route.points[index],length=route.lengths[index]-route.lengths[index-1],t=length?(distance-route.lengths[index-1])/length:0,position=[a[0]+(b[0]-a[0])*t,0,a[1]+(b[1]-a[1])*t];positions.set(id,position);
   return{artifactId:artifact.id,title:artifact.proposal.title,position,yaw:Math.atan2((b[0]-a[0])*(forward?1:-1),-(b[1]-a[1])*(forward?1:-1)),moving};
  },
  positionForResident(id){return positions.get(id)||null;}
 };
}
