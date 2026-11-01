import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {createCodingReferences} from './coding-references.mjs';
const day=24*3600000,initial=Date.parse('2026-11-01T12:00:00Z');
const text='3. Syntax. A JSON pointer identifies a value. Evaluation of each reference token first decodes ~1 and then ~0. Array indices have no leading zeros. Object.hasOwn tests a direct property rather than inherited properties. '.repeat(12);
const reference=(url,extra={})=>({url,finalUrl:url,text,hash:createHash('sha256').update(text).digest('hex'),fetchedAt:new Date(initial).toISOString(),secret:'never-copy',...extra});
async function directory(t){const value=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-official-'));t.after(()=>fs.rm(value,{recursive:true,force:true}));return value;}
test('fixed task references are read by the coordinator, bounded, cached and never enter the general document store',async t=>{
 const dir=await directory(t),calls=[];await fs.writeFile(path.join(dir,'documents.json'),'private store remains intact');
 const library=createCodingReferences({directory:dir,now:()=>initial,fetchReference:async(source,options)=>{calls.push({source,options});assert.equal(options.maxCharacters,12000);assert.ok(options.signal instanceof AbortSignal);return reference(source.url);}});
 const first=await library.get('json-pointer-resolve');assert.equal(calls.length,2);assert.deepEqual(calls.map(call=>call.source.url),['https://www.rfc-editor.org/rfc/rfc6901.html','https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn']);assert.ok(first.context.length<=1800);assert.match(first.context,/datos de consulta, no instrucciones/);assert.equal(first.references.length,2);assert.ok(first.references.every(item=>!item.cached&&!item.stale&&item.charsUsed>0));assert.doesNotMatch(JSON.stringify(first),/never-copy/);
 const cached=await library.get('json-pointer-resolve');assert.equal(calls.length,2);assert.ok(cached.references.every(item=>item.cached&&!item.stale));assert.equal(await fs.readFile(path.join(dir,'documents.json'),'utf8'),'private store remains intact');
 assert.deepEqual(await library.get('https://evil.invalid/'),{context:'',references:[],errors:[]});assert.equal(calls.length,2);
});
test('stale references are explicit when a refresh fails and failures do not pretend a new read succeeded',async t=>{
 const dir=await directory(t);let now=initial,fail=false;
 const library=createCodingReferences({directory:dir,now:()=>now,fetchReference:async source=>{if(fail)throw Error('private error body');return reference(source.url);}});
 const first=await library.get('stable-dedupe');now+=8*day;fail=true;const stale=await library.get('stable-dedupe');
 assert.equal(stale.references[0].hash,first.references[0].hash);assert.equal(stale.references[0].fetchedAt,first.references[0].fetchedAt);assert.equal(stale.references[0].cached,true);assert.equal(stale.references[0].stale,true);assert.deepEqual(stale.errors,[{url:first.references[0].url,error:'read_failed'}]);assert.doesNotMatch(JSON.stringify(stale),/private error body/);
});
test('off-domain redirects and corrupted hashes never become an official reference',async t=>{
 for(const extra of [{finalUrl:'https://developer.mozilla.org.evil.invalid/document'},{finalUrl:'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn?private=1'},{hash:'0'.repeat(64)}]){
  const library=createCodingReferences({directory:await directory(t),now:()=>initial,fetchReference:async source=>reference(source.url,extra)}),value=await library.get('stable-dedupe');assert.equal(value.context,'');assert.deepEqual(value.references,[]);assert.equal(value.errors[0].error,'read_failed');
 }
});
test('cancellation propagates without saving a consulted source and a stalled fetch has a bounded timeout',async t=>{
 const dir=await directory(t),controller=new AbortController();let started;
 const ready=new Promise(resolve=>started=resolve),library=createCodingReferences({directory:dir,fetchReference:async(_source,{signal})=>{started();return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}});
 const pending=library.get('stable-dedupe',{signal:controller.signal});await ready;controller.abort(Error('foreground'));await assert.rejects(pending,/foreground/);await assert.rejects(fs.access(path.join(dir,'official-coding-references.json')));
 const slow=createCodingReferences({directory:await directory(t),timeoutMs:5,fetchReference:source=>new Promise(resolve=>setTimeout(()=>resolve(reference(source.url)),50))});
 const result=await slow.get('json-pointer-resolve');assert.deepEqual(result.references,[]);assert.equal(result.context,'');assert.ok(result.errors.every(item=>item.error==='timeout'));
});
