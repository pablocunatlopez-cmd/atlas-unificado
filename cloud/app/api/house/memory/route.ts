import {cloudError,cloudJson,queue} from '@/lib/cloud/http';

export const dynamic='force-dynamic';

// Read-only view of the world's observations. Writes happen only when the
// bridge reports fresh process telemetry through /api/cloud/status; clients
// cannot inject memories. These rows contain no user or private task data.
export async function GET(request:Request){
 try{
  const residentId=new URL(request.url).searchParams.get('resident')||'';
  return cloudJson(await queue().residentMemories(residentId));
 }catch(error){return cloudError(error);}
}
