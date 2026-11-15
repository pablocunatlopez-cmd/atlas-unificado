import {getChatGPTUser} from '@/app/chatgpt-auth';
import {readState,privateHeaders} from '@/lib/server-state';
import {residentPersonality} from '@/lib/cloud/resident-personality';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Inicia sesión para abrir los criterios de tus habitantes.'},{status:401,headers:privateHeaders});
 const id=new URL(request.url).searchParams.get('resident')||'';
 if(!residentPersonality(id))return Response.json({error:'Habitante desconocido.'},{status:404,headers:privateHeaders});
 try{const saved=await readState(user.userId);return Response.json(residentPersonality(id,JSON.stringify(saved.state)),{headers:privateHeaders});}catch{return Response.json({error:'No se pudieron leer sus criterios.'},{status:503,headers:privateHeaders});}
}
