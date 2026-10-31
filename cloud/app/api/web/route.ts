import {z} from 'zod';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {allowedOrigin,privateHeaders} from '@/lib/server-state';
import {internetForQuestion} from '@/lib/research/chat';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Inicia sesión para consultar la web.'},{status:401,headers:privateHeaders});if(!allowedOrigin(request))return Response.json({error:'Origen no autorizado.'},{status:403,headers:privateHeaders});
 try{const raw=await request.text();if(raw.length>4000)return Response.json({error:'Consulta demasiado larga.'},{status:413,headers:privateHeaders});const parsed=z.object({query:z.string().trim().min(2).max(2000)}).safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:'Consulta no válida.'},{status:400,headers:privateHeaders});return Response.json({search:await internetForQuestion(parsed.data.query)},{headers:privateHeaders});}catch{return Response.json({error:'La búsqueda no se completó. Puedes volver a intentarlo.'},{status:503,headers:privateHeaders});}
}
