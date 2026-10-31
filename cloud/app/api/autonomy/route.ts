import {z} from 'zod';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {allowedOrigin,privateHeaders} from '@/lib/server-state';
import {researchPayload,configureResearch,rollbackResearch,runResearch,linkResearchSchedule} from '@/lib/research/server';
import {TOPICS} from '@/lib/research/topics';
import {PUBLIC_HOSTS} from '@/lib/research/web';
export const dynamic='force-dynamic';
// Shared public-source research on an owner-private Site. Sites dispatch authenticates
// service callers. Service access is not a visitor and cannot change personal settings.
// Do not broaden Site access without replacing this shared updater authorization.
export async function GET(){try{return Response.json({...await researchPayload(),topics:TOPICS,publicHosts:PUBLIC_HOSTS,workflow:{run:'/api/autonomy',method:'POST',body:{action:'run',trigger:'schedule',requestId:'scheduled:<UTC YYYY-MM-DDTHH>'},readback:'GET /api/autonomy; find returned run.id in runs',dataOnly:true}},{headers:privateHeaders});}catch{return Response.json({error:'No se pudo abrir la investigación.'},{status:503,headers:privateHeaders});}}
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('run'),query:z.string().trim().min(2).max(500).optional(),url:z.string().max(2000).optional(),trigger:z.enum(['manual','schedule']).default('manual'),requestId:z.string().min(1).max(120)}),
 z.object({action:z.literal('configure'),enabled:z.boolean(),revision:z.number().int().min(0)}),
 z.object({action:z.literal('rollback'),revision:z.number().int().min(0)}),
 z.object({action:z.literal('schedule-linked'),schedule:z.object({id:z.string().min(1).max(120),label:z.string().max(180),timezone:z.literal('Europe/Madrid'),isEnabled:z.boolean()})})
]);
export async function POST(request:Request){
 const user=await getChatGPTUser();
 if(user&&!allowedOrigin(request))return Response.json({error:'Origen no autorizado.'},{status:403,headers:privateHeaders});
 if(!user&&(request.headers.has('origin')||request.headers.has('sec-fetch-site')))return Response.json({error:'La actualización de servicio requiere acceso de Sites.'},{status:403,headers:privateHeaders});
 try{
  const raw=await request.text();if(raw.length>5000)return Response.json({error:'La petición supera el límite.'},{status:413,headers:privateHeaders});
  const parsed=schema.safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:'Petición no válida.'},{status:400,headers:privateHeaders});const input=parsed.data;
  if(!user&&input.action!=='schedule-linked'&&(input.action!=='run'||input.trigger!=='schedule'||input.query||input.url))return Response.json({error:'El servicio solo ejecuta la agenda pública guardada.'},{status:403,headers:privateHeaders});
  const payload=input.action==='configure'?await configureResearch(input.enabled,input.revision):input.action==='rollback'?await rollbackResearch(input.revision):input.action==='schedule-linked'?await linkResearchSchedule(input.schedule):await runResearch(input);
  return Response.json(payload,{headers:privateHeaders});
 }catch(e){const code=e instanceof Error?e.message:'';return Response.json({error:code==='BUSY'?'Ya hay una investigación en curso.':code==='CONFLICT'?'El estado cambió durante la operación. Recarga antes de continuar.':'No se completó la investigación; no se ha contado un aprendizaje.'},{status:code==='BUSY'||code==='CONFLICT'?409:503,headers:privateHeaders});}
}
