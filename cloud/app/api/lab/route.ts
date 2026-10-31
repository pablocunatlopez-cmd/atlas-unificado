import {getChatGPTUser} from '@/app/chatgpt-auth';
import {privateHeaders,allowedOrigin} from '@/lib/server-state';
import {readLab,saveLab,labSchema,seedCorpus} from '@/lib/atlas-lab';
import {capabilityTests,CORE_VERSION} from '@/lib/atlas-core';
import seed from '@/data/atlas-lm-seed.json';
export const dynamic='force-dynamic';
export async function GET(){const user=await getChatGPTUser();if(!user)return Response.json({error:'Inicia sesión para abrir el núcleo.'},{status:401,headers:privateHeaders});try{return Response.json({...await readLab(user.userId),core:CORE_VERSION,checks:capabilityTests(),seedCorpus:seedCorpus(),provenance:seed.provenance},{headers:privateHeaders});}catch{return Response.json({error:'El núcleo no ha podido cargar sus datos.'},{status:503,headers:privateHeaders});}}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sesión requerida.'},{status:401,headers:privateHeaders});if(!allowedOrigin(request))return Response.json({error:'Origen no autorizado.'},{status:403,headers:privateHeaders});
 try{const raw=await request.text();if(raw.length>1800000)return Response.json({error:'El corpus y los pesos superan el límite.'},{status:413,headers:privateHeaders});const payload=JSON.parse(raw),parsed=labSchema.safeParse(payload.lab);if(!parsed.success||!Number.isSafeInteger(payload.revision)||payload.revision<0)return Response.json({error:'El corpus o el checkpoint no pasan la validación.'},{status:400,headers:privateHeaders});const revision=await saveLab(user.userId,parsed.data,payload.revision);return Response.json({revision},{headers:privateHeaders});}catch(e){return Response.json({error:e instanceof Error&&e.message==='CONFLICT'?'Hay cambios más recientes. Recarga el núcleo antes de guardar.':'No se guardaron los cambios del núcleo.'},{status:e instanceof Error&&e.message==='CONFLICT'?409:503,headers:privateHeaders});}
}
