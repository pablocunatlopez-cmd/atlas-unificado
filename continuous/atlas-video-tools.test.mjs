import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createVideoTools,videoOptions,wanWorkflow} from './atlas-video-tools.mjs';
async function temporary(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-video-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;}
test('fixed workflow keeps untrusted prompt as text and never accepts user output paths',()=>{
 const id='video-1793470000000-12abcdef',prompt='Una casa\n$(whoami) <script>bad()</script>';
 const graph=wanWorkflow(prompt,id,{seed:1});
 assert.equal(graph['4'].inputs.text,prompt);assert.equal(graph['10'].inputs.filename_prefix,'atlas/'+id);assert.equal(graph['10'].class_type,'SaveWEBM');
 assert.equal(graph['6'].inputs.batch_size,1);assert.equal(graph['6'].inputs.length,17);assert.equal(graph['8'].inputs.steps,5);
 assert.equal(graph['1'].inputs.unet_name,'wan2.1_t2v_1.3B_fp16.safetensors');assert.equal(Object.keys(graph).length,10);
 for(const bad of ['../../private','video-1793470000000-12abcdef/../key','http://remote'])assert.throws(()=>wanWorkflow('Casa',bad));
 assert.throws(()=>wanWorkflow('x'.repeat(2001),id));
});
test('sampling limits bound GPU work and valid Wan frame structure',()=>{
 assert.deepEqual(videoOptions({seed:7}),{frames:17,width:480,height:272,steps:5,fps:8,seed:7});
 for(const value of [{frames:16},{frames:85},{steps:31},{width:1920,height:1080},{width:481},{fps:60},{seed:-1},{frames:1},{height:200}])assert.throws(()=>videoOptions(value));
 assert.equal(videoOptions({frames:81,width:832,height:480,steps:30,seed:0}).frames,81);
});
test('status reports missing installation and downloads rather than fabricated readiness',async t=>{
 const mediaRoot=await temporary(t),requests=[];
 const tools=createVideoTools({mediaRoot,python:path.join(mediaRoot,'python.exe'),request:async url=>{requests.push(url);throw Error('offline');}});
 const status=await tools.videoStatus();assert.equal(status.ready,false);assert.equal(status.runtime.running,false);assert.equal(status.openfield.nativeVideoReady,false);assert.equal(status.models.length,3);assert.ok(status.models.every(model=>model.verified===false));
 assert.equal(status.requiresExclusiveGpu,true);assert.equal(status.downloads.status,'not_started');assert.ok(requests.every(url=>url.startsWith('http://127.0.0.1:8188/')));
 await assert.rejects(tools.startVideoRuntime(),/necesita completar/);
});
test('generation cannot execute before owned runtime and stopping unknown processes is harmless',async t=>{
 const mediaRoot=await temporary(t);let commands=0;
 const tools=createVideoTools({mediaRoot,request:async()=>{throw Error('offline');},run:async()=>{commands++;}});
 await assert.rejects(tools.generateVideo('Una casa'),/Reserva la GPU/);assert.equal(commands,0);
 assert.deepEqual(await tools.releaseVideoRuntime(),{stopped:false,reason:'not_owned_or_not_running'});assert.equal(commands,0);
});
test('a recycled or forged live PID cannot make an unrelated process owned',async t=>{
 const mediaRoot=await temporary(t),python=path.join(mediaRoot,'venv','Scripts','python.exe'),calls=[];
 await fs.writeFile(path.join(mediaRoot,'comfy-runtime.json'),JSON.stringify({pid:process.pid,python,script:path.join(mediaRoot,'ComfyUI','main.py')}));
 const tools=createVideoTools({mediaRoot,python,run:async(executable,args)=>{calls.push({executable,args});return JSON.stringify({executable:process.execPath,command:'node --test atlas-video-tools.test.mjs'});}});
 assert.deepEqual(await tools.releaseVideoRuntime(),{stopped:false,reason:'not_owned_or_not_running'});
 assert.ok(calls.every(call=>!call.executable.toLowerCase().endsWith('taskkill.exe')));
 assert.equal(JSON.parse(await fs.readFile(path.join(mediaRoot,'comfy-runtime.json'),'utf8')).pid,process.pid);
});
test('artifact lookup only serves bounded generated MP4s inside its directory',async t=>{
 const mediaRoot=await temporary(t),tools=createVideoTools({mediaRoot}),id='video-1793470000000-12abcdef';
 await fs.mkdir(path.join(mediaRoot,'artifacts'));await fs.writeFile(path.join(mediaRoot,'artifacts',id+'.mp4'),Buffer.from('valid-test-mp4'));
 const artifact=await tools.resolveVideoArtifact(id);assert.equal(artifact.mime,'video/mp4');assert.equal(artifact.name,id+'.mp4');assert.equal(artifact.bytes.toString(),'valid-test-mp4');
 for(const value of ['../private','../../config.json',id+'.mp4','X:/private',id+'/../private'])assert.equal(await tools.resolveVideoArtifact(value),null);
 const outside=path.join(mediaRoot,'outside.mp4');await fs.writeFile(outside,'secret');
 const linked='video-1793470000001-12abcdef';
 try{await fs.symlink(outside,path.join(mediaRoot,'artifacts',linked+'.mp4'));assert.equal(await tools.resolveVideoArtifact(linked),null);}catch(error){if(error.code!=='EPERM')throw error;}
});
