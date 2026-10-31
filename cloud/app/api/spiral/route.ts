import {getChatGPTUser} from '@/app/chatgpt-auth';
import {allowedOrigin,privateHeaders} from '@/lib/server-state';
import {readLab,saveLab} from '@/lib/atlas-lab';
import {initialLearning,runLearningCycle} from '@/lib/atlas-spiral';
import continuity from '@/data/continuity.json';
import native from '@/data/native-principles.json';
export const dynamic='force-dynamic';
const summary=()=>({lastRecoveredAt:continuity.lastRecoveredAt,lastCompleted:continuity.lastCompleted,openQuestion:continuity.openQuestion,nextQuestion:continuity.nextQuestion,target:continuity.target,conversationUrl:continuity.conversationUrl,automationTitle:continuity.automationTitle,synchronization:continuity.synchronization,documents:continuity.documents.map(d=>({id:d.id,title:d.title,date:d.date}))});
export async function GET(){const user=await getChatGPTUser();if(!user)return Response.json({error:'Inicia sesión para abrir la espiral.'},{status:401,headers:privateHeaders});try{const {lab,revision}=await readLab(user.userId);return Response.json({learning:lab.learning||initialLearning(),revision,continuity:summary()},{headers:privateHeaders});}catch{return Response.json({error:'No se pudo recuperar la memoria de ciclos.'},{status:503,headers:privateHeaders});}}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sesión requerida.'},{status:401,headers:privateHeaders});if(!allowedOrigin(request))return Response.json({error:'Origen no autorizado.'},{status:403,headers:privateHeaders});
 try{
  const raw=await request.text();if(raw.length>6000)return Response.json({error:'La pregunta supera el límite.'},{status:413,headers:privateHeaders});const input=JSON.parse(raw);if(input.question!==undefined&&(typeof input.question!=='string'||input.question.length>4000))return Response.json({error:'Pregunta no válida.'},{status:400,headers:privateHeaders});
  const {lab,revision}=await readLab(user.userId);
  const corpus=[{id:'atlas-original-mandate',title:'Atlas Espiral Unificado · mandato del bucle original',text:continuity.automationPrompt,date:continuity.capturedAt,kind:'Mandato recuperado',url:'#spiral'},...continuity.documents.map(d=>({...d,kind:'Archivo histórico',url:'/api/archive?id='+encodeURIComponent(d.id)})),...lab.documents.map(d=>({...d,kind:'Documento aportado',url:d.url||'#corpus'})),...native.map(d=>({...d,url:'#spiral'}))];
  const result=await runLearningCycle(lab.learning||initialLearning(),corpus,{question:input.question});
  const nextRevision=await saveLab(user.userId,{...lab,learning:result.learning},revision);
  return Response.json({learning:result.learning,changed:result.changed,cycle:result.cycle,revision:nextRevision,continuity:summary()},{headers:privateHeaders});
 }catch(e){return Response.json({error:e instanceof Error&&e.message==='CONFLICT'?'Otro proceso avanzó la memoria. Recarga la espiral antes de continuar.':'No se completó el ciclo; no se ha contado un aprendizaje.'},{status:503,headers:privateHeaders});}
}
