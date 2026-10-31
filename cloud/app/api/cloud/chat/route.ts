import {body,cloudError,cloudJson,cloudUser,queue} from '@/lib/cloud/http';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{const user=await cloudUser(request);return cloudJson(await queue().enqueue(user.userId,await body(request)),202);}catch(error){return cloudError(error);}}
