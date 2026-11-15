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
