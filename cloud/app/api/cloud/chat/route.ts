import {waitUntil} from 'cloudflare:workers';
import {cloudConfigured} from '@/lib/cloud/inference';
import {processCloudJob} from '@/lib/cloud/worker';
import {CloudQueueError} from '@/lib/cloud/queue.mjs';
import {body,cloudError,cloudJson,cloudUser,queue} from '@/lib/cloud/http';
import {creativeRequest} from '@/lib/studio/scene';
import {requestsAtlasReview} from '@/lib/core/atlas-intent.mjs';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{const user=await cloudUser(request),input=await body(request);if(input.kind===undefined&&typeof input.message==='string'){const mode=creativeRequest(input.message),text=input.message.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(requestsAtlasReview(input.message))input.kind='review';else if(/\b(crea|crear|genera|generar|haz|produce)\b/.test(text)&&/\b(video|clip|pelicula)\b/.test(text))input.kind='video';else if(mode==='3d'||mode==='game')input.kind=mode==='game'?'game':'world';}if(cloudConfigured()&&['video','lor'].includes(String(input.kind)))throw new CloudQueueError('Esta herramienta necesita recursos que no están disponibles en la nube gratuita. El chat y la investigación sí funcionan sin PC.',503);const result=await queue().enqueue(user.userId,input);if(cloudConfigured())waitUntil(processCloudJob(user.userId,result.jobId));return cloudJson(result,202);}catch(error){return cloudError(error);}}
