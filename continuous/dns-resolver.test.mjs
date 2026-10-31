import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePublicAddresses} from './internet.mjs';
test('resuelve mediante el sistema y conserva comprobación de todas las direcciones',async()=>{
 const addresses=await resolvePublicAddresses('example.test',1000,undefined,async(host,options)=>{assert.equal(host,'example.test');assert.equal(options.all,true);assert.equal(options.family,4);return [{address:'1.1.1.1',family:4},{address:'8.8.8.8',family:4}];});
 assert.deepEqual(addresses,['1.1.1.1','8.8.8.8']);
 for(const records of [[],[{address:'127.0.0.1'}],[{address:'1.1.1.1'},{address:'10.0.0.1'}]])await assert.rejects(resolvePublicAddresses('example.test',1000,undefined,async()=>records),/privado/);
});
test('la cancelación y el timeout interrumpen una resolución pendiente',async()=>{
 const pending=()=>new Promise(()=>{});
 await assert.rejects(resolvePublicAddresses('example.test',5,undefined,pending),/agotado/);
 const controller=new AbortController();const result=resolvePublicAddresses('example.test',1000,controller.signal,pending);controller.abort(Error('Detenido'));
 await assert.rejects(result,/Detenido/);
});
