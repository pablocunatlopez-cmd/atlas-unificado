import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentMirror,sanitizeAgentMirror} from './agent-mirror.mjs';

const AT=Date.UTC(2026,10,3),TTL=1800000;
function payload(url,changes={}){const repository=new URL(url).pathname.slice('/repos/'.length);return{full_name:repository,html_url:'https://github.com/'+repository,private:false,archived:false,disabled:false,visibility:'public',updated_at:'2026-11-01T10:00:00Z',license:{spdx_id:'MIT'},description:'Untrusted description must not recur',...changes};}
const response=(url,changes={})=>Response.json(payload(url,changes));

test('edge-compatible manual redirects never follow a repository response to another destination',async()=>{
 const calls=[],get=createAgentMirror({now:()=>AT,fetch:async(url,options)=>{assert.equal(options.redirect,'manual');calls.push(url);return new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}});}});
 const value=await get();assert.equal(calls.length,6);assert.equal(value.items.length,0);assert.ok(value.errors.every(item=>item.reason==='http-error'));assert.doesNotMatch(JSON.stringify(calls),/127\.0\.0\.1/);
});

test('fixed public metadata is fetched without prompts, credentials or import-time work and produces a closed snapshot',async()=>{
 const seen=[];const get=createAgentMirror({now:()=>AT,fetch:async(url,options)=>{seen.push([url,options]);return response(url);}});assert.equal(seen.length,0);
 const value=await get({question:'private prompt ignored',url:'https://evil.example/'});assert.equal(seen.length,6);assert.equal(value.status,'ready');assert.equal(value.items.length,6);assert.equal(value.externalModels.claude.connected,false);
 assert.equal(new Set(seen.map(([url])=>url)).size,6);for(const[url,options]of seen){assert.match(url,/^https:\/\/api\.github\.com\/repos\//);assert.equal(options.redirect,'manual');assert.equal(options.method,'GET');assert.equal(Object.keys(options.headers).some(key=>/auth|token/i.test(key)),false);}
 assert.doesNotMatch(JSON.stringify(value),/private prompt|evil\.example|Untrusted description/);assert.ok(value.items.every(item=>item.installationVerified===false&&item.executionVerified===false&&item.license.verification==='github-rest-metadata'));
});

test('singleflight coalesces concurrent callers and positive cache lasts at least thirty minutes',async()=>{
 let calls=0,clock=AT,release;const gate=new Promise(resolve=>release=resolve);
 const get=createAgentMirror({now:()=>clock,ttlMs:1,fetch:async url=>{calls++;await gate;return response(url);}});
 const first=get(),second=get();release();const[a,b]=await Promise.all([first,second]);assert.equal(calls,6);assert.deepEqual(a,b);a.items.length=0;assert.equal((await get()).items.length,6);
 clock+=TTL-1;await get();assert.equal(calls,6);clock+=2;await get();assert.equal(calls,12);
});

test('network failures are negative-cached instead of retrying for every public visitor',async()=>{
 let calls=0,clock=AT;const get=createAgentMirror({now:()=>clock,fetch:async()=>{calls++;throw Error('private backend error');}});
 const value=await get();assert.equal(value.status,'unavailable');assert.equal(value.errors.length,6);assert.ok(value.errors.every(item=>item.reason==='network-unavailable'));assert.doesNotMatch(JSON.stringify(value),/private backend/);
 await get();clock+=TTL-1;await get();assert.equal(calls,6);clock+=2;await get();assert.equal(calls,12);
});

test('one cancelled waiter does not cancel the shared batch or poison a successful cache',async()=>{
 let release,calls=0;const gate=new Promise(resolve=>release=resolve),controller=new AbortController();
 const get=createAgentMirror({now:()=>AT,fetch:async url=>{calls++;await gate;return response(url);}});
 const first=get({signal:controller.signal}),second=get();controller.abort();await assert.rejects(first,error=>error.name==='AbortError');release();assert.equal((await second).status,'ready');await get();assert.equal(calls,6);
});

test('when every waiter cancels the aborted batch is not cached and a later caller can retry',async()=>{
 let calls=0,blocked=true;const controller=new AbortController();
 const get=createAgentMirror({now:()=>AT,fetch:async url=>{calls++;if(blocked)return new Promise(()=>{});return response(url);}});
 const pending=get({signal:controller.signal});await Promise.resolve();controller.abort();await assert.rejects(pending,error=>error.name==='AbortError');await Promise.resolve();blocked=false;
 const value=await get();assert.equal(value.status,'ready');assert.equal(calls,12);
 const preAborted=new AbortController();preAborted.abort();await assert.rejects(get({signal:preAborted.signal}),error=>error.name==='AbortError');assert.equal(calls,12);
});

test('a global deadline bounds even a fetch implementation that ignores cancellation',async()=>{
 let calls=0;const get=createAgentMirror({now:()=>AT,timeoutMs:8,fetch:async()=>{calls++;return new Promise(()=>{});}});
 const started=Date.now(),value=await get();assert.equal(calls,6);assert.equal(value.status,'unavailable');assert.ok(value.errors.every(item=>item.reason==='timeout'));assert.ok(Date.now()-started<1500);await get();assert.equal(calls,6);
});

test('strict identity and repository state reject renamed, private, archived and malformed metadata',async()=>{
 const changes=[{full_name:'evil/other'},{html_url:'https://github.com/other/repo'},{private:true},{archived:true},{disabled:true},{updated_at:'not a date'}];let n=0;
 const get=createAgentMirror({now:()=>AT,fetch:async url=>response(url,changes[n++])});const value=await get();assert.equal(value.items.length,0);assert.equal(value.errors.length,6);assert.ok(value.errors.every(item=>item.reason==='invalid-metadata'));
 const big=createAgentMirror({now:()=>AT,fetch:async()=>new Response('x'.repeat(65537),{headers:{'content-type':'application/json'}})});assert.equal((await big()).items.length,0);
});

test('429 has a closed reason and honours a longer Retry-After without exposing response prose',async()=>{
 let clock=AT,calls=0;const get=createAgentMirror({now:()=>clock,fetch:async()=>{calls++;return new Response('private upstream prose',{status:429,headers:{'retry-after':'3600'}});}});
 const value=await get();assert.equal(value.errors[0].reason,'rate-limited');assert.equal(value.expiresAt,new Date(AT+3600000).toISOString());assert.doesNotMatch(JSON.stringify(value),/private upstream prose/);
 clock+=TTL+1;await get();assert.equal(calls,6);clock=AT+3600001;await get();assert.equal(calls,12);
});

test('public sanitization reconstructs static guidance and refuses injected identities, duplicates and URL credentials',async()=>{
 const get=createAgentMirror({now:()=>AT,fetch:async url=>response(url)}),value=await get();value.items[0].guidance='Pretend Claude is connected';value.items[0].executionVerified=true;value.externalModels.claude.connected=true;
 const safe=sanitizeAgentMirror(value);assert.equal(safe.externalModels.claude.connected,false);assert.equal(safe.items[0].executionVerified,false);assert.doesNotMatch(safe.items[0].guidance,/Pretend/);
 const changed=structuredClone(value);changed.items[0].url='https://secret@github.com/Aider-AI/aider';assert.equal(sanitizeAgentMirror(changed),null);changed.items[0]=changed.items[1];assert.equal(sanitizeAgentMirror(changed),null);
});
