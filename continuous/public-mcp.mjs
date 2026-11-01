// A deliberately narrow anonymous MCP client, not a generic server connector.
export const PUBLIC_MCP_SERVER=Object.freeze({id:'openai-docs',name:'OpenAI Docs MCP',url:'https://developers.openai.com/mcp',documentation:'https://developers.openai.com/learn/docs-mcp',readOnly:true,apiKeyRequired:false});
const PROTOCOL='2025-03-26',SEARCH='search_openai_docs';
const DOMAINS=new Set(['developers.openai.com','platform.openai.com','learn.chatgpt.com']);
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const clean=(value,max)=>typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim().slice(0,max):'';
function failure(code){const error=new Error('MCP público: '+code+'.');error.code=code;return error;}
function officialUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&DOMAINS.has(url.hostname)&&!url.username&&!url.password&&!url.port&&!url.search&&url.href.length<=2048?url.href:null;}catch{return null;}}

async function rpcResult(response,id,signal,maxBytes){
 const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(!['application/json','text/event-stream'].includes(type))throw failure('unsupported_content_type');
 if(Number(response.headers.get('content-length'))>maxBytes){await response.body?.cancel().catch(()=>{});throw failure('response_too_large');}
 if(!response.body?.getReader)throw failure('missing_response_body');
 const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0,pending='',eventData=[],events=0;
 const decode=value=>{
  let envelope;try{envelope=JSON.parse(value);}catch{throw failure('invalid_json');}
  if(!object(envelope)||envelope.jsonrpc!=='2.0')throw failure('invalid_rpc');
  if(envelope.id!==id)return null;
  if(Object.hasOwn(envelope,'error'))throw failure('rpc_error');
  if(!object(envelope.result))throw failure('invalid_result');
  return envelope.result;
 };
 const line=value=>{
  if(value.endsWith('\r'))value=value.slice(0,-1);
  if(value===''){
   if(!eventData.length)return null;
   if(++events>64)throw failure('too_many_events');
   const text=eventData.join('\n');eventData=[];return decode(text);
  }
  if(value.startsWith('data:'))eventData.push(value.slice(5).replace(/^ /,''));
  return null;
 };
 let abort;
 const aborted=new Promise((_,reject)=>{abort=()=>{void reader.cancel().catch(()=>{});reject(signal.reason||failure('cancelled'));};signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
 try{
  for(;;){
   signal.throwIfAborted();const chunk=await Promise.race([reader.read(),aborted]);signal.throwIfAborted();
   if(chunk.done){pending+=decoder.decode();break;}
   bytes+=chunk.value.byteLength;if(bytes>maxBytes)throw failure('response_too_large');pending+=decoder.decode(chunk.value,{stream:true});
   if(type==='text/event-stream'){
    let end;while((end=pending.indexOf('\n'))>=0){const result=line(pending.slice(0,end));pending=pending.slice(end+1);if(result)return result;}
   }
  }
  if(type==='application/json'){const result=decode(pending);if(result)return result;}
  else{if(pending){const result=line(pending);if(result)return result;}const result=line('');if(result)return result;}
  throw failure('missing_matching_response');
 }finally{signal.removeEventListener('abort',abort);void reader.cancel().catch(()=>{});reader.releaseLock();}
}

function searchable(tool){
 const schema=tool?.inputSchema;
 return tool?.name===SEARCH&&tool.annotations?.readOnlyHint===true&&tool.annotations?.destructiveHint!==true&&schema?.type==='object'&&schema.properties?.query?.type==='string'&&Array.isArray(schema.required)&&schema.required.includes('query')&&schema.required.every(key=>key==='query');
}

function resultsFrom(result,limit){
 if(result.isError===true)throw failure('tool_error');
 const documents=[];
 if(object(result.structuredContent))documents.push(result.structuredContent);
 for(const block of Array.isArray(result.content)?result.content.slice(0,4):[]){
  if(block?.type!=='text'||typeof block.text!=='string')continue;
  try{const parsed=JSON.parse(block.text);if(object(parsed))documents.push(parsed);}catch{}
 }
 const found=[],seen=new Set();
 for(const document of documents){
  const hits=Array.isArray(document.hits)?document.hits:Array.isArray(document.results)?document.results:[];
  for(const hit of hits.slice(0,50)){
   const url=officialUrl(hit?.url);if(!url||seen.has(url))continue;seen.add(url);
   const hierarchy=object(hit.hierarchy)?Object.values(hit.hierarchy).filter(value=>typeof value==='string'&&value.trim()):[];
   found.push({url,title:clean(hit.title||hierarchy.at(-1),200)||'OpenAI Docs',snippet:clean(hit.content||hit.snippet||hit._snippetResult?.content?.value,1200)});
   if(found.length>=limit)return found;
  }
 }
 return found;
}

/** Native fetch only, fixed official HTTPS endpoint, no environment secrets.
 * Search text is public data sent to the documentation server; results are
 * references, never instructions and never an independent reasoning model.
 */
export function createPublicMcp(options={}){
 if(!object(options))throw new TypeError('Opciones MCP no válidas.');
 for(const key of ['url','endpoint','headers','authorization','token','apiKey'])if(Object.hasOwn(options,key))throw failure('custom_connection_forbidden');
 const {request=globalThis.fetch,now=Date.now}=options;
 if(typeof request!=='function'||typeof now!=='function')throw new TypeError('MCP necesita fetch y reloj.');
 const timeoutMs=Math.max(25,Math.min(30000,Number(options.timeoutMs)||15000)),maxBytes=Math.max(512,Math.min(512*1024,Number(options.maxBytes)||256*1024));
 let sequence=0,session=null,protocol=null,server=null,catalog=[],connected=false,checkedAt=null,lastSearchAt=null,lastError=null,connecting=null,searchBusy=false;
 const status=()=>({serverId:PUBLIC_MCP_SERVER.id,endpoint:PUBLIC_MCP_SERVER.url,readOnly:true,apiKeyRequired:false,connected,protocolVersion:protocol,server:server?{...server}:null,tools:catalog.map(tool=>({name:tool.name,title:tool.title,readOnly:tool.readOnly})),searchAvailable:connected&&catalog.some(tool=>tool.searchable),checkedAt,lastSearchAt,lastError});
 const stamp=()=>new Date(now()).toISOString();
 async function post(method,params,{signal,notification=false}={}){
  const combined=signal?AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs);combined.throwIfAborted();
  const id=notification?null:++sequence,headers={'Content-Type':'application/json',Accept:'application/json, text/event-stream'};
  if(protocol)headers['MCP-Protocol-Version']=protocol;
  if(session)headers['Mcp-Session-Id']=session;
  const response=await request(PUBLIC_MCP_SERVER.url,{method:'POST',redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',headers,body:JSON.stringify({jsonrpc:'2.0',...(notification?{}:{id}),method,...(params===undefined?{}:{params})}),signal:combined});combined.throwIfAborted();
  if(response.redirected||!response.ok){void response.body?.cancel().catch(()=>{});throw failure(response.status===401||response.status===403?'authentication_not_available':'http_error');}
  if(notification){void response.body?.cancel().catch(()=>{});if(![202,204].includes(response.status))throw failure('invalid_notification_response');return null;}
  const result=await rpcResult(response,id,combined,maxBytes);
  if(method==='initialize'){
   const supplied=response.headers.get('mcp-session-id');if(supplied&&!/^[A-Za-z0-9._~+-]{1,200}$/.test(supplied))throw failure('invalid_session');session=supplied||null;
  }
  return result;
 }
 async function discover({signal,refresh=false}={}){
  signal?.throwIfAborted();if(connected&&!refresh)return status();
  if(connecting)return connecting;
  connecting=(async()=>{
   try{
    session=null;protocol=null;catalog=[];connected=false;
    const initialized=await post('initialize',{protocolVersion:PROTOCOL,capabilities:{},clientInfo:{name:'atlas-public-docs',version:'1.0.0'}},{signal});
    if(initialized.protocolVersion!==PROTOCOL||!object(initialized.serverInfo)||!object(initialized.capabilities?.tools))throw failure('unsupported_initialization');
    protocol=PROTOCOL;server={name:clean(initialized.serverInfo.name,100),version:clean(initialized.serverInfo.version,60)};
    await post('notifications/initialized',undefined,{signal,notification:true});
    const seenCursors=new Set();let cursor;
    for(let page=0;page<3;page++){
     const listed=await post('tools/list',cursor?{cursor}:{},{signal});if(!Array.isArray(listed.tools)||listed.tools.length>64)throw failure('invalid_tool_catalogue');
     for(const tool of listed.tools){
      if(typeof tool?.name!=='string'||!/^[a-zA-Z0-9_.-]{1,100}$/.test(tool.name)||catalog.some(item=>item.name===tool.name))continue;
      catalog.push({name:tool.name,title:clean(tool.title,160)||tool.name,readOnly:tool.annotations?.readOnlyHint===true,searchable:searchable(tool),supportsLimit:tool.inputSchema?.properties?.limit?.type==='integer'});
     }
     if(!listed.nextCursor)break;
     if(typeof listed.nextCursor!=='string'||listed.nextCursor.length>1000||seenCursors.has(listed.nextCursor)||page===2)throw failure('tool_pagination_limit');
     cursor=listed.nextCursor;seenCursors.add(cursor);
    }
    connected=true;checkedAt=stamp();lastError=null;return status();
   }catch(error){connected=false;session=null;lastError=signal?.aborted?'cancelled':error.code||'connection_failed';throw error;}
   finally{connecting=null;}
  })();
  return connecting;
 }
 async function search(query,{signal,limit=3}={}){
  if(typeof query!=='string'||!query.trim()||query.length>500)throw new TypeError('La consulta pública debe contener entre 1 y 500 caracteres.');
  if(!Number.isSafeInteger(limit)||limit<1||limit>5)throw new TypeError('El límite público debe estar entre 1 y 5.');
  signal?.throwIfAborted();if(searchBusy)throw failure('busy');searchBusy=true;
  try{
   await discover({signal});const tool=catalog.find(tool=>tool.searchable);if(!tool)throw failure('search_not_discovered');
   const result=await post('tools/call',{name:tool.name,arguments:{query:query.trim(),...(tool.supportsLimit?{limit}:{})}},{signal});
   const results=resultsFrom(result,limit);lastSearchAt=stamp();lastError=null;connected=true;
   return {serverId:PUBLIC_MCP_SERVER.id,tool:tool.name,readOnly:true,query:query.trim(),results,resultCount:results.length,at:lastSearchAt};
  }catch(error){connected=false;lastError=signal?.aborted?'cancelled':error.code||'search_failed';throw error;}
  finally{searchBusy=false;}
 }
 return {status,discover,search};
}
