export class CloudQueueError extends Error {status:number;constructor(message:string,status?:number);}
export function createCloudQueue(db:D1Database,options?:{now?:()=>number;uuid?:()=>string;compileCreative?:(prompt:string,mode:'3d'|'game',options:any)=>{brief:any;code:string}|Promise<{brief:any;code:string}>;enrichMessages?:(messages:Array<{role:string;content:string}>,options:{kind:string;internet:boolean})=>Promise<Array<{role:string;content:string}>>}):{
 enqueue(userId:string,input:Record<string,unknown>):Promise<{jobId:string;conversationId:string;status:string}>;
 status():Promise<Record<string,unknown>>;
 conversations(userId:string):Promise<Record<string,unknown>>;
 conversation(userId:string,id:string):Promise<Record<string,unknown>>;
 getJob(userId:string,id:string):Promise<Record<string,unknown>|null>;
 cancel(userId:string,id:string):Promise<Record<string,unknown>|null>;
 heartbeat(input:Record<string,unknown>):Promise<Record<string,unknown>>;
 claim(input:Record<string,unknown>):Promise<Record<string,unknown>>;
 claimOwned(userId:string,id:string):Promise<{job:null|{id:string;conversationId:string;messages:Array<{role:string;content:string}>;kind:string;question:string;internet:boolean;parameters:Record<string,unknown>;leaseToken:string}}>;
 complete(input:Record<string,unknown>):Promise<Record<string,unknown>>;
 fail(input:Record<string,unknown>):Promise<Record<string,unknown>>;
 observeResidentEvents(telemetry:unknown):Promise<{observed:number}>;
 residentMemories(residentId:string):Promise<{residentId:string;memories:Array<{id:string;processId:string;state:string;phase:string|null;text:string;at:string;observedAt:string}>}>;
};
