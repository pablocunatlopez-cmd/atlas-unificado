import {waitUntil} from 'cloudflare:workers';
import {cloudConfigured} from '@/lib/cloud/inference';
import {processCloudJob} from '@/lib/cloud/worker';
import {cloudError,cloudJson,cloudUser,queue} from '@/lib/cloud/http';
export const dynamic='force-dynamic';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){try{const user=await cloudUser(),{id}=await context.params;const job=await queue().getJob(user.userId,id);if(cloudConfigured()&&(job?.status==='queued'||job?.status==='running'))waitUntil(processCloudJob(user.userId,id));return cloudJson(job);}catch(error){return cloudError(error);}}
export async function DELETE(request:Request,context:{params:Promise<{id:string}>}){try{const user=await cloudUser(request),{id}=await context.params;return cloudJson(await queue().cancel(user.userId,id));}catch(error){return cloudError(error);}}
