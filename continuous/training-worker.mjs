import {parentPort,workerData} from 'node:worker_threads';
import {experiment} from './engine.mjs';
try{
 const result=await experiment(workerData.snapshot,workerData.documents,workerData.steps,()=>false,{...workerData.options,yieldMs:0});
 parentPort.postMessage({ok:true,result});
}catch(error){parentPort.postMessage({ok:false,error:error.message});}
