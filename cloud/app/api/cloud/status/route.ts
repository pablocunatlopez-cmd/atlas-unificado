import {cloudError,cloudJson,queue} from '@/lib/cloud/http';
export const dynamic='force-dynamic';
export async function GET(){try{return cloudJson(await queue().status());}catch(error){return cloudError(error);}}
