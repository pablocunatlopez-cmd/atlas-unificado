export const PROCESS_CATALOG=Object.freeze({chat:{room:'salon',label:'Conversación'},research:{room:'mind',label:'Observación de fuentes'},tools:{room:'body',label:'Ion · herramientas'},review:{room:'refutation',label:'Tribunal de refutación'},video:{room:'cinema',label:'Generación de vídeo'},creative:{room:'games',label:'Arquitecto 3D'},core:{room:'language',label:'Núcleo de estrategias'},external:{room:'constellation',label:'Perspectivas externas'},lor:{room:'language',label:'Experimento LOR-ΩΣ'},weights:{room:'refutation',label:'Pesos Qwen · laboratorio'},agents:{room:'constellation',label:'Agentes programadores'}});
const states=new Set(['idle','running','passed','failed','waiting']),phases=new Set(['observe','understand','connect','apply','refute','retain']);
const count=value=>Number.isSafeInteger(value)&&value>=0?Math.min(value,1000000000):undefined;
export function sanitizeProcessTelemetry(value){
 if(!value||typeof value!=='object')return null;
 const processes=Array.isArray(value.processes)?value.processes.slice(0,12).filter(item=>item&&PROCESS_CATALOG[item.id]&&states.has(item.state)).map(item=>{
  const counters={};for(const key of ['observations','trials','accepted','rejected']){const n=count(item.counters?.[key]);if(n!==undefined)counters[key]=n;}
  return {id:item.id,...PROCESS_CATALOG[item.id],state:item.state,...(phases.has(item.phase)?{phase:item.phase}:{}),counters};
 }):[];
 const c=value.core||{},core={generation:count(c.generation)||0,attempts:count(c.attempts)||0,accepted:count(c.accepted)||0,rejected:count(c.rejected)||0,qwenWeightsChanged:false,method:'StrategyPolicy',version:typeof c.version==='string'&&/^[a-zA-Z0-9._-]{1,100}$/.test(c.version)?c.version:'baseline'};
 const at=typeof value.at==='string'&&Number.isFinite(Date.parse(value.at))?new Date(value.at).toISOString():null;
 const l=value.lor||{},verdict=['SUPPORTED','TENTATIVE','REDUNDANT','NULL_LIKE','INSUFFICIENT_EVIDENCE','REFUTED','ABSTAIN'].includes(l.verdict)?l.verdict:null;
 const metric=v=>typeof v==='number'&&Number.isFinite(v)?Math.max(-10,Math.min(10,v)):null;
 const e=value.evolution,d=e?.download||{},bytes=value=>Number.isSafeInteger(value)&&value>=0?Math.min(value,100000000000):0;
 const evolution=e?{model:'Qwen3.5-9B',prepared:e.prepared===true,ready:e.ready===true,activeAdapter:false,candidatesPrepared:count(e.candidatesPrepared)||0,candidatesTrained:count(e.candidatesTrained)||0,download:{status:['downloading','verifying','verified','completed','failed','error'].includes(d.status)?d.status:'pending',downloadedBytes:bytes(d.downloadedBytes),totalBytes:bytes(d.totalBytes)},experimentalQuantization:true}:null;
 const providerStats=value=>({installed:value?.installed===true,ready:value?.ready===true,inferenceVerified:value?.inferenceVerified===true,attempts:count(value?.attempts)||0,passed:count(value?.passed)||0,failed:count(value?.failed)||0,meanMs:count(value?.attempts)>0&&Number.isFinite(value?.totalMs)?Math.max(0,Math.round(value.totalMs/value.attempts)):count(value?.meanMs)??null});
 const agents=value.agents?{aider:providerStats(value.agents.aider),smolagents:providerStats(value.agents.smolagents),native:providerStats(value.agents.native),independentModels:0,automatic:true}:null;
 return {at,processes,core,evolution,agents,lor:verdict?{verdict,baseline:metric(l.baseline),score:metric(l.score),delta:metric(l.delta),negativeControlDelta:metric(l.negativeControlDelta),synthetic:true}:null};
}
