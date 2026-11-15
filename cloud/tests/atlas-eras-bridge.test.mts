import test from 'node:test';
import assert from 'node:assert/strict';
import {ERAS_BRIDGE_TYPES,ERAS_SNAPSHOT_MAX_LENGTH,readErasMessage} from '../lib/studio/eras-bridge.ts';

const requestId='project-revision-current';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+A/WQAAAAASUVORK5CYII=';
const message=(type:string,extra:Record<string,unknown>={})=>({erasEngine:true,type,requestId,...extra});

test('initial readiness is accepted without a project request and loaded events keep their actual backend',()=>{
 assert.deepEqual([...ERAS_BRIDGE_TYPES],['ready','loaded','error','snapshot']);
 assert.deepEqual(readErasMessage({erasEngine:true,type:'ready'},''),{type:'ready'});
 assert.deepEqual(readErasMessage(message('ready',{backend:'WebGPU'}),requestId),{type:'ready',requestId,backend:'WebGPU'});
 for(const backend of ['WebGPU','WebGL2'] as const)assert.deepEqual(readErasMessage(message('loaded',{backend}),requestId),{type:'loaded',requestId,backend});
});
test('old project receipts and unknown or falsely reported renderer backends cannot replace the active result',()=>{
 for(const type of ERAS_BRIDGE_TYPES){
  const payload=message(type,{requestId:'previous-project',backend:'WebGL2',message:'Old error',data:png});assert.equal(readErasMessage(payload,requestId),null);
 }
 for(const backend of [undefined,'WebGL1','WebGPU simulated','CPU',true,{}])assert.equal(readErasMessage(message('loaded',{backend}),requestId),null);
 assert.equal(readErasMessage(message('loaded',{backend:'WebGL2',requestId:undefined}),requestId),null);
 assert.equal(readErasMessage(message('error',{requestId:undefined,message:'Initial error'}),requestId),null);
});
test('only marked plain protocol objects are accepted and extra fields never reach the result',()=>{
 for(const value of [null,[],new Date(),Object.create({erasEngine:true,type:'ready'}),{type:'ready'},{erasEngine:'true',type:'ready'},{erasEngine:true,type:'execute'},{erasEngine:true,type:'loaded',requestId,backend:'WebGPU',message:{html:'<script>'}}])assert.equal(readErasMessage(value,requestId),null);
 const candidate=Object.assign(Object.create(null),message('loaded',{backend:'WebGL2',code:'execute-me',url:'javascript:execute-me'}));
 assert.deepEqual(readErasMessage(candidate,requestId),{type:'loaded',requestId,backend:'WebGL2'});
 const broken={erasEngine:true,get type(){throw Error('Malformed payload');}};assert.equal(readErasMessage(broken,requestId),null);
});
test('renderer errors are readable and bounded without accepting missing error text',()=>{
 const source=' Failure: '+'x'.repeat(2000)+' ';const result=readErasMessage(message('error',{message:source}),requestId);
 assert.deepEqual(result,{type:'error',requestId,message:source.trim().slice(0,500)});
 for(const text of [undefined,null,'   ',{},42])assert.equal(readErasMessage(message('error',{message:text}),requestId),null);
});
test('snapshot downloads accept bounded PNG data and reject other URLs, invalid encodings and oversized images',()=>{
 assert.deepEqual(readErasMessage(message('snapshot',{data:png}),requestId),{type:'snapshot',requestId,data:png});
 for(const data of ['https://example.test/image.png','blob:https://example.test/image','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,not-a-png','data:image/png;base64,iVBORw0KGgo$===',png+'\n',undefined,12,'data:image/png;base64,'+'A'.repeat(ERAS_SNAPSHOT_MAX_LENGTH)])assert.equal(readErasMessage(message('snapshot',{data}),requestId),null);
});
