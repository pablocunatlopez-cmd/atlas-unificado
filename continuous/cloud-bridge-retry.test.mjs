import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCloudBridge} from './atlas-cloud-bridge.mjs';

test('persistent HTTP 429 terminates after bounded retries and never completes a job', async () => {
  let attempts=0;
  const actions=[];
  const request=async(url, options={})=>{
    if(url.endsWith('/chat/health'))return Response.json({ready:true});
    if(url.endsWith('/media/status'))return Response.json({ready:false});
    if(url.endsWith('/process/status'))return Response.json({processes:[]});
    if(url.endsWith('/chat/'))return new Response('<meta name="atlas-token" content="aa">');
    if(url.endsWith('/chat/message')){attempts++;return new Response('',{status:429});}
    if(url.endsWith('/session-heartbeat'))return Response.json({liveCycleEnabled:false,recent:[]});
    const action=JSON.parse(options.body).action;
    actions.push(action);
    return Response.json(action==='claim'?{job:{id:'job-busy',kind:'chat',leaseToken:'lease',messages:[{role:'user',content:'Hola'}]}}:{ok:true});
  };
  const result=await createCloudBridge({
    siteUrl:'https://atlas.example/',token:'a'.repeat(64),request,sleep:async()=>{},
  }).tick();
  assert.equal(result.status,'failed');
  assert.equal(attempts,9);
  assert.deepEqual(actions,['claim','fail']);
});
