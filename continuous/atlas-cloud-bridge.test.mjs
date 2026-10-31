import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCloudBridge} from './atlas-cloud-bridge.mjs';
const token='a'.repeat(64),siteUrl='https://atlas.example/';
test('outbound bridge gives cloud only safe result and forces local shared privacy mode',async()=>{
 const requests=[],actions=[];
 const request=async(url,options={})=>{
  requests.push({url,options});
  if(url.endsWith('/chat/health'))return {ok:true,json:async()=>({ready:true,modelName:'Qwen GPU'})};
  if(url===siteUrl+'api/cloud/bridge'){
   const input=JSON.parse(options.body);actions.push(input);
   return {ok:true,json:async()=>input.action==='claim'?{job:{id:'job-1',leaseToken:'lease-1',messages:[{role:'user',content:'Hola'}],internet:false}}:{ok:true}};
  }
  if(url.endsWith('/chat/'))return {ok:true,text:async()=>'<meta name="atlas-token" content="bbcc">'};
  return {ok:true,json:async()=>({answer:'Hola',model:'atlas-local',modelName:'Qwen',sources:[{private:'hidden'}],secret:'never-upload'})};
 };
 assert.equal((await createCloudBridge({siteUrl,token,request}).tick()).status,'completed');
 assert.equal(actions[1].action,'complete');assert.deepEqual(actions[1].result,{answer:'Hola',model:'atlas-local',modelName:'Qwen'});
 const local=requests.find(item=>item.url.endsWith('/chat/message'));
 assert.equal(JSON.parse(local.options.body).sharedSession,true);assert.equal(local.options.headers.Authorization,undefined);
 assert.equal(requests.find(item=>item.url.startsWith(siteUrl)).options.redirect,'error');
});
test('offline PC never claims jobs or advertises a model as online',async()=>{
 let cloudCalls=0;const request=async url=>{if(url.startsWith(siteUrl))cloudCalls++;return {ok:true,json:async()=>({ready:false})};};
 assert.equal((await createCloudBridge({siteUrl,token,request}).tick()).status,'offline');assert.equal(cloudCalls,0);
 for(const address of ['http://example.com/','https://u:p@atlas.example/','https://atlas.example/path'])assert.throws(()=>createCloudBridge({siteUrl:address,token}));
});
test('invalid or failed model responses are never published as completed',async()=>{
 const actions=[];const request=async(url,options={})=>{
  if(url.endsWith('/chat/health'))return {ok:true,json:async()=>({ready:true})};
  if(url===siteUrl+'api/cloud/bridge'){const input=JSON.parse(options.body);actions.push(input.action);return {ok:true,json:async()=>input.action==='claim'?{job:{id:'job-1',leaseToken:'lease',messages:[{role:'user',content:'Hola'}]}}:{ok:true}};}
  if(url.endsWith('/chat/'))return {ok:true,text:async()=>'<meta name="atlas-token" content="aa">'};
  return {ok:false,json:async()=>({error:'sensitive filesystem detail'})};
 };
 assert.equal((await createCloudBridge({siteUrl,token,request}).tick()).status,'failed');assert.deepEqual(actions,['claim','fail']);
});
