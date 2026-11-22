import {test} from 'node:test';
import assert from 'node:assert/strict';
import {probeAtlasCpuHardware} from './atlas-cpu-hardware-probe.mjs';
test('reports CPU and RAM without claiming a GPU',()=>{
 const p=probeAtlasCpuHardware({osApi:{
  totalmem:()=>8*1024**3,freemem:()=>3*1024**3,
  cpus:()=>Array.from({length:8},()=>({}))}});
 assert.equal(p.totalRamMb,8192);
 assert.equal(p.freeRamMb,3072);
 assert.equal(p.logicalCores,8);
 assert.equal(p.recommendedThreads,4);
 assert.equal(p.gpuAvailable,'unverified');
});
test('rejects impossible host memory readings',()=>{
 assert.throws(()=>probeAtlasCpuHardware({osApi:{
  totalmem:()=>1024,freemem:()=>2048,cpus:()=>[{}]}}));
});
