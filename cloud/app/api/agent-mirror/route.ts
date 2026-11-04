import {getAgentMirror} from '@/lib/research/agent-mirror.mjs';

export const dynamic='force-dynamic';

export async function GET(request:Request){
 try{
  return Response.json(await getAgentMirror({signal:request.signal}),{headers:{'Cache-Control':'public, max-age=300, s-maxage=1800','X-Content-Type-Options':'nosniff'}});
 }catch{
  return Response.json({error:'La consulta pública no se completó.'},{status:request.signal.aborted?499:503,headers:{'Cache-Control':'no-store'}});
 }
}
