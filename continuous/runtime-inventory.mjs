import {LOCAL_RUNTIME_OPTIONS,PROVIDER_ACCESS_OPTIONS,probeLocalRuntimes,inspectConfiguredChatModels} from './runtime-options.mjs';

const NORMAL_MAX_AGE=30000,FRESH_MAX_AGE=5000;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const copy=value=>structuredClone(value);
const documentation=new Map(LOCAL_RUNTIME_OPTIONS.map(({id,documentation})=>[id,documentation]));

/** Read-only runtime metadata. All consumers share one bounded probe, including
 * callers requesting a fresher health view. Model loading stays outside this
 * reader; routing status is obtained separately for every returned view.
 */
export function createRuntimeInventory(options={}){
 if(!object(options)||Object.keys(options).some(key=>!['root','probe','inspectWeights','routerStatus','now'].includes(key)))throw new TypeError('Opciones de inventario no válidas.');
 const {root,probe=probeLocalRuntimes,inspectWeights=inspectConfiguredChatModels,routerStatus=()=>null,now=Date.now}=options;
 if(typeof root!=='string'||!root.trim()||typeof probe!=='function'||typeof inspectWeights!=='function'||typeof routerStatus!=='function'||typeof now!=='function')throw new TypeError('Lectores de inventario no válidos.');
 let cached=null,inFlight=null;
 const clock=()=>{const at=now();if(!Number.isFinite(at)||!Number.isFinite(new Date(at).getTime()))throw new TypeError('Reloj de inventario no válido.');return at;};
 const view=value=>({snapshot:copy(value.snapshot),weights:copy(value.weights),providers:copy(PROVIDER_ACCESS_OPTIONS),routing:copy(routerStatus())});
 async function refresh(){
  // Wait for both readers to settle before releasing the flight, even if one
  // fails early. Another caller must not start an overlapping probe.
  const results=await Promise.allSettled([Promise.resolve().then(()=>probe({now})),Promise.resolve().then(()=>inspectWeights(root))]);
  for(const result of results)if(result.status==='rejected')throw result.reason;
  const [snapshot,weights]=results.map(result=>result.value),at=clock();
  const sampledAt=typeof snapshot?.checkedAt==='string'?Date.parse(snapshot.checkedAt):NaN,age=at-sampledAt;
  if(!object(snapshot)||snapshot.readOnly!==true||!Number.isFinite(sampledAt)||new Date(sampledAt).toISOString()!==snapshot.checkedAt||age<0||age>FRESH_MAX_AGE||!Array.isArray(snapshot.runtimes)||snapshot.runtimes.length>documentation.size)throw new TypeError('Sondeo de inventario no válido o desactualizado.');
  const seen=new Set();
  for(const runtime of snapshot.runtimes){if(!object(runtime)||!documentation.has(runtime.id)||seen.has(runtime.id))throw new TypeError('Motor del inventario no válido.');seen.add(runtime.id);}
  if(!object(weights)||weights.readOnly!==true||!Array.isArray(weights.weightFiles))throw new TypeError('Inventario de pesos no válido.');
  const value={snapshot:{...copy(snapshot),runtimes:snapshot.runtimes.map(runtime=>({...copy(runtime),documentation:documentation.get(runtime.id)}))},weights:copy(weights),sampledAt};
  cached=value;return value;
 }
 return async function read(options={}){
  if(!object(options)||Object.keys(options).some(key=>key!=='maxAgeMs'))throw new TypeError('Opciones de lectura no válidas.');
  const {maxAgeMs=NORMAL_MAX_AGE}=options;
  if(!Number.isSafeInteger(maxAgeMs)||maxAgeMs<0||maxAgeMs>NORMAL_MAX_AGE)throw new TypeError('Antigüedad de inventario fuera de límites.');
  const at=clock();
  if(inFlight)return view(await inFlight);
  const age=cached?at-cached.sampledAt:Infinity;
  if(cached&&age>=0&&age<=maxAgeMs)return view(cached);
  inFlight=refresh().finally(()=>{inFlight=null;});
  return view(await inFlight);
 };
}
