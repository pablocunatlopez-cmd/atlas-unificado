import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCloudBridge} from './atlas-cloud-bridge.mjs';

test('oversized video stream without Content-Length is rejected before upload',async()=>{
  const id='job-'+'a'.repeat(64),actions=[];let uploaded=false;
  const request=async(url,options={})=>{
    if(url.endsWith('/chat/health'))return Response.json({ready:true});
    if(url.endsWith('/media/status'))return Response.json({ready:true});
    if(url.endsWith('/process/status'))return Response.json({processes:[]});
    if(url.endsWith('/chat/'))return new Response('<meta name="atlas-token" content="aa">');
    if(url.endsWith('/media/generate'))return new Response(JSON.stringify({type:'result',id:'video-1793448000000-abc123de',provider:'wan21-comfy'})+'\n');
    if(url.includes('/media/artifact?'))return new Response(new ReadableStream({
      start(controller){controller.enqueue(new Uint8Array(10*1024*1024+1));controller.close();}
    }));
    if(url.includes('/api/cloud/artifacts/')){uploaded=true;throw Error('unexpected upload');}
    if(url.endsWith('/session-heartbeat'))return Response.json({liveCycleEnabled:false,recent:[]});
    const action=JSON.parse(options.body).action;actions.push(action);
    return Response.json(action==='claim'?{job:{id,leaseToken:'lease',kind:'video',messages:[{role:'user',content:'test video'}]}}:{ok:true});
  };
  const result=await createCloudBridge({siteUrl:'https://atlas.example/',token:'a'.repeat(64),request}).tick();
  assert.equal(result.status,'failed');
  assert.equal(uploaded,false);
  assert.deepEqual(actions,['claim','fail']);
});
