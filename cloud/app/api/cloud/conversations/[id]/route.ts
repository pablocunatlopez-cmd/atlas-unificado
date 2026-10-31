import {cloudError,cloudJson,cloudUser,queue} from '@/lib/cloud/http';
export const dynamic='force-dynamic';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){try{const user=await cloudUser(),{id}=await context.params;return cloudJson(await queue().conversation(user.userId,id));}catch(error){return cloudError(error);}}
