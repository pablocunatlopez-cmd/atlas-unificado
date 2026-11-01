import {env} from 'cloudflare:workers';
import {bridgeAuthorized,cloudError,cloudJson,cloudUser,queue} from '@/lib/cloud/http';
import {byteRange} from '@/lib/cloud/media-range.mjs';
export const dynamic='force-dynamic';
const valid=(id:string)=>/^job-[a-f0-9]{64}$/.test(id);
type Context={params:Promise<{id:string}>};
export async function POST(request:Request,context:Context){
 try{
  await bridgeAuthorized(request);const {id}=await context.params;if(!valid(id))return cloudJson({error:'Archivo no válido.'},400);
  const db=env.DB,bucket=env.BUCKET;if(!db||!bucket)return cloudJson({error:'El almacén de vídeo no está disponible.'},503);
  const lease=request.headers.get('X-Atlas-Lease');const row=await db.prepare("SELECT status,lease_token,lease_until,kind FROM cloud_jobs WHERE id=?").bind(id).first<{status:string;lease_token:string;lease_until:number;kind:string}>();
  if(!row||row.kind!=='video'||row.status!=='running'||row.lease_token!==lease||row.lease_until<Date.now())return cloudJson({error:'La reserva de vídeo ha caducado.'},409);
  if(request.headers.get('content-type')!=='video/mp4')return cloudJson({error:'El formato debe ser MP4.'},415);
  const size=Number(request.headers.get('content-length'));if(!Number.isSafeInteger(size)||size<32||size>10000000)return cloudJson({error:'El archivo excede el límite de 10 MB.'},413);
  const reader=request.body?.getReader();if(!reader)return cloudJson({error:'Falta el archivo.'},400);
  const chunks:Uint8Array[]=[];let received=0;
  for(;;){const item=await reader.read();if(item.done)break;received+=item.value.byteLength;if(received>size||received>10000000){await reader.cancel();return cloudJson({error:'El archivo excede el tamaño declarado.'},413);}chunks.push(item.value);}
  const bytes=new Uint8Array(received);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  if(bytes.byteLength!==size||new TextDecoder().decode(bytes.slice(4,8))!=='ftyp')return cloudJson({error:'El MP4 no es válido.'},400);
  const current=await db.prepare("SELECT status,lease_token,lease_until FROM cloud_jobs WHERE id=?").bind(id).first<{status:string;lease_token:string;lease_until:number}>();
  if(current?.status!=='running'||current.lease_token!==lease||current.lease_until<Date.now())return cloudJson({error:'La reserva cambió durante la subida.'},409);
  await bucket.put('videos/'+id,bytes,{httpMetadata:{contentType:'video/mp4'},customMetadata:{jobId:id,leaseToken:lease!}});
  return cloudJson({artifactId:id,bytes:bytes.byteLength});
 }catch(error){return cloudError(error);}
}
export async function GET(request:Request,context:Context){
 try{
  const user=await cloudUser(),{id}=await context.params;if(!valid(id))return cloudJson({error:'Archivo no encontrado.'},404);
  const job=await queue().getJob(user.userId,id) as {status:string;result?:{video?:{artifactId:string}}}|null;
  if(job?.status!=='completed'||job.result?.video?.artifactId!==id||!env.BUCKET)return cloudJson({error:'El vídeo no está disponible.'},404);
  const key='videos/'+id,head=await env.BUCKET.head(key);if(!head)return cloudJson({error:'Archivo no encontrado.'},404);
  let range;try{range=byteRange(request.headers.get('range'),head.size);}catch{return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+head.size}});}
  const object=await env.BUCKET.get(key,range?{range:{offset:range.offset,length:range.length}}:undefined);if(!object)return cloudJson({error:'Archivo no encontrado.'},404);
  return new Response(object.body,{status:range?206:200,headers:{'Content-Type':'video/mp4','Content-Length':String(range?.length??head.size),'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...(range?{'Content-Range':`bytes ${range.offset}-${range.end}/${head.size}`}:{})}});
 }catch(error){return cloudError(error);}
}
