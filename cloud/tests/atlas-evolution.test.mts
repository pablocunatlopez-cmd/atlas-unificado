import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext,Script} from 'node:vm';
import {baselineProfiles,runCapabilityTrial,meshError} from '../lib/evolution/benchmarks.ts';
import {initialSpiral,advanceSpiral,BRANCHES} from '../lib/evolution/spiral.ts';
import {audioFeatures,masterChannels,imageFeatures} from '../lib/evolution/signals.ts';
import {generateProject} from '../lib/studio/generator.ts';
import {buildResearchRun,initialControl} from '../lib/research/engine.ts';
import {WORLD_ENTITIES,initialWorld,selectWorldActor,advanceWorld} from '../lib/evolution/world.ts';

test('graphics proposals reduce actual geometry error and converge without claiming endless promotions',()=>{
 let profiles=baselineProfiles();const errors=[];for(let i=0;i<3;i++){const result=runCapabilityTrial('graphics',profiles);assert.ok(result.trial.checks.every(c=>c.passed));errors.push(result.trial.after);profiles=result.profiles;assert.equal(result.trial.decision,i<2?'promoted':'verified');}assert.equal(profiles.meshRows,24);assert.ok(errors[1]<errors[0]);assert.ok(meshError(24).triangles<=2000);
 const ctx=createContext({});runInContext(readFileSync(new URL('../lib/studio/runtime-source.js',import.meta.url),'utf8'),ctx);
 for(const rows of [12,18,24]){const g=runInContext(`atlasRasterGeometry('sphere',${rows})`,ctx);let error=0;for(let i=0;i<g.position.length;i+=9){const p=[0,0,0];for(let j=0;j<3;j++)for(let k=0;k<3;k++)p[k]+=g.position[i+j*3+k]/3;error=Math.max(error,1-Math.hypot(...p));}assert.ok(Math.abs(error-meshError(rows).error)<1e-6,'bench matches the real raster mesh');}
});
test('audio mastering preserves stereo ratio, silence, headroom and DC across independent signals',()=>{
 const result=runCapabilityTrial('audio',baselineProfiles());assert.equal(result.trial.decision,'promoted');assert.equal(runCapabilityTrial('audio',result.profiles).trial.decision,'verified');
 for(const period of [17,51,123]){const a=Float32Array.from({length:period*20},(_,i)=>.35+1.8*Math.sin(2*Math.PI*i/period)),b=Float32Array.from(a,v=>v*.3),processed=masterChannels([a,b]);assert.ok(processed.gain<=1);for(const c of processed.channels){const f=audioFeatures(c,44100);assert.ok(f.peak<=.94001);assert.ok(Math.abs(f.mean)<1e-6);assert.equal(f.clipped,0);}assert.ok(processed.channels[1].every((v,i)=>Math.abs(v-processed.channels[0][i]*.3)<1e-6));}
 assert.throws(()=>masterChannels([new Float32Array(2),new Float32Array(1)]));assert.throws(()=>masterChannels([new Float32Array(2)],NaN));
});
test('perception measures data and rejects invalid dimensions without inventing semantics',()=>{
 assert.equal(audioFeatures(new Float32Array(20),16000).rms,0);assert.equal(audioFeatures(new Float32Array([Infinity,0,NaN]),16000).invalid,2);
 const p=imageFeatures(new Uint8ClampedArray([0,0,0,255,255,255,255,255]),2,1);assert.ok(Math.abs(p.luminance-.5)<1e-6);assert.ok(p.edgeEnergy>.99);assert.throws(()=>imageFeatures(new Uint8ClampedArray(4),-1,1));assert.ok(runCapabilityTrial('perception',baselineProfiles()).trial.checks.every(c=>c.passed));
});
test('compiled calculator uses tested function including unsupported operation rejection',()=>{
 assert.equal(generateProject('Una landing minimalista','code').brief.variant,'landing');const code=generateProject('Una calculadora','code').code.match(/<script>([\s\S]*?)<\/script>/)![1],nodes:Record<string,any>={'#a':{value:'1'},'#b':{value:'2'},'#op':{value:'bad'},'#result':{textContent:''}};new Script(code).runInContext(createContext({document:{querySelector:(q:string)=>nodes[q],querySelectorAll:()=>Object.values(nodes)},parent:{postMessage(){}}}));assert.equal(nodes['#result'].textContent,'Operación no válida');assert.ok(runCapabilityTrial('programming',baselineProfiles()).trial.checks.every(c=>c.passed));
 const high=generateProject('Una esfera','3d',{meshRows:24});assert.equal(high.brief.meshRows,24);assert.match(high.code,/"meshRows":24/);
});
test('nested spirals rotate fairly, preserve unresolved questions, lineage and previous state',async()=>{
 let state=initialSpiral();const snapshot=structuredClone(state);const base=(await buildResearchRun({control:initialControl(),known:[],knownHashes:new Set(),fetched:[],attempts:[],question:'Pregunta',query:'WebGL',trigger:'schedule',id:'r',requestId:'r',started:0,date:'2026-11-11'})).run;
 for(let i=0;i<8;i++){const id='run-'+i,branch=state.branches[state.cursor],trial=runCapabilityTrial(branch.id,state.profiles),run={...base,id,deliberation:i===0?{model:'test',status:'unavailable' as const,error:'quota'}:{model:'test',status:'completed' as const,reflection:{conclusion:'Provisional',claims:[],uncertainties:['Falta contraste'],nextQuestion:'Hija de '+id,nextQuery:'child query'}}};const next=advanceSpiral(state,run,trial.trial,trial.profiles);assert.equal(next.turn.branch,BRANCHES[i%4].id);assert.equal(next.turn.parentRunId,i>=4?'run-'+(i-4):null);if(i===0){assert.equal(next.state.branches[0].question,snapshot.branches[0].question);assert.equal(next.state.branches[0].status,'waiting');}state=next.state;}
 assert.deepEqual(initialSpiral(),snapshot);assert.equal(state.turns,8);assert.ok(state.branches.every(b=>b.turns===2));assert.equal(state.branches[1].depth,3);
});
test('all real rooms and residents have stable roles and isolated memories; round robin reaches every inhabitant',async()=>{
 let world=initialWorld();const visited=new Set(),before=structuredClone(world);assert.equal(WORLD_ENTITIES.filter(e=>e.kind==='resident').length,24);assert.equal(WORLD_ENTITIES.filter(e=>e.kind==='room').length,10);assert.equal(Object.keys(world.memories).length,38);assert.ok(WORLD_ENTITIES.every(e=>e.personality&&e.role));
 const base=(await buildResearchRun({control:initialControl(),known:[],knownHashes:new Set(),fetched:[],attempts:[],question:'Q',query:'audio',trigger:'schedule',id:'r',requestId:'r',started:0,date:'2026-11-11'})).run;
 for(const module of ['graphics','programming','audio','perception'] as const){const total=WORLD_ENTITIES.filter(e=>e.kind==='resident'&&e.module===module).length;for(let i=0;i<total;i++){const actor=selectWorldActor(world,module);assert.ok(!visited.has(actor.id));visited.add(actor.id);const run={...base,id:actor.id,deliberation:{model:'test',status:'completed' as const,reflection:{conclusion:actor.name,uncertainties:['duda'],claims:[],nextQuestion:'hija',nextQuery:'query'}}};const result=advanceWorld(world,actor,run,runCapabilityTrial(module,baselineProfiles()).trial);assert.equal(result.receipt.actorId,actor.id);assert.equal(result.world.memories[actor.id].reflections,1);assert.equal(result.world.memories['room:'+actor.room].lastRunId,actor.id);world=result.world;}}
 assert.equal(visited.size,24);assert.equal(before.memories['resident:music-console'].turns,0);assert.equal(world.memories['resident:music-console'].conclusion,'Noa · composición');assert.equal(world.memories['resident:music-mixer'].conclusion,'Ritmo · mezcla');
 const actor=selectWorldActor(world,'audio'),prior=world.memories[actor.id].reflections,result=advanceWorld(world,actor,base,runCapabilityTrial('audio',baselineProfiles()).trial);assert.equal(result.receipt.status,'waiting');assert.equal(result.world.memories[actor.id].reflections,prior);
});
