import {livingBuildInput} from '@/lib/evolution/living-policy';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {allowedOrigin} from '@/lib/server-state';
import {body,cloudJson,cloudError} from '@/lib/cloud/http';
import {livingPayload,buildLiving,livingControl} from '@/lib/evolution/living-server';
export const dynamic='force-dynamic';
// Shared authored works on an owner-private Site; dispatch authenticates service callers.
// Service manual builds are explicitly requested bootstrap operations and retain the total60 cap.
export async function GET(){try{return cloudJson(await livingPayload());}catch(e){return cloudError(e);}}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(user&&!allowedOrigin(request)||!user&&(request.headers.has('origin')||request.headers.has('sec-fetch-site')))return cloudJson({error:'Origen no autorizado.'},403);
 try{const input=await body(request,3000);if(input.action==='build'){const parsed=livingBuildInput(input);const result=await buildLiving({...parsed,trigger:user||parsed.trigger==='manual'?'manual':'schedule'});return cloudJson({result,...await livingPayload()});}
  if(user&&['pause','resume','rollback'].includes(String(input.action)))return cloudJson(await livingControl(input.action as 'pause'|'resume'|'rollback',input.room as string|undefined));
  return cloudJson({error:'Acción no admitida.'},400);
 }catch(e){const code=e instanceof Error?e.message:'';if(code==='INPUT')return cloudJson({error:'Petición de construcción no válida.'},400);if(['BUSY','CONFLICT','PAUSED','NO_HISTORY','ROOM'].includes(code))return cloudJson({error:code==='BUSY'?'Un habitante está construyendo.':code==='PAUSED'?'La construcción está pausada.':code==='NO_HISTORY'?'No hay una versión anterior para esta sala.':'El estado cambió o la sala no es válida.'},409);return cloudError(e);}
}
