import {cloudError,cloudJson,queue} from '@/lib/cloud/http';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const service=queue(),status=await service.status();
  // The house forms memories autonomously while it polls the bridge. This is a
  // best-effort side effect: a missing migration must not hide live status.
  try{await service.observeResidentEvents((status as {capabilities?:{processTelemetry?:unknown}}).capabilities?.processTelemetry);}catch{}
  return cloudJson(status);
 }catch(error){return cloudError(error);}
}
