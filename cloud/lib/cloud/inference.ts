import {env} from 'cloudflare:workers';
import {CLOUD_MODEL,generateCloud,reserveInference,pauseInference} from './groq.mjs';
export {CLOUD_MODEL};
export function cloudConfigured(){return !!(env as unknown as {GROQ_API_KEY?:string}).GROQ_API_KEY;}
export async function infer(messages:Array<{role:string;content:string}>,json=false,maxTokens=1500,temperature=0.4,purpose:'chat'|'research'|'coaching'='chat'):Promise<any>{
 return inferModel(CLOUD_MODEL,messages,{json,maxTokens,temperature,purpose});
}
export async function inferModel(model:string,messages:Array<{role:string;content:string}>,{json=false,maxTokens=1500,temperature=0.4,purpose='chat',timeoutMs=22000}:{json?:boolean;maxTokens?:number;temperature?:number;purpose?:'chat'|'research'|'coaching';timeoutMs?:number}={}):Promise<any>{
 const bindings=env as unknown as {GROQ_API_KEY?:string;DB:D1Database};
 return generateCloud({apiKey:bindings.GROQ_API_KEY,messages,json,maxTokens,temperature,model,timeoutMs,reserve:()=>reserveInference(bindings.DB,Date.now(),purpose),pause:(seconds=3600)=>pauseInference(bindings.DB,seconds)});
}
