import {getChatGPTUser} from '@/app/chatgpt-auth';
import {allowedOrigin} from '@/lib/server-state';
import {body,cloudJson,cloudError} from '@/lib/cloud/http';
import {consultInput,recordInput} from '@/lib/collaboration/policy';
import {icarusPayload,consultIcarus,recordIcarusApplication} from '@/lib/collaboration/server';
export const dynamic='force-dynamic';
// Shared vocational work on an owner-private Site. Sites dispatch authenticates
// service calls; no visitor or API model receives a source/deployment credential.
export async function GET(){try{return cloudJson(await icarusPayload());}catch(error){return cloudError(error);}}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(user&&!allowedOrigin(request)||!user&&(request.headers.has('origin')||request.headers.has('sec-fetch-site')))return cloudJson({error:'Origen no autorizado.'},403);
 try{const input=await body(request,8000);if(input.action==='consult'){const parsed=consultInput(input),consultation=await consultIcarus({...parsed,trigger:user||parsed.trigger==='manual'?'manual':'schedule'});return cloudJson({consultation,...await icarusPayload()});}
  if(input.action==='record'){const parsed=recordInput(input),consultation=await recordIcarusApplication(parsed);return cloudJson({consultation,...await icarusPayload()});}
  return cloudJson({error:'Acción no admitida.'},400);
 }catch(error){const code=error instanceof Error?error.message:'';if(['INPUT','RECEIPT','PROPOSAL'].includes(code))return cloudJson({error:'Petición, propuesta o recibo no válidos.'},400);if(code==='NOT_FOUND')return cloudJson({error:'No se encontró esa consulta.'},404);if(['BUSY','CONFLICT','PAUSED','LIMIT'].includes(code))return cloudJson({error:code==='BUSY'?'Ícaro está completando una consulta.':code==='PAUSED'?'Las consultas están pausadas.':'El estado cambió; recarga antes de continuar.'},409);return cloudError(error);}
}
