import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {allowedOrigin} from '@/lib/server-state';
import {CloudQueueError,createCloudQueue} from './queue.mjs';
import {generateProject} from '@/lib/studio/generator';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export function cloudJson(value:unknown,status=200){return Response.json(value,{status,headers});}
export function queue(){const bindings=env as unknown as {DB?:D1Database};if(!bindings.DB)throw new CloudQueueError('El almacenamiento de Atlas no está disponible.',503);return createCloudQueue(bindings.DB,{compileCreative:generateProject});}
export function cloudError(error:unknown){if(error instanceof CloudQueueError)return cloudJson({error:error.message},error.status);return cloudJson({error:'Atlas no pudo completar esta operación. Inténtalo de nuevo.'},503);}
export async function cloudUser(request?:Request){const user=await getChatGPTUser();if(!user)throw new CloudQueueError('Inicia sesión para conversar con Atlas.',401);if(request&&!allowedOrigin(request))throw new CloudQueueError('Origen no autorizado.',403);return user;}
export async function body(request:Request,maxBytes=48000):Promise<Record<string,unknown>>{
 if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))throw new CloudQueueError('Se requiere JSON.',415);
 if(Number(request.headers.get('content-length'))>maxBytes)throw new CloudQueueError('Solicitud demasiado grande.',413);
 const reader=request.body?.getReader();if(!reader)throw new CloudQueueError('Solicitud vacía.');
 let size=0,text='';const decoder=new TextDecoder();
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>maxBytes){await reader.cancel();throw new CloudQueueError('Solicitud demasiado grande.',413);}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}
 let value;try{value=JSON.parse(text);}catch{throw new CloudQueueError('El JSON no es válido.');}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new CloudQueueError('Se esperaba un objeto JSON.');return value;
}
export async function bridgeAuthorized(request:Request){
 const expected=(env as unknown as {ATLAS_BRIDGE_TOKEN?:string}).ATLAS_BRIDGE_TOKEN;
 if(!expected||expected.length<32)throw new CloudQueueError('El puente con el PC aún no está configurado.',503);
 const supplied=/^Bearer ([A-Za-z0-9_-]{32,200})$/.exec(request.headers.get('authorization')||'')?.[1];if(!supplied)throw new CloudQueueError('Puente no autorizado.',401);
 const encode=new TextEncoder();const [left,right]=await Promise.all([crypto.subtle.digest('SHA-256',encode.encode(expected)),crypto.subtle.digest('SHA-256',encode.encode(supplied))]);
 const a=new Uint8Array(left),b=new Uint8Array(right);let difference=0;for(let index=0;index<a.length;index++)difference|=a[index]^b[index];
 if(difference!==0)throw new CloudQueueError('Puente no autorizado.',401);
}
