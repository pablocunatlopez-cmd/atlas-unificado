import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicMcp,PUBLIC_MCP_SERVER} from './public-mcp.mjs';

const searchTool={name:'search_openai_docs',title:'Search OpenAI Docs',inputSchema:{type:'object',properties:{query:{type:'string'},limit:{type:'integer'}},required:['query']},annotations:{readOnlyHint:true,destructiveHint:false}};
const rpc=(id,result,type='application/json')=>new Response(type==='text/event-stream'?'event: message\ndata: '+JSON.stringify({jsonrpc:'2.0',id,result})+'\n\n':JSON.stringify({jsonrpc:'2.0',id,result}),{headers:{'Content-Type':type}});
function fixture({tools=[searchTool],callResult={content:[{type:'text',text:JSON.stringify({hits:[{url:'https://developers.openai.com/learn/docs-mcp',hierarchy:{lvl0:'Docs',lvl1:'Docs MCP'},content:'Public documentation.'}]})}]},sse=false,onRequest}={}){
 const requests=[];
 const request=async(url,options)=>{
  assert.equal(url,PUBLIC_MCP_SERVER.url);assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers.Cookie,undefined);
  const body=JSON.parse(options.body);requests.push({url,options,body});
  const custom=await onRequest?.(body,options);if(custom)return custom;
  if(body.method==='notifications/initialized')return new Response(null,{status:202});
  if(body.method==='initialize')return rpc(body.id,{protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'openai-docs-mcp',version:'1.0.0'}},sse?'text/event-stream':'application/json');
  if(body.method==='tools/list')return rpc(body.id,{tools},sse?'text/event-stream':'application/json');
  if(body.method==='tools/call')return rpc(body.id,callResult,sse?'text/event-stream':'application/json');
  throw Error('Unexpected method');
 };
 return {requests,request,client:createPublicMcp({request,now:()=>Date.parse('2026-11-01T12:00:00Z')})};
}

test('real MCP handshake precedes discovered search; connection is anonymous and fixed to official HTTPS',async()=>{
 const {client,requests}=fixture();assert.equal(client.status().connected,false);
 const result=await client.search('Docs MCP',{limit:2});
 assert.deepEqual(requests.map(item=>item.body.method),['initialize','notifications/initialized','tools/list','tools/call']);
 assert.equal(requests[0].options.headers['MCP-Protocol-Version'],undefined);assert.equal(requests[2].options.headers['MCP-Protocol-Version'],'2025-03-26');
 assert.deepEqual(requests[3].body.params,{name:'search_openai_docs',arguments:{query:'Docs MCP',limit:2}});
 assert.equal(result.resultCount,1);assert.equal(result.results[0].title,'Docs MCP');assert.equal(client.status().connected,true);assert.equal(client.status().apiKeyRequired,false);
 assert.equal(result.at,'2026-11-01T12:00:00.000Z');
 await client.search('MCP tools');assert.equal(requests.filter(item=>item.body.method==='initialize').length,1);
});

test('SSE supports chunk boundaries, comments, CRLF and a matching RPC result without waiting for stream closure',async()=>{
 let cancelled=false;
 const {client}=fixture({sse:true,onRequest:body=>{
  if(body.method!=='tools/call')return;
  const text=': heartbeat\r\nevent: message\r\ndata: '+JSON.stringify({jsonrpc:'2.0',method:'notifications/progress',params:{}})+'\r\n\r\nevent: message\r\ndata: '+JSON.stringify({jsonrpc:'2.0',id:body.id,result:{content:[{type:'text',text:JSON.stringify({hits:[{url:'https://learn.chatgpt.com/docs/extend/mcp',title:'Conexión ágil',content:'Señal pública.'}]})}]}})+'\r\n\r\n';
  const bytes=new TextEncoder().encode(text);let offset=0;
  return new Response(new ReadableStream({pull(controller){if(offset<bytes.length){controller.enqueue(bytes.slice(offset,offset+7));offset+=7;}},cancel(){cancelled=true;}}),{headers:{'Content-Type':'text/event-stream; charset=utf-8'}});
 }});
 const result=await client.search('Conexión MCP');assert.equal(result.results[0].title,'Conexión ágil');assert.equal(cancelled,true);
});

test('only the exact read-only discovered search contract may be invoked',async()=>{
 for(const tools of [[],[{...searchTool,name:'delete_search'}],[{...searchTool,annotations:{readOnlyHint:false}}],[{...searchTool,inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query','token']}}]]){
  const {client,requests}=fixture({tools});await assert.rejects(client.search('MCP'),error=>error.code==='search_not_discovered');assert.equal(requests.some(item=>item.body.method==='tools/call'),false);assert.equal(client.status().connected,false);
 }
});

test('results are bounded official documentation references, never fetched arbitrary URLs or raw tool payloads',async()=>{
 const hits=[{url:'http://127.0.0.1/private',title:'private'},{url:'https://evil.example/docs',title:'external'},{url:'https://user:secret@developers.openai.com/docs',title:'credential'},{url:'https://developers.openai.com/docs?token=secret',title:'query secret'},{url:'https://platform.openai.com/docs/tools',title:'<b>Tools</b>',content:'x'.repeat(2000)},{url:'https://platform.openai.com/docs/tools',title:'duplicate'},{url:'https://learn.chatgpt.com/docs/extend/mcp#tools',title:'MCP'}];
 const {client,requests}=fixture({callResult:{structuredContent:{hits},privatePath:'C:/private'}});
 const result=await client.search('Tools',{limit:2});assert.equal(result.results.length,2);assert.equal(result.results[0].title,'Tools');assert.equal(result.results[0].snippet.length,1200);assert.equal(result.results[1].url,'https://learn.chatgpt.com/docs/extend/mcp#tools');assert.doesNotMatch(JSON.stringify(result),/private|secret|evil|<b>/);assert.ok(requests.every(item=>item.url===PUBLIC_MCP_SERVER.url));
});

test('session identifiers remain transient and never become exported credentials or arbitrary connection options',async()=>{
 const secret='fixture-session-only';
 const {client,requests}=fixture({onRequest:body=>{
  if(body.method!=='initialize')return;
  const response=rpc(body.id,{protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'docs',version:'1'}});response.headers.set('Mcp-Session-Id',secret);return response;
 }});
 await client.search('MCP');assert.equal(requests[2].options.headers['Mcp-Session-Id'],secret);assert.doesNotMatch(JSON.stringify(client.status()),/fixture-session-only/);
 for(const options of [{url:'http://localhost/'},{endpoint:'https://evil.example/'},{headers:{Authorization:'secret'}},{token:'secret'},{apiKey:'secret'}])assert.throws(()=>createPublicMcp(options),error=>error.code==='custom_connection_forbidden');
});

test('HTTP, protocol and tool errors never fabricate a connected search result or expose server messages',async()=>{
 for(const patch of [body=>new Response('private error',{status:401}),body=>rpc(body.id,{isError:true,content:[{type:'text',text:'private error'}]}),body=>new Response(JSON.stringify({jsonrpc:'2.0',id:body.id,error:{code:-1,message:'private error'}}),{headers:{'Content-Type':'application/json'}}),body=>rpc(body.id+100,{})]){
  const {client}=fixture({onRequest:body=>body.method==='tools/call'?patch(body):undefined});
  await assert.rejects(client.search('MCP'),error=>!error.message.includes('private error'));assert.equal(client.status().connected,false);assert.equal(client.status().searchAvailable,false);
 }
 const {request}=fixture({onRequest:body=>body.method==='initialize'?rpc(body.id,{protocolVersion:'unknown',capabilities:{tools:{}},serverInfo:{name:'docs'}}):undefined});
 await assert.rejects(createPublicMcp({request}).discover(),error=>error.code==='unsupported_initialization');
});

test('body and catalogue pagination budgets stop oversized or endless responses',async()=>{
 const {request}=fixture({onRequest:body=>body.method==='tools/call'?new Response('x'.repeat(4000),{headers:{'Content-Type':'application/json'}}):undefined});
 await assert.rejects(createPublicMcp({request,maxBytes:512}).search('MCP'),error=>error.code==='response_too_large');
 const paged=fixture({onRequest:body=>body.method==='tools/list'?rpc(body.id,{tools:[searchTool],nextCursor:'same-cursor'}):undefined});
 await assert.rejects(paged.client.discover(),error=>error.code==='tool_pagination_limit');assert.equal(paged.requests.filter(item=>item.body.method==='tools/list').length,2);
});

test('cancellation interrupts a pending SSE body and releases its reader',async()=>{
 const controller=new AbortController(),reason=Error('foreground');let cancel=false;
 const {client}=fixture({onRequest:body=>{
  if(body.method!=='tools/call')return;
  return new Response(new ReadableStream({start(){setTimeout(()=>controller.abort(reason),10);},cancel(){cancel=true;}}),{headers:{'Content-Type':'text/event-stream'}});
 }});
 await assert.rejects(client.search('MCP',{signal:controller.signal}),error=>error===reason);assert.equal(cancel,true);assert.equal(client.status().lastError,'cancelled');
});

test('request timeout is enforced while a stream remains open and unresponsive',async()=>{
 const keepAlive=setTimeout(()=>{},200);
 try{
  const {request}=fixture({onRequest:body=>body.method==='tools/call'?new Response(new ReadableStream({start(){}}),{headers:{'Content-Type':'text/event-stream'}}):undefined});
  const client=createPublicMcp({request,timeoutMs:25});await assert.rejects(client.search('MCP'),error=>error.name==='TimeoutError');assert.equal(client.status().connected,false);
 }finally{clearTimeout(keepAlive);}
});

test('invalid local input is rejected before any network request',async()=>{
 const {client,requests}=fixture();for(const value of ['',null,'x'.repeat(501)])await assert.rejects(client.search(value),TypeError);
 for(const limit of [0,6,2.5])await assert.rejects(client.search('MCP',{limit}),TypeError);assert.equal(requests.length,0);
 const controller=new AbortController(),reason=Error('stopped');controller.abort(reason);await assert.rejects(client.search('MCP',{signal:controller.signal}),error=>error===reason);assert.equal(requests.length,0);
});
