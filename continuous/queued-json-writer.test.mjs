import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createQueuedJsonWriter} from './queued-json-writer.mjs';

const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
async function fixture(t){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-json-writer-'));
 t.after(async()=>{assert.ok(path.basename(directory).startsWith('atlas-json-writer-'));assert.equal(path.dirname(directory),path.resolve(os.tmpdir()));await fs.rm(directory,{recursive:true,force:true});});
 return {directory,file:name=>path.join(directory,name),read:async name=>JSON.parse(await fs.readFile(path.join(directory,name),'utf8'))};
}

test('queued values are serialized immediately and commit in order; drain waits for the queue',async t=>{
 const f=await fixture(t),entered=deferred(),release=deferred(),seen=[];
 const writer=createQueuedJsonWriter({directory:f.directory,fsAdapter:{...fs,writeFile:async(...args)=>{seen.push(JSON.parse(args[1]).revision);if(seen.length===1){entered.resolve();await release.promise;}return fs.writeFile(...args);}}});
 const first=writer.write('state.json',{revision:1});await entered.promise;
 const value={revision:2,nested:{stable:true}},second=writer.write('state.json',value);value.revision=3;value.nested.stable=false;
 let drained=false;const drain=writer.drain().then(()=>drained=true);await Promise.resolve();assert.equal(drained,false);
 release.resolve();await Promise.all([first,second,drain]);assert.equal(drained,true);
 assert.deepEqual(seen,[1,2]);assert.deepEqual(await f.read('state.json'),{revision:2,nested:{stable:true}});
 await assert.rejects(fs.access(f.file('state.json.tmp')),error=>error.code==='ENOENT');
});

test('a cancelled queued write never reaches writeFile and does not poison following work',async t=>{
 const f=await fixture(t),entered=deferred(),release=deferred(),seen=[];
 const writer=createQueuedJsonWriter({directory:f.directory,fsAdapter:{...fs,writeFile:async(...args)=>{seen.push(JSON.parse(args[1]).revision);if(seen.length===1){entered.resolve();await release.promise;}return fs.writeFile(...args);}}});
 const first=writer.write('state.json',{revision:1});await entered.promise;
 const controller=new AbortController(),cancelled=writer.write('state.json',{revision:2},{signal:controller.signal});controller.abort(Error('cancelled in queue'));
 const check=assert.rejects(cancelled,/cancelled in queue/),third=writer.write('state.json',{revision:3});release.resolve();
 await Promise.all([first,check,third]);await writer.drain();assert.deepEqual(seen,[1,3]);assert.deepEqual(await f.read('state.json'),{revision:3});
});

test('cancellation after temporary write preserves the previous committed JSON and removes the temporary file',async t=>{
 const f=await fixture(t),controller=new AbortController(),entered=deferred(),release=deferred();
 await fs.writeFile(f.file('extensions.json'),JSON.stringify({revision:'old'}));
 const writer=createQueuedJsonWriter({directory:f.directory,fsAdapter:{...fs,writeFile:async(...args)=>{await fs.writeFile(...args);entered.resolve();await release.promise;}}});
 const operation=writer.write('extensions.json',{revision:'cancelled'},{signal:controller.signal});await entered.promise;
 assert.deepEqual(await f.read('extensions.json'),{revision:'old'});controller.abort(Error('cancel after write'));
 const rejected=assert.rejects(operation,/cancel after write/);release.resolve();await rejected;await writer.drain();
 assert.deepEqual(await f.read('extensions.json'),{revision:'old'});await assert.rejects(fs.access(f.file('extensions.json.tmp')),error=>error.code==='ENOENT');
 await writer.write('extensions.json',{revision:'next'});assert.deepEqual(await f.read('extensions.json'),{revision:'next'});
});

test('failed partial writes preserve the old document, clean up and allow a subsequent commit',async t=>{
 const f=await fixture(t);await fs.writeFile(f.file('state.json'),'{"revision":"old"}');let attempts=0;
 const writer=createQueuedJsonWriter({directory:f.directory,fsAdapter:{...fs,writeFile:async(...args)=>{await fs.writeFile(...args);if(++attempts===1)throw Error('simulated write failure');}}});
 await assert.rejects(writer.write('state.json',{revision:'failed'}),/simulated write failure/);await writer.drain();
 assert.deepEqual(await f.read('state.json'),{revision:'old'});await assert.rejects(fs.access(f.file('state.json.tmp')),error=>error.code==='ENOENT');
 await writer.write('state.json',{revision:'next'});assert.deepEqual(await f.read('state.json'),{revision:'next'});
});

test('a rename failure preserves the committed document and does not retain a broken queue',async t=>{
 const f=await fixture(t);await fs.writeFile(f.file('state.json'),'{"revision":"old"}');let attempts=0;
 const writer=createQueuedJsonWriter({directory:f.directory,fsAdapter:{...fs,rename:async(...args)=>{if(++attempts===1)throw Error('rename unavailable');return fs.rename(...args);}}});
 await assert.rejects(writer.write('state.json',{revision:'failed'}),/rename unavailable/);assert.deepEqual(await f.read('state.json'),{revision:'old'});
 await writer.write('state.json',{revision:'next'});await writer.drain();assert.deepEqual(await f.read('state.json'),{revision:'next'});
});

test('an abort after atomic rename does not report a failed write for data already committed',async t=>{
 const f=await fixture(t),controller=new AbortController();
 const writer=createQueuedJsonWriter({directory:f.directory,fsAdapter:{...fs,rename:async(...args)=>{await fs.rename(...args);controller.abort(Error('too late to cancel committed data'));}}});
 await writer.write('state.json',{revision:'committed'},{signal:controller.signal});assert.equal(controller.signal.aborted,true);assert.deepEqual(await f.read('state.json'),{revision:'committed'});
});

test('unsafe basenames and unserializable values are rejected without touching files',async t=>{
 const f=await fixture(t);let calls=0;const writer=createQueuedJsonWriter({directory:f.directory,fsAdapter:{...fs,mkdir:async()=>calls++}});
 for(const name of ['../state.json','nested/state.json','nested\\state.json','C:\\state.json','state.json/other','.state.json','state.txt','CON.json','nul.extra.json','state.json\0','x'.repeat(181)+'.json'])await assert.rejects(writer.write(name,{}),/nombre/);
 const circular={};circular.self=circular;
 for(const value of [undefined,()=>{},Symbol('value'),1n,circular])await assert.rejects(writer.write('state.json',value));
 const controller=new AbortController();controller.abort(Error('already cancelled'));await assert.rejects(writer.write('state.json',{}, {signal:controller.signal}),/already cancelled/);
 await writer.drain();assert.equal(calls,0);assert.deepEqual(await fs.readdir(f.directory),[]);
});

test('writer state is instance-local and supports JSON primitives and separate basenames',async t=>{
 const f=await fixture(t),writer=createQueuedJsonWriter({directory:f.directory});
 await Promise.all([writer.write('state.json',null),writer.write('spiral-123.json',[0,false,'Atlas'])]);await writer.drain();
 assert.equal(await f.read('state.json'),null);assert.deepEqual(await f.read('spiral-123.json'),[0,false,'Atlas']);
 assert.throws(()=>createQueuedJsonWriter({directory:'relative'}),/absoluto/);assert.throws(()=>createQueuedJsonWriter({directory:f.directory,fsAdapter:{}}),/incompleto/);
});
