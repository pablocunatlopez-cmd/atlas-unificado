import {residentById} from '../../public/house/residents.js';
// Closed public projection for real consultation events. No question, source
// text, URL, model output, private path or claimed improvement crosses here.
const homes=Object.freeze({experience:'mind',suceso:'constellation',chat:'salon',research:'mind',tools:'body',review:'refutation',video:'cinema',creative:'games',core:'language',external:'constellation',lor:'language',weights:'refutation',agents:'constellation'});
const focusProcesses=Object.freeze({programming:'tools',language:'lor','3d':'creative',games:'creative',video:'video',music:'experience',conversation:'chat',research:'research',reasoning:'core',suceso:'suceso',unknown:'experience'});
const focuses=new Set(['programming','language','3d','games','video','music','conversation','research','reasoning','suceso','unknown']);
const activePhases=new Set(['seeking','consulting']);
const terminalPhases=new Set(['returning','blocked']);
const outcomes=Object.freeze({seeking:new Set(['in-progress']),consulting:new Set(['in-progress']),returning:new Set(['sources-observed','references-available']),blocked:new Set(['no-evidence','cooldown','lookup-failed','cancelled','interrupted'])});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const count=value=>Number.isSafeInteger(value)&&value>=0?Math.min(value,1000000000):0;
const date=value=>typeof value==='string'&&value.length<=35&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;

function event(value,terminal){
 if(!object(value)||typeof value.id!=='string'||!/^icarus-[1-9]\d{0,9}$/.test(value.id)||Number(value.id.slice(7))>1000000000)return null;
 if(!Object.hasOwn(homes,value.processId)||!focuses.has(value.focus)||focusProcesses[value.focus]!==value.processId||!(terminal?terminalPhases:activePhases).has(value.phase)||!outcomes[value.phase]?.has(value.outcome))return null;
 const at=date(value.at),startedAt=date(value.startedAt);if(!at||!startedAt||Date.parse(startedAt)>Date.parse(at))return null;
 const sourceCount=Math.min(32,count(value.sourceCount)),usedReferenceCount=Math.min(sourceCount,32,count(value.usedReferenceCount));
 if(value.phase==='returning'?sourceCount===0:sourceCount!==0)return null;
 const resident=typeof value.residentId==='string'?residentById(value.residentId):null;if(value.residentId!==undefined&&(!resident||['sky-agents','sky-sources'].includes(resident.id)))return null;
 return {...(resident?{residentId:resident.id}:{}),id:value.id,phase:value.phase,processId:value.processId,focus:value.focus,sourceRoom:homes[value.processId],destinationRoom:'constellation',at,startedAt,sourceCount,usedReferenceCount,outcome:value.outcome};
}

export function sanitizeIcarusStatus(value){
 if(!object(value)||value.schema!==1)return null;
 const active=event(value.active,false),byId=new Map();
 for(const item of Array.isArray(value.recent)?value.recent.slice(-32):[]){
  const clean=event(item,true);if(!clean||clean.id===active?.id)continue;
  const prior=byId.get(clean.id);if(!prior||Date.parse(clean.at)>=Date.parse(prior.at))byId.set(clean.id,clean);
 }
 const recent=[...byId.values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.id.localeCompare(b.id)).slice(-8);
 const total=count(value.total),completed=Math.min(total,count(value.completed)),blocked=Math.min(total-completed,count(value.blocked));
 return {schema:1,active,recent,total,completed,blocked};
}
