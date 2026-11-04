import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeInventory} from './runtime-inventory.mjs';

const AT=Date.parse('2026-11-03T12:00:00.000Z'),root='C:/fixture/private-root';
const snapshot=at=>({checkedAt:new Date(at).toISOString(),readOnly:true,inferenceVerified:false,runtimes:[{id:'ollama',label:'Ollama',endpointCompatible:true,loadedInventoryAvailable:true,loadedRouteModelIds:['qwen3:4b']}]});
const weights=()=>({readOnly:true,configuration:'configured',activeModelVerified:false,weightFiles:[{slot:'primary',modelName:'Qwen.gguf',exists:true,sizeBytes:100}]});
const deferred=()=>{let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};};

test('inventory reads lazily, returns isolated public metadata and obtains routing status on every cache hit',async()=>{
 let probes=0,weightReads=0,routing=0;
 const read=createRuntimeInventory({root,now:()=>AT,probe:async options=>{probes++;assert.equal(options.now(),AT);return snapshot(AT);},inspectWeights:async directory=>{assert.equal(directory,root);weightReads++;return weights();},routerStatus:()=>({sequence:++routing})});
 assert.equal(probes,0);const first=await read();first.snapshot.runtimes[0].loadedRouteModelIds.push('forged');first.weights.weightFiles[0].exists=false;first.providers[0].label='forged';
 const second=await read();assert.equal(probes,1);assert.equal(weightReads,1);assert.deepEqual(second.routing,{sequence:2});assert.deepEqual(second.snapshot.runtimes[0].loadedRouteModelIds,['qwen3:4b']);assert.equal(second.weights.weightFiles[0].exists,true);assert.notEqual(second.providers[0].label,'forged');
 assert.match(second.snapshot.runtimes[0].documentation,/docs\.ollama\.com/);assert.doesNotMatch(JSON.stringify(second),/private-root/);
});

test('concurrent normal and fresh reads share one flight and retain per-response routing status',async()=>{
 const probeGate=deferred(),weightGate=deferred();let probes=0,weightReads=0,routing=0;
 const read=createRuntimeInventory({root,now:()=>AT,probe:()=>{probes++;return probeGate.promise;},inspectWeights:()=>{weightReads++;return weightGate.promise;},routerStatus:()=>({sequence:++routing})});
 const pending=[read(),read({maxAgeMs:5000}),read()];await Promise.resolve();assert.equal(probes,1);assert.equal(weightReads,1);
 probeGate.resolve(snapshot(AT));weightGate.resolve(weights());const results=await Promise.all(pending);
 assert.deepEqual(results.map(result=>result.routing.sequence),[1,2,3]);assert.equal(probes,1);assert.equal(weightReads,1);assert.notStrictEqual(results[0].snapshot,results[1].snapshot);
});

test('30-second normal caching and 5-second health freshness use the same refreshed snapshot',async()=>{
 let at=AT,probes=0;
 const read=createRuntimeInventory({root,now:()=>at,probe:async()=>{probes++;return snapshot(at);},inspectWeights:async()=>weights()});
 await read();at+=6000;assert.equal((await read()).snapshot.checkedAt,new Date(AT).toISOString());assert.equal(probes,1);
 assert.equal((await read({maxAgeMs:5000})).snapshot.checkedAt,new Date(at).toISOString());assert.equal(probes,2);
 at+=30001;await read();assert.equal(probes,3);
});

test('a backwards clock refreshes rather than treating a future cache entry as fresh',async()=>{
 let at=AT,probes=0;
 const read=createRuntimeInventory({root,now:()=>at,probe:async()=>{probes++;return snapshot(at);},inspectWeights:async()=>weights()});
 await read();at-=1000;const result=await read();assert.equal(probes,2);assert.equal(result.snapshot.checkedAt,new Date(at).toISOString());
});

test('invalid, future, stale or duplicate probe data never enters the cache',async()=>{
 const cases=[{...snapshot(AT),checkedAt:'not-a-date'},snapshot(AT+1),snapshot(AT-5001),{...snapshot(AT),readOnly:false},{...snapshot(AT),runtimes:[{id:'ollama'},{id:'ollama'}]}];
 for(const invalid of cases){
  let probes=0;const read=createRuntimeInventory({root,now:()=>AT,probe:async()=>++probes===1?invalid:snapshot(AT),inspectWeights:async()=>weights()});
  await assert.rejects(read(),/Sondeo|Motor/);assert.equal((await read()).snapshot.checkedAt,new Date(AT).toISOString());assert.equal(probes,2);
 }
});

test('failed refreshes release the flight and preserve an older still-valid normal cache',async()=>{
 let at=AT,probes=0;
 const read=createRuntimeInventory({root,now:()=>at,probe:async()=>{if(++probes===2)throw Error('fixture probe failed');return snapshot(at);},inspectWeights:async()=>weights()});
 await read();at+=6000;await assert.rejects(read({maxAgeMs:5000}),/fixture probe failed/);
 assert.equal((await read()).snapshot.checkedAt,new Date(AT).toISOString());assert.equal(probes,2);
 const result=await read({maxAgeMs:5000});assert.equal(probes,3);assert.equal(result.snapshot.checkedAt,new Date(at).toISOString());
});

test('early failure waits for the other reader to settle before another flight can start',async()=>{
 const gate=deferred();let probes=0,weightReads=0;
 const read=createRuntimeInventory({root,now:()=>AT,probe:async()=>++probes===1?gate.promise:snapshot(AT),inspectWeights:async()=>{if(++weightReads===1)throw Error('fixture weights failed');return weights();}});
 const first=read();await Promise.resolve();await Promise.resolve();const second=read({maxAgeMs:5000});
 assert.equal(probes,1);assert.equal(weightReads,1);gate.resolve(snapshot(AT));
 const results=await Promise.allSettled([first,second]);assert.ok(results.every(result=>result.status==='rejected'&&/fixture weights failed/.test(result.reason.message)));
 await read();assert.equal(probes,2);assert.equal(weightReads,2);
});

test('invalid configuration, clocks and freshness limits fail before readers run',async()=>{
 assert.throws(()=>createRuntimeInventory({}),/Lectores/);assert.throws(()=>createRuntimeInventory({root,apiKey:'fixture'}),/Opciones/);
 let calls=0;const read=createRuntimeInventory({root,now:()=>NaN,probe:async()=>{calls++;return snapshot(AT);},inspectWeights:async()=>weights()});await assert.rejects(read(),/Reloj/);assert.equal(calls,0);
 const valid=createRuntimeInventory({root,now:()=>AT,probe:async()=>{calls++;return snapshot(AT);},inspectWeights:async()=>weights()});
 for(const options of [{maxAgeMs:-1},{maxAgeMs:30001},{maxAgeMs:NaN},{signal:new AbortController().signal}])await assert.rejects(valid(options),/Antigüedad|Opciones/);
 assert.equal(calls,0);
});
