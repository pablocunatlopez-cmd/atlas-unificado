export class CloudQueueError extends Error {status:number;constructor(message:string,status?:number);}
export function createCloudQueue(db:D1Database,options?:{now?:()=>number;uuid?:()=>string}):{
 enqueue(userId:string,input:Record<string,unknown>):Promise<{jobId:string;conversationId:string;status:string}>;
 status():Promise<Record<string,unknown>>;
 conversations(userId:string):Promise<Record<string,unknown>>;
 conversation(userId:string,id:string):Promise<Record<string,unknown>>;
 getJob(userId:string,id:string):Promise<Record<string,unknown>|null>;
 cancel(userId:string,id:string):Promise<Record<string,unknown>|null>;
 heartbeat(input:Record<string,unknown>):Promise<Record<string,unknown>>;
 claim(input:Record<string,unknown>):Promise<Record<string,unknown>>;
 complete(input:Record<string,unknown>):Promise<Record<string,unknown>>;
 fail(input:Record<string,unknown>):Promise<Record<string,unknown>>;
};
