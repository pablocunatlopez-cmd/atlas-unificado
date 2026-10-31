import {cloudError,cloudJson,cloudUser,queue} from '@/lib/cloud/http';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await cloudUser();return cloudJson(await queue().conversations(user.userId));}catch(error){return cloudError(error);}}
