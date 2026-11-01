import {body,bridgeAuthorized,cloudError,cloudJson,queue} from '@/lib/cloud/http';
import {CloudQueueError} from '@/lib/cloud/queue.mjs';
import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{
  await bridgeAuthorized(request);const input=await body(request,80000),service=queue();
  switch(input.action){
   case 'heartbeat':return cloudJson(await service.heartbeat(input));
   case 'claim':return cloudJson(await service.claim(input));
   case 'complete':{
    const video=(input.result as {video?:{artifactId?:string}}|undefined)?.video;
    if(video){
     if(!env.BUCKET||video.artifactId!==input.jobId||typeof input.jobId!=='string'||!/^job-[a-f0-9]{64}$/.test(input.jobId))throw new CloudQueueError('El MP4 no se ha guardado correctamente.',409);
     const object=await env.BUCKET.head('videos/'+input.jobId);
     if(!object||object.customMetadata?.leaseToken!==input.leaseToken)throw new CloudQueueError('El MP4 no pertenece a la reserva actual.',409);
    }
    return cloudJson(await service.complete(input));
   }
   case 'fail':return cloudJson(await service.fail(input));
   default:throw new CloudQueueError('Acción del puente no reconocida.');
  }
 }catch(error){return cloudError(error);}
}
