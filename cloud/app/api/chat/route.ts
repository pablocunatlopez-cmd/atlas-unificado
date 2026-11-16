import {getChatGPTUser} from '@/app/chatgpt-auth';
import {allowedOrigin,privateHeaders,readState,writeEvent} from '@/lib/server-state';
import {chatSchema} from '@/lib/atlas-validation';
import {guidedReply} from '@/lib/atlas-content';
import {makeReply} from '@/lib/atlas-core';
import {recallRecentUserTurn} from '@/lib/core/lia-session-context.mjs';
import {getKnowledge,readLab} from '@/lib/atlas-lab';
import {getResearchKnowledge} from '@/lib/research/server';
import {wantsInternet,internetForQuestion,addInternetReply} from '@/lib/research/chat';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const user=await getChatGPTUser();
 if(!user)return Response.json({error:'Inicia sesión para conversar.'},{status:401,headers:privateHeaders});
 if(!allowedOrigin(request))return Response.json({error:'Origen no autorizado.'},{status:403,headers:privateHeaders});
 try{
  const raw=await request.text();if(raw.length>350000)return Response.json({error:'La conversación es demasiado larga.'},{status:413,headers:privateHeaders});
  const parsed=chatSchema.safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:'Mensaje no válido.'},{status:400,headers:privateHeaders});
  const args=parsed.data;
  if(args.engine==='guided')return Response.json({reply:guidedReply(args.text,args.domain)},{headers:privateHeaders});
  const [{state},{lab},research]=await Promise.all([readState(user.userId),readLab(user.userId),getResearchKnowledge()]);
  let reply=makeReply(args.text,state,[...research.knowledge,...getKnowledge(lab)],args.domain,research.profile);
  if(args.engine==='native'){
   const recall=recallRecentUserTurn(args.text,args.history);
   if(recall)reply={...reply,answer:recall.answer,basis:'Recuperación literal de un mensaje previo proporcionado en esta petición; no se ha consultado memoria persistente.',confidence:recall.found?'Alta':'Limitada',claims:[],sources:[],unknowns:['El historial enviado puede ser parcial y no se ha verificado fuera de esta sesión.'],nextSteps:[],searched:false};
  }
  if(wantsInternet(args.text,args.web))reply=addInternetReply(reply,await internetForQuestion(args.text),research.profile);
  await writeEvent(user.userId,'native_response',{domain:args.domain,engine:'Atlas Core 0.3',sources:reply.sources.length,web:reply.searched});
  return Response.json({reply},{headers:privateHeaders});
 }catch{return Response.json({error:'No se pudo completar la operación del núcleo. Tu mensaje sigue visible.'},{status:503,headers:privateHeaders});}
}
