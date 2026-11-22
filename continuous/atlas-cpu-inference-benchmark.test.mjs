import {test} from 'node:test';
import assert from 'node:assert/strict';
import {benchmarkAtlasCpuInference} from './atlas-cpu-inference-benchmark.mjs';
test('records deterministic median inference latency',async()=>{
 let tick=0;
 const r=await benchmarkAtlasCpuInference({infer:async()=>({answer:'ok'}),
  runs:3,now:()=>{tick+=10;return tick;}});
 assert.equal(r.medianMs,10);
 assert.equal(r.measurements.length,3);
 assert.equal(r.modelVerified,false);
});
test('rejects invalid benchmark outputs',async()=>{
 await assert.rejects(benchmarkAtlasCpuInference({infer:async()=>({answer:null})}));
});
