import {agentEvaluations} from '@/lib/cloud/agent-registry';
import {cloudConfigured,CLOUD_MODEL} from '@/lib/cloud/inference';
import {cloudError,cloudJson,queue} from '@/lib/cloud/http';
export const dynamic='force-dynamic';
export async function GET(){try{if(cloudConfigured()){const models=(await agentEvaluations()).filter(e=>e.status==='qualified');return cloudJson({online:true,configured:true,provider:'groq',modelName:models.length>1?'Atlas · agentes en Groq':models[0]?.model||CLOUD_MODEL,inference:'Groq · sin PC',sessionRequired:true,capabilities:{calculator:true,worlds:true,music:{composition:true,synthesis:'browser'},video:{ready:false,directedCapture:true},independentModels:Math.max(0,models.length-1)}});}return cloudJson(await queue().status());}catch(error){return cloudError(error);}}
