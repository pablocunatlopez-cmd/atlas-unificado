import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:8788';
const page=await(await fetch(origin+'/chat/')).text();
const token=page.match(/<meta name="atlas-token" content="([^"]+)"/)?.[1];
assert.ok(token,'Local session token unavailable');
async function ask(content){
 return fetch(origin+'/chat/message',{method:'POST',headers:{'Content-Type':'application/json','X-Atlas-Token':token,Origin:origin},signal:AbortSignal.timeout(180000),body:JSON.stringify({sharedSession:true,internet:false,refute:false,messages:[{role:'user',content}]})});
}
const response=await ask('Valida con la herramienta LOR la estructura S* de este JSON e indica el símbolo que falta: {"S":{"O":[],"A":[],"X":[],"R":[],"T":[],"I":[],"C":[],"M":[],"P":[],"F":[],"Σ":[]}}');
const result=await response.json();
assert.equal(response.status,200,JSON.stringify(result));
assert.equal(result.toolRun?.used,true,JSON.stringify(result.toolRun));
assert.deepEqual(result.toolRun.result,{valid:false,missing:['E'],extra:[]});
assert.equal(result.reflectionMemoryUsed,0);
assert.equal(result.attachmentCount,0);
assert.deepEqual(result.sources,[]);
const denied=await ask('/atlas parar');
assert.equal(denied.status,400);
const proof={at:new Date().toISOString(),sharedSession:true,toolUsed:true,toolName:result.toolRun.name,input:result.toolRun.input,result:result.toolRun.result,answer:result.answer,privateReflectionMemory:result.reflectionMemoryUsed,privateSources:result.sources.length,privateControlRejected:denied.status===400,performance:result.performance};
await fs.mkdir(new URL('./verification/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('./verification/public-tools-live-2026-11-01.json',import.meta.url),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof));
