import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createLocalCodingAgent,validatePureAgentSource} from './local-coding-agent.mjs';
let parse;try{({parse}=await import(pathToFileURL(path.join(process.env.ATLAS_CODING_AGENT_ROOT||path.join(path.dirname(fileURLToPath(import.meta.url)),'data','agents','aider'),'js-runtime','node_modules','acorn','dist','acorn.mjs')).href));}catch{}
const agentTest=(name,run)=>test(name,{skip:parse?false:'El adaptador opcional de Aider requiere instalar Acorn en su runtime aislado.'},run);
async function fixture(t,runProcess){const root=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-aider-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.mkdir(path.join(root,'venv','Scripts'),{recursive:true});await fs.writeFile(path.join(root,'venv','Scripts','python.exe'),'fixture');await fs.mkdir(path.join(root,'js-runtime','node_modules','acorn','dist'),{recursive:true});await fs.writeFile(path.join(root,'js-runtime','node_modules','acorn','dist','acorn.mjs'),'fixture');await fs.writeFile(path.join(root,'runtime-ready.json'),JSON.stringify({version:'0.86.2'}));return {root,agent:createLocalCodingAgent({root,key:'fixture-local-secret-123456789',runProcess,parse})};}
agentTest('syntax gate permits JSON computation but rejects host capabilities and executable top-level effects',async()=>{
 assert.equal((await validatePureAgentSource('function transform(input){ return input.map(x=>x*2); }',{parse})).pureAst,true);
 assert.equal((await validatePureAgentSource('function transform(input){ return {message:"process is data",value:input}; }',{parse})).syntax,true);
 for(const code of ['import fs from "node:fs"; function transform(input){return input}', 'function transform(input){return process.env}', 'function transform(input){return globalThis}', 'function transform(input){return input.constructor}', 'function transform(input){return Math.random()}', 'const x=fetch("x"); function transform(input){return input}', 'async function transform(input){return input}', 'function transform(a,b){return a}'])await assert.rejects(validatePureAgentSource(code,{parse}));
});
agentTest('Aider receives only a local credential in an isolated environment and external tests gate the artifact',async t=>{
 let environment,invocation;const {agent,root}=await fixture(t,async(command,args,options)=>{environment=options.env;invocation=args;await fs.writeFile(path.join(options.cwd,'artifact.mjs'),'function transform(input){ return input.filter((x,i,a)=>a.indexOf(x)===i); }');return {ok:true,tokensReceived:64};});
 const contract=[{input:[1,1,2],expected:[1,2]},{input:[],expected:[]},{input:[false,0,false,0],expected:[false,0]}];
 const result=await agent.buildCandidate({task:'Deduplica conservando orden.',contract});assert.equal(result.passed,true);assert.equal(result.checks.length,3);assert.equal(result.independentModels,false);assert.equal(environment.OPENAI_API_BASE,'http://127.0.0.1:11435/v1');assert.equal(environment.OPENAI_API_KEY,'fixture-local-secret-123456789');assert.ok(environment.HOME.startsWith(path.join(root,'jobs')));assert.equal(environment.HTTP_PROXY,undefined);assert.equal(environment.GITHUB_TOKEN,undefined);assert.ok(!invocation.some(value=>value.includes('fixture-local-secret')));
 const request=JSON.parse(await fs.readFile(path.join(root,'jobs',result.jobId,'request.json')));assert.doesNotMatch(request.prompt,/fixture-local-secret/);assert.doesNotMatch(request.prompt,/false,0,false,0/);assert.equal((await agent.status()).inferenceVerified,true);
});
agentTest('real QuickJS counterexamples reject a wrong candidate, preserve evidence and never publish an unchecked success',async t=>{
 const {agent}=await fixture(t,async(command,args,options)=>{await fs.writeFile(path.join(options.cwd,'artifact.mjs'),'function transform(input){ return input.sort(); }');return {ok:true};});
 const result=await agent.buildCandidate({task:'Conserva el orden original y elimina duplicados.',contract:[{input:[3,1,3],expected:[3,1]}]});assert.equal(result.passed,false);assert.equal(result.checks[0].passed,false);const status=await agent.status();assert.equal(status.stats.rejected,1);assert.equal(status.stats.passed,0);
});
agentTest('untrusted artifacts cannot bypass the AST gate and diagnostics redact the local key',async t=>{
 const first=await fixture(t,async(command,args,options)=>{await fs.writeFile(path.join(options.cwd,'artifact.mjs'),'function transform(input){ return require("node:fs"); }');return {ok:true};});await assert.rejects(first.agent.buildCandidate({task:'Compute.'}),/capacidad/);assert.equal((await first.agent.status()).inferenceVerified,false);
 const second=await fixture(t,async()=>{throw Error('Bearer fixture-local-secret-123456789');});await assert.rejects(second.agent.buildCandidate({task:'Compute.'}),error=>!error.message.includes('fixture-local-secret'));const stats=await second.agent.status();assert.equal(stats.stats.rejected,1);assert.equal(stats.busy,false);
});
agentTest('concurrent edits and cancellation do not produce an accepted candidate',async t=>{
 let finish;const controller=new AbortController();const {agent}=await fixture(t,async(command,args,options)=>new Promise((resolve,reject)=>{finish=resolve;options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});}));
 const pending=agent.buildCandidate({task:'Compute.'},{signal:controller.signal});while(!finish)await new Promise(resolve=>setImmediate(resolve));await assert.rejects(agent.buildCandidate({task:'Other.'}),/trabajando/);controller.abort(Error('Cancelada'));await assert.rejects(pending,/Cancelada/);assert.equal((await agent.status()).stats.passed,0);assert.equal((await agent.status()).busy,false);
});
