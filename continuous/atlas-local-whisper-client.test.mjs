import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {transcribeAtlasLocalAudio} from './atlas-local-whisper-client.mjs';
const base={modelPath:'/models/tiny.bin',audioPath:'/audio/voice.wav'};
const fakeSpawn=(code,output)=>()=> {
 const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();
 child.kill=()=>{queueMicrotask(()=>child.emit('close',null));return true;};
 queueMicrotask(()=>{child.stdout.emit('data',Buffer.from(output));child.emit('close',code);});
 return child;
};
test('transcribes from a local file with no shell',async()=>{
 const r=await transcribeAtlasLocalAudio({...base,spawn:fakeSpawn(0,'hola')});
 assert.equal(r.transcript,'hola');
 assert.equal(r.status,'completed');
 assert.equal(r.verified,false);
});
test('rejects invalid paths and returns null for failed transcriptions',async()=>{
 await assert.rejects(transcribeAtlasLocalAudio({...base,audioPath:'/audio/../secret',spawn:fakeSpawn(0,'x')}));
 const r=await transcribeAtlasLocalAudio({...base,spawn:fakeSpawn(1,'error')});
 assert.equal(r.transcript,null);
 assert.equal(r.status,'failed');
});

test('discards transcript if process exceeds output limit',async()=>{
 const r=await transcribeAtlasLocalAudio({...base,spawn:fakeSpawn(0,'x'.repeat(100001))});
 assert.equal(r.status,'output_limit');
 assert.equal(r.transcript,null);
});
test('reports unconfirmed termination rather than waiting indefinitely',async()=>{
 let killed=false;
 const spawn=()=>{
  const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();
  child.kill=()=>{killed=true;return false;};
  return child;
 };
 const r=await transcribeAtlasLocalAudio({...base,timeoutMs:1000,spawn});
 assert.equal(killed,true);
 assert.equal(r.status,'termination_unconfirmed');
 assert.equal(r.transcript,null);
});
