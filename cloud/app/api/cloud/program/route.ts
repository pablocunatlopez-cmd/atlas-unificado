import {getChatGPTUser} from '@/app/chatgpt-auth';
import {allowedOrigin} from '@/lib/server-state';
import {body,cloudJson,cloudError} from '@/lib/cloud/http';
import {programCatalog,runProgramTool,verifyProgramLibrary} from '@/lib/cloud/program-tools.mjs';
import {programPayload,runInstalledProgram,restoreProgram} from '@/lib/evolution/program-server';
export const dynamic='force-dynamic';
export async function GET(){return cloudJson({operations:programCatalog(),verification:verifyProgramLibrary(),laboratory:await programPayload(),scope:'Biblioteca fija y programas generados, comprobados y versionados. La ejecución sobre datos no consume inferencia.'});}
// Owner-private Sites boundary. No records, credentials or outside services are read.
export async function POST(request:Request){
 const user=await getChatGPTUser();
 if(user&&!allowedOrigin(request)||!user&&(request.headers.has('origin')||request.headers.has('sec-fetch-site')))return cloudJson({error:'Origen no autorizado.'},403);
 try{
  const input=await body(request,16000);
  if(input.action==='restore'){
   if(!user)return cloudJson({error:'La restauración requiere sesión del propietario.'},403);
   if(typeof input.taskId!=='string'||Object.keys(input).some(k=>!['action','taskId'].includes(k)))return cloudJson({error:'Proyecto no válido.'},400);
   try{return cloudJson(await restoreProgram(input.taskId));}catch(error){return cloudJson({error:error instanceof Error?error.message:'No se pudo restaurar.'},409);}
  }
  if(typeof input.operation!=='string'||!('input' in input)||Object.keys(input).some(k=>!['operation','input'].includes(k)))return cloudJson({error:'Se requiere operation e input.'},400);
  try{return cloudJson(input.operation.startsWith('evolved:')?await runInstalledProgram(input.operation.slice(8),input.input):runProgramTool(input.operation,input.input));}catch(error){return cloudJson({error:error instanceof Error?error.message:'Datos no admitidos.'},400);}
 }catch(error){return cloudError(error);}
}
