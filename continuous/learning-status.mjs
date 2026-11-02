// Portable public schema: no PC-only dependencies, code, examples or prompts.
export const LEARNING_CATALOG=Object.freeze({
 'lor-omega-schema':Object.freeze({name:'LOR-ΩΣ · estructura S*',cases:8}),
 'json-pointer-resolve':Object.freeze({name:'Resolver referencias JSON Pointer',cases:8}),
 'dag-dependency-plan':Object.freeze({name:'Planificar dependencias de proyectos',cases:8}),
 'merge-intervals':Object.freeze({name:'Fusionar intervalos',cases:8}),
 'stable-dedupe':Object.freeze({name:'Deduplicar valores conservando orden y tipos',cases:8}),
 'numeric-statistics':Object.freeze({name:'Calcular estadísticas numéricas',cases:8}),
 'json-patch-apply':Object.freeze({name:"Aplicar cambios JSON Patch de forma atómica",cases:8}),
 'csv-parse':Object.freeze({name:"Analizar texto CSV con comillas y campos vacíos",cases:8})
});

function catalog(taskId){return typeof taskId==='string'&&Object.hasOwn(LEARNING_CATALOG,taskId)?LEARNING_CATALOG[taskId]:null;}
function iso(value){
 if(typeof value!=='string'||value.length>35)return null;
 const parts=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
 if(!parts||Number(parts[4])>23||Number(parts[5])>59||Number(parts[6])>59)return null;
 const calendar=new Date(parts[1]+'-'+parts[2]+'-'+parts[3]+'T00:00:00.000Z');
 if(!Number.isFinite(calendar.getTime())||calendar.toISOString().slice(0,10)!==parts.slice(1,4).join('-'))return null;
 const parsed=Date.parse(value);return Number.isFinite(parsed)?new Date(parsed).toISOString():null;
}

/** Rebuild an authenticated public summary at each transport boundary.
 * This validates its closed shape, not a tool's code or execution evidence.
 * The PC builder is responsible for proving eligibility before sending it.
 * Connectivity is supplied independently by the bridge heartbeat.
 */
export function sanitizeLearningStatus(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const reviewEnabled=value.reviewEnabled===true,paused=value.paused===true;
 const pending=catalog(value.pendingTask?.taskId);
 const latest=new Map();
 for(const item of Array.isArray(value.tools)?value.tools.slice(0,128):[]){
  const entry=catalog(item?.taskId),createdAt=iso(item?.createdAt);
  if(!entry||item.cases!==entry.cases||item.passed!==entry.cases||!createdAt)continue;
  const previous=latest.get(item.taskId);
  if(previous&&previous.createdAt>=createdAt)continue;
  latest.set(item.taskId,{taskId:item.taskId,name:entry.name,cases:entry.cases,passed:entry.cases,createdAt});
 }
 const tools=[...latest.values()].sort((a,b)=>a.createdAt<b.createdAt?-1:a.createdAt>b.createdAt?1:a.taskId<b.taskId?-1:a.taskId>b.taskId?1:0);
 return {reviewEnabled,paused,running:reviewEnabled&&!paused&&value.running===true,lastCycleAt:iso(value.lastCycleAt),nextRun:reviewEnabled?iso(value.nextRun):null,pendingTask:reviewEnabled&&pending?{taskId:value.pendingTask.taskId,name:pending.name,cases:pending.cases}:null,tools,approvedTools:tools.length};
}
