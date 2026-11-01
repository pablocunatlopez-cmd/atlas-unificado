import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createCreativeExperience,evaluateCreativeScene} from './experience-creative.mjs';

const temporaryRoot=os.tmpdir();
const plan=()=>({title:'Sala de observación',variant:'gallery',lighting:'day',palette:'Blanco',design:'Una pieza visible cerca del origen.',objects:[{type:'box',position:[-2,1,0],size:[.5,1,.5],material:5,yaw:0}]});
async function directory(t){await fs.mkdir(temporaryRoot,{recursive:true});const folder=await fs.mkdtemp(path.join(temporaryRoot,'experience-creative-test-'));t.after(async()=>{const resolved=path.resolve(folder);assert.ok(resolved.startsWith(path.resolve(temporaryRoot)+path.sep)&&path.basename(resolved).startsWith('experience-creative-test-'));await fs.rm(resolved,{recursive:true,force:true});});return folder;}
const generator=value=>async prompt=>prompt.startsWith('Actúa como revisor')?JSON.stringify({ok:true,issues:[],suggestion:''}):JSON.stringify(value);
function scene(){return {objects:[{type:'box',position:[-2,1,0],size:[.5,1,.5],material:5,yaw:0}],materials:Array.from({length:12},()=>({color:[.3,.4,.5],roughness:.5,metalness:0,emission:0})),camera:[7,4.1,8],target:[0,1,0],sun:[-.5,.8,.45],sky:[.35,.52,.78],fog:.002,exposure:1};}
const check=(result,id)=>result.checks.find(item=>item.id===id).passed;

test('writes an actual self-contained raster artifact and truthful structural evidence in a temporary directory',async t=>{
 const folder=await directory(t),prompts=[];
 const lab=createCreativeExperience({directory:folder,generate:async(...args)=>{prompts.push(args[0]);return generator(plan())(...args);},now:()=>1793520000000});
 const result=await lab.experiment({goal:{question:'Diseña una sala 3D donde se observe una pieza dorada.'},seed:7});
 assert.equal(result.executed,true);assert.equal(result.cases,6);assert.equal(result.passed,6);assert.equal(result.acceptedChange,false);assert.equal(result.invariantsPreserved,true);assert.equal(result.metrics.renderVerified,false);assert.equal(result.metrics.objects,1);assert.equal(result.metrics.triangles,48);assert.match(result.evidenceHash,/^[a-f0-9]{64}$/);assert.equal(result.newEvidence,true);
 assert.equal(prompts.length,2);assert.match(prompts[0],/sala 3D/);
 const [html,saved,manifest]=await Promise.all([fs.readFile(result.artifactFiles.html,'utf8'),fs.readFile(result.artifactFiles.plan,'utf8'),fs.readFile(result.artifactFiles.manifest,'utf8')]);
 assert.equal(JSON.parse(saved).objects[0].material,5);assert.match(html,/function atlasRasterGeometry/);assert.match(html,/connect-src 'none'/);assert.match(html,/powerPreference:'low-power'/);assert.doesNotMatch(html,/<script[^>]+src=|https?:\/\/|three\.js/i);
 const script=html.match(/<script>([\s\S]*)<\/script>/)?.[1];assert.ok(script);assert.doesNotThrow(()=>new vm.Script(script));
 const meta=JSON.parse(manifest);assert.equal(meta.renderVerified,false);assert.equal(meta.coreChanged,false);assert.equal(meta.modelCodeExecuted,false);assert.deepEqual(meta.checks.map(item=>item.passed),Array(6).fill(true));
 assert.equal(lab.status().artifacts,1);assert.equal(lab.status().jobs.length,1);assert.match(result.summary,/no se han verificado/);
});

test('a schema-valid object below the ground is refuted by an independent contract',async t=>{
 const folder=await directory(t),value=plan();value.objects[0].position[1]=.95;
 const result=await createCreativeExperience({directory:folder,generate:generator(value)}).experiment({goal:'Crea una escultura 3D',seed:2});
 assert.equal(result.executed,false);assert.equal(result.reason,'scene_contract_refuted');assert.equal(result.cases,6);assert.equal(result.passed,5);assert.equal(check(result,'ground_and_endpoints'),false);assert.equal(result.artifactId,null);assert.equal(result.invariantsPreserved,false);
 assert.deepEqual((await fs.readdir(folder)).filter(name=>name.startsWith('creative-')),[]);
 const record=JSON.parse(await fs.readFile(path.join(folder,'experience-creative.json'),'utf8')).jobs[0];assert.equal(record.plan.objects[0].position[1],.95);assert.equal(record.checks.find(item=>item.id==='ground_and_endpoints').passed,false);
});

test('independent geometry checks reject nonfinite coordinates, invalid material uniforms and degenerate camera/light endpoints',()=>{
 const nonfinite=scene();nonfinite.objects[0].position[0]=NaN;assert.equal(check(evaluateCreativeScene(nonfinite),'finite_geometry'),false);
 const material=scene();material.materials[5].emission=Infinity;assert.equal(check(evaluateCreativeScene(material),'materials'),false);
 const camera=scene();camera.target=[...camera.camera];assert.equal(check(evaluateCreativeScene(camera),'ground_and_endpoints'),false);
 const sun=scene();sun.sun=[0,0,0];assert.equal(check(evaluateCreativeScene(sun),'ground_and_endpoints'),false);
 const invalidObjectMaterial=scene();invalidObjectMaterial.objects[0].material=12;assert.equal(check(evaluateCreativeScene(invalidObjectMaterial),'materials'),false);
});

test('camera and player spawn clearance are checked independently, including rotated boxes',()=>{
 const camera=scene();camera.objects=[{type:'box',position:[6,4.1,7],size:[.2,.5,2],material:1,yaw:Math.PI/4}];
 const cameraReport=evaluateCreativeScene(camera);assert.equal(check(cameraReport,'camera_clear'),false);assert.equal(check(cameraReport,'spawn_clear'),true);
 const spawn=scene();spawn.objects=[{type:'sphere',position:[0,1.65,8],size:[1,1,1],material:1,yaw:0}];
 assert.equal(check(evaluateCreativeScene(spawn),'spawn_clear'),false);assert.equal(check(evaluateCreativeScene(spawn),'camera_clear'),true);
});

test('mesh budget counts raster tessellation and contact geometry instead of trusting the model',()=>{
 const many=scene();many.objects=Array.from({length:8},(_,i)=>({type:'sphere',position:[i-4,1,0],size:[.5,.5,.5],material:1,yaw:0}));
 const report=evaluateCreativeScene(many);assert.equal(report.metrics.triangles,3660);assert.equal(check(report,'mesh_budget'),true);
 assert.equal(check(evaluateCreativeScene(many,{maxTriangles:3000}),'mesh_budget'),false);
 many.objects.push({...many.objects[0]});assert.equal(check(evaluateCreativeScene(many),'finite_geometry'),false);
});

test('model text cannot close the trusted script or choose artifact filesystem paths',async t=>{
 const folder=await directory(t),value=plan();value.title='../../</script><script>globalThis.injected=1</script>';
 const result=await createCreativeExperience({directory:folder,generate:generator(value)}).experiment({goal:'Crea una escena 3D',seed:9});
 assert.equal(result.executed,true);const html=await fs.readFile(result.artifactFiles.html,'utf8');
 assert.equal((html.match(/<script>/g)||[]).length,1);assert.equal((html.match(/<\/script>/g)||[]).length,1);assert.doesNotMatch(html,/<script>globalThis\.injected/);assert.match(html,/\\u003c\/script\\u003e/);
 const script=html.match(/<script>([\s\S]*)<\/script>/)[1];assert.doesNotThrow(()=>new vm.Script(script));assert.equal(globalThis.injected,undefined);
 assert.equal(path.dirname(path.dirname(result.artifactFiles.html)),path.resolve(folder));assert.match(path.basename(path.dirname(result.artifactFiles.html)),/^creative-[a-f0-9]{24}$/);
});

test('same geometry with a renamed plan or different seed is not counted as new evidence',async t=>{
 const folder=await directory(t);let value=plan();const lab=createCreativeExperience({directory:folder,generate:async(...args)=>generator(value)(...args)});
 const first=await lab.experiment({goal:'Crea un escenario',seed:1});value={...value,title:'Otro nombre para la misma pieza',design:'Otra descripción.'};
 const second=await lab.experiment({goal:'Crea un escenario',seed:2});assert.equal(first.evidenceHash,second.evidenceHash);assert.notEqual(first.artifactId,second.artifactId);assert.equal(second.newEvidence,false);assert.equal(second.acceptedChange,false);assert.equal(lab.status().evidenceHashes.length,1);
 const copy=lab.status();copy.jobs.length=0;assert.equal(lab.status().jobs.length,2);
 const reloaded=createCreativeExperience({directory:folder,generate:generator(value)});const third=await reloaded.experiment({goal:'Crea un escenario',seed:3});assert.equal(third.newEvidence,false);
});

test('empty geometry and model source code do not produce an executable artifact',async t=>{
 const folder=await directory(t),empty=plan();empty.objects=[];
 const lab=createCreativeExperience({directory:folder,generate:generator(empty)}),result=await lab.experiment({goal:'Crea una escena'});
 assert.equal(result.executed,false);assert.equal(check(result,'finite_geometry'),false);
 const bad=createCreativeExperience({directory:folder,generate:async()=>'<script>throw Error("not a plan")</script>'});
 const invalid=await bad.experiment({goal:'Crea una escena'});assert.equal(invalid.reason,'plan_unavailable');assert.equal(invalid.cases,0);assert.equal(invalid.artifactId,null);
 assert.deepEqual((await fs.readdir(folder)).filter(name=>name.startsWith('creative-')),[]);
});

test('user cancellation propagates without inventing a completed experience',async t=>{
 const folder=await directory(t),controller=new AbortController();
 const lab=createCreativeExperience({directory:folder,generate:async()=>{controller.abort(new Error('user cancelled'));return plan();}});
 await assert.rejects(lab.experiment({goal:'Crea una escena',signal:controller.signal}),/user cancelled/);assert.equal(lab.status().running,false);assert.equal(lab.status().requests,0);assert.deepEqual(await fs.readdir(folder),[]);
});

test('only one creative experiment can consume its generator at a time',async t=>{
 const folder=await directory(t);let release,started;const ready=new Promise(resolve=>{started=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 const lab=createCreativeExperience({directory:folder,generate:async prompt=>{started();await gate;return generator(plan())(prompt);}}),pending=lab.experiment({goal:'Crea una escena'});
 await ready;await assert.rejects(lab.experiment({goal:'Crea otra escena'}),/en curso/);release();assert.equal((await pending).executed,true);assert.equal(lab.status().requests,1);
});

test('a full-length goal survives additional contracts and answer wrappers without truncation',async t=>{
 const folder=await directory(t),ending='FIN-ENCARGO-COMPLETO!!',goal='A'.repeat(4000-ending.length)+ending;assert.equal(goal.length,4000);const prompts=[];
 const lab=createCreativeExperience({directory:folder,generate:async prompt=>{prompts.push(prompt);return {answer:await generator(plan())(prompt)};}});
 const result=await lab.experiment({goal});assert.equal(result.executed,true);assert.ok(prompts[0].includes(goal));assert.match(prompts[0],/Contrato adicional del experimento/);
});
