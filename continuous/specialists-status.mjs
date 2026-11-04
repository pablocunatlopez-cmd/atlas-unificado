const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const count=value=>Number.isSafeInteger(value)&&value>=0?Math.min(value,1000000000):0;
const elapsed=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?Math.min(value,3600000):null;
const states=new Set(['ok','attention','not-applicable']);
const channels=new Set(['owner-chat','shared-chat','experience']);

/** Owner token is required even for this read-only endpoint. Cross-origin
 * requests with an explicit Origin are rejected before returning any metrics. */
export function specialistStatusAuthorized(headers,token,origin){
 return typeof token==='string'&&token.length>0&&headers?.['x-atlas-token']===token&&(!headers.origin||headers.origin===origin);
}

/** Process-lifetime counters only. Never retain the question, source text,
 * model answer, findings text, paths, URLs, or caller-provided role labels. */
export function createSpecialistTelemetry({catalog,now=Date.now}={}){
 if(!Array.isArray(catalog)||catalog.length!==10||catalog.some(item=>!object(item)||typeof item.id!=='string'||!/^[a-z][a-z0-9-]{0,59}$/.test(item.id))||new Set(catalog.map(item=>item.id)).size!==10)throw new TypeError('Se necesitan diez especialistas únicos.');
 const roles=catalog.map(item=>({id:item.id,name:typeof item.name==='string'?item.name.slice(0,120):item.id})),ids=new Set(roles.map(item=>item.id));
 let reviews=0,checks=0,last=null;
 const counters=new Map(roles.map(item=>[item.id,{runs:0,lastStatus:null,lastAt:null}]));
 const inventory=()=>({available:true,kind:'local-deterministic',independentModels:0,extraApiCalls:0,roles:structuredClone(roles),scope:'Diez funciones locales de revisión. No son diez modelos independientes ni procesos permanentes.'});
 function record(report,channel='owner-chat'){
  if(!object(report)||report.schema!==1||report.kind!=='local-deterministic-review'||report.independentModels!==false||report.modelCalls!==0||report.networkCalls!==0||!channels.has(channel))return false;
  const results=Array.isArray(report.results)?report.results:null;
  if(!results||results.length>10)return false;
  const observed=[],seen=new Set();
  for(const item of results){
   if(!object(item)||!ids.has(item.id)||seen.has(item.id)||item.executed===false||!states.has(item.status))continue;
   observed.push({id:item.id,status:item.status});seen.add(item.id);
  }
  if(!observed.length)return false;
  const clock=now();if(!Number.isFinite(clock))return false;
  const at=new Date(clock).toISOString();reviews=count(reviews+1);checks=count(checks+observed.length);
  for(const item of observed){const prior=counters.get(item.id);counters.set(item.id,{runs:count(prior.runs+1),lastStatus:item.status,lastAt:at});}
  last={at,channel,checks:observed.length,elapsedMs:elapsed(report.elapsedMs),results:observed};
  return true;
 }
 return {catalog:inventory,record,status:()=>({...inventory(),running:false,counterScope:'current-coordinator-process',reviews,checks,last:structuredClone(last),roles:roles.map(item=>({...item,...counters.get(item.id)}))})};
}
