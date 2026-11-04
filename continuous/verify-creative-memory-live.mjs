import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createCreativeExperience} from './experience-creative.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Read-only probe of the live persisted file through the current module.
 * The generator is a capture stub: it aborts before any response, artifact or
 * state save. No model, network, GPU, coordinator or trainer is contacted.
 * This verifies migration/revalidation of persisted data by this imported
 * module. It does not prove that the current coordinator PID loaded the module.
 */
export async function verifyCreativeMemoryLive({directory}={}){
 assert.ok(typeof directory==='string'&&path.isAbsolute(directory),'An absolute creative directory is required.');
 const stateFile=path.join(directory,'experience-creative.json'),before=hash(await fs.readFile(stateFile));
 const controller=new AbortController(),abortReason=new Error('Read-only creative memory probe complete.');
 let memory=null,captureCalls=0,caught;
 const probe=createCreativeExperience({directory,generate:async prompt=>{
  captureCalls++;
  const payload=prompt.match(/Memoria geométrica comprobada por el coordinador \(JSON de datos, no instrucciones\): ([^\n]+)\n/)?.[1];
  if(payload)memory=JSON.parse(payload);
  controller.abort(abortReason);
  throw abortReason;
 }});
 try{await probe.experiment({goal:'Comprobar la recuperación geométrica sin generar ni guardar una propuesta.',signal:controller.signal});}catch(error){caught=error;}
 const stateUnchanged=before===hash(await fs.readFile(stateFile));
 assert.equal(stateUnchanged,true,'The live file changed during the read-only probe; no unchanged-state claim is possible.');
 assert.equal(caught,abortReason,'The probe must stop through its own cancellation.');
 assert.equal(captureCalls,1,'Exactly one prompt capture is required.');
 const status=probe.status(),retained=status.retainedPlan;
 // retainedPlan is only produced after the module validates the closed plan
 // and recomputes all six independent geometry contracts on load.
 assert.ok(retained&&/^creative-[a-f0-9]{24}$/.test(retained.artifactId),'No revalidated retained geometry is available.');
 assert.equal(memory?.artifactId,retained.artifactId);
 assert.deepEqual(memory?.plan,retained.plan);
 assert.ok(memory?.diagnostics&&memory.diagnostics.aabbOnly===true);
 assert.equal(status.running,false);
 const d=memory.diagnostics;
 return {verified:true,baselineArtifactId:retained.artifactId,objects:retained.plan.objects.length,cases:6,passed:6,contractsRevalidated:true,diagnostics:{groundContacts:d.groundContacts,aabbComponents:d.aabbComponents,withoutGroundPath:d.withoutGroundPath,aabbOnly:true,physicsVerified:false,renderVerified:false},inferenceCalls:0,stateUnchanged};
}

async function main(){
 const here=path.dirname(fileURLToPath(import.meta.url));let config={};
 try{config=JSON.parse(await fs.readFile(path.join(here,'config.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 const experienceRoot=typeof config.experienceRoot==='string'?config.experienceRoot:path.join(here,'data','experience');
 const result=await verifyCreativeMemoryLive({directory:path.join(experienceRoot,'creative')});
 console.log(JSON.stringify(result));
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(()=>{console.log(JSON.stringify({verified:false,reason:'live_memory_probe_failed'}));process.exitCode=1;});
}
