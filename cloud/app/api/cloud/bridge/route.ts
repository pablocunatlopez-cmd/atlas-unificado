import {body,bridgeAuthorized,cloudError,cloudJson,queue} from '@/lib/cloud/http';
import {CloudQueueError} from '@/lib/cloud/queue.mjs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{
  await bridgeAuthorized(request);const input=await body(request,80000),service=queue();
  switch(input.action){
   case 'heartbeat':return cloudJson(await service.heartbeat(input));
   case 'claim':return cloudJson(await service.claim(input));
   case 'complete':return cloudJson(await service.complete(input));
   case 'fail':return cloudJson(await service.fail(input));
   default:throw new CloudQueueError('Acción del puente no reconocida.');
  }
 }catch(error){return cloudError(error);}
}
