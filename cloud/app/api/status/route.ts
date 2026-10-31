import {getChatGPTUser} from '@/app/chatgpt-auth';
import {CORE_VERSION} from '@/lib/atlas-core';
export const dynamic='force-dynamic';
export async function GET(){const user=await getChatGPTUser();return Response.json({signedIn:!!user,modelConfigured:true,model:CORE_VERSION,externalModels:false,internet:true,autonomy:'public-research-and-evaluated-retrieval',archiveThrough:594,lastRecoveredCompleted:593},{headers:{'Cache-Control':'private, no-store'}});}
