// Only public topic vocabulary goes to this documentation MCP, never a prompt.
export function publicDocsQuery(text){
 if(typeof text!=='string'||!/(openai|codex|chatgpt|responses api|agents sdk)/i.test(text))return null;
 const topic=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const terms=[['codex','Codex'],['chatgpt','ChatGPT'],['mcp','MCP'],['plugin|extension','plugins'],['autentic|oauth|auth','authentication'],['herramient|tool','tools'],['agents sdk|agente','Agents SDK'],['responses','Responses API'],['stream|tiempo real','streaming'],['model|modelo','models'],['precio|cost|credit','pricing']].filter(([pattern])=>new RegExp(pattern).test(topic)).map(([,term])=>term);
 return 'OpenAI '+(terms.length?terms.join(' '):'documentation');
}
export function createAtlasEvidence({publicDocs,web}){
 if(typeof publicDocs?.search!=='function'||typeof web!=='function')throw new TypeError('Missing evidence adapters.');
 return async function lookup(question,{signal}={}){
  const query=publicDocsQuery(question);
  if(query){try{const result=await publicDocs.search(query,{signal,limit:3});if(result.results.length)return {sources:result.results.map(item=>({url:item.url,title:item.title,excerpt:item.snippet,method:'Índice MCP oficial OpenAI Docs; fragmento, no lectura íntegra'})),errors:[]};}catch(error){signal?.throwIfAborted();}}
  return web(question,{signal});
 };
}
