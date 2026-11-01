import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {runBoundedCommand} from './secondary-atlas.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
export function createLorLab({root=ROOT,python=process.env.ATLAS_LOR_PYTHON||process.env.ATLAS_LAB_PYTHON||'python',run=runBoundedCommand}={}){
 let busy=false;
 async function status(){try{return {busy,last:JSON.parse(await fs.readFile(path.join(root,'data','lor-experiment.json'),'utf8'))};}catch(error){if(error.code==='ENOENT')return {busy,last:null};throw error;}}
 async function experiment({signal}={}){
  if(busy)throw Error('El experimento LOR ya está en ejecución.');busy=true;
  try{
   const script=path.join(root,'lor-lab.py'),source=path.join(root,'components','atlas597','lor','discrete_holonomy.py');
   const output=await run(python,['-B',script],{cwd:root,signal,timeoutMs:90000,maxOutputBytes:40000,env:{...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1',CUDA_VISIBLE_DEVICES:'',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2'}});
   const value=output.result;if(!value||!['SUPPORTED','TENTATIVE','REDUNDANT','NULL_LIKE','INSUFFICIENT_EVIDENCE','REFUTED','ABSTAIN'].includes(value.verdict)||!['baseline_score','lor_score','delta','negative_control_delta','reparam_delta'].every(key=>Number.isFinite(value[key])))throw Error('El experimento no produjo métricas válidas.');
   const record={at:new Date().toISOString(),verdict:value.verdict,baseline:value.baseline_score,score:value.lor_score,delta:value.delta,negativeControlDelta:value.negative_control_delta,reparamDelta:value.reparam_delta,elapsedMs:output.elapsedMs,synthetic:true,seed:124,samples:72,length:128,sourceSha256:createHash('sha256').update(await fs.readFile(source)).digest('hex'),scope:output.scope};
   await fs.mkdir(path.join(root,'data'),{recursive:true});await fs.writeFile(path.join(root,'data','lor-experiment.json'),JSON.stringify(record,null,2));return record;
  }finally{busy=false;}
 }
 return {status,experiment};
}
