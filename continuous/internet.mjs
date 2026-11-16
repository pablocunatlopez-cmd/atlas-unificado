import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {extractText} from './engine.mjs';
import {researchQueries,sourceKind} from './source-routing.mjs';
import {createGoogleSearch} from './google-search.mjs';
const google=createGoogleSearch((url,signal)=>publicGet(url,0,signal),webUrl);
export const googleSearchStatus=()=>google.status();
export function publicIPv4(ip){
 if(isIP(ip)!==4)return false;
 const [a,b]=ip.split('.').map(Number);
 const c=Number(ip.split('.')[2]);
 return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===0||b===168))||(a===100&&b>=64&&b<=127)||(a===198&&((b===18||b===19)||(b===51&&c===100)))||(a===203&&b===0&&c===113)||(a===192&&b===88&&c===99));
}
export function webUrl(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||u.hostname==='localhost'||u.hostname.endsWith('.localhost')||u.hostname.endsWith('.local')||(isIP(u.hostname)&&!publicIPv4(u.hostname)))throw Error('Solo páginas HTTPS públicas, sin credenciales ni puertos privados.');return u;}
const SAFE_NET_MESSAGE=/^(Solo páginas HTTPS públicas|Destino de red privado o no permitido|Demasiadas redirecciones|La página no es texto legible|La página supera el límite de lectura|La web respondió HTTP \d+|Contenido insuficiente|No se pudo |Tiempo de espera agotado)/;
const DNS_ERROR_CODES=new Set(['ENOTFOUND','ENODATA','ENORECORDS','EAI_AGAIN','EAI_NODATA','EAI_FAMILY']);
const CONNECTION_ERROR_CODES=new Set(['ECONNREFUSED','ECONNRESET','ECONNABORTED','EHOSTUNREACH','EHOSTDOWN','ENETUNREACH','ENETDOWN','EPIPE','EPROTO','EAI_FAMILY','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','ERR_TLS_CERT_ALTNAME_INVALID']);
// Mensajes genéricos para el cliente: nunca incluyen hostname, IP, ruta ni causa interna.
export function sanitizeNetError(err){
 const message=String(err?.message||''),code=String(err?.code||'');
 if(SAFE_NET_MESSAGE.test(message))return err instanceof Error?err:Error(message);
 if(DNS_ERROR_CODES.has(code))return Error('No se pudo resolver el nombre DNS del destino.');
 if(code==='ETIMEDOUT'||/tiempo\b[\s\S]*agotado/i.test(message)||/timed?\s*out/i.test(message))return Error('Tiempo de espera agotado al contactar el destino.');
 if(/\bDNS\b/i.test(message))return Error('No se pudo resolver el nombre DNS del destino.');
 if(CONNECTION_ERROR_CODES.has(code)||/cert|tls|ssl/i.test(code))return Error('No se pudo establecer una conexión segura con el destino.');
 return Error('No se pudo acceder al destino solicitado.');
}
export async function resolvePublicAddresses(hostname,timeoutMs=6000,signal,resolver=lookup){
 signal?.throwIfAborted();let timer,abort;
 try{
  const records=await Promise.race([resolver(hostname,{all:true,family:4,verbatim:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Tiempo de resolución DNS agotado para '+hostname)),timeoutMs);}),new Promise((_,reject)=>{abort=()=>reject(signal.reason);signal?.addEventListener('abort',abort,{once:true});})]);
  const addresses=records.map(record=>record.address);
  if(!addresses.length||addresses.some(address=>!publicIPv4(address)))throw Error('Destino de red privado o no permitido');
  return addresses;
 }
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function publicGet(value,depth=0,signal){
 signal?.throwIfAborted();
 try{
 const u=webUrl(value);if(depth>3)throw Error('Demasiadas redirecciones');
 const addresses=isIP(u.hostname)?[u.hostname]:await resolvePublicAddresses(u.hostname,6000,signal);
 signal?.throwIfAborted();
 if(!addresses.length||addresses.some(a=>!publicIPv4(a)))throw Error('Destino de red privado o no permitido');
 const response=await new Promise((resolve,reject)=>{
  const req=https.get(u,{signal,lookup:(_h,opts,cb)=>opts.all?cb(null,[{address:addresses[0],family:4}]):cb(null,addresses[0],4),headers:{'User-Agent':'AtlasLocal/1.0 (personal research)','Accept':'text/html,text/plain,application/json','Accept-Encoding':'identity'}},res=>{
   if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume();resolve({redirect:new URL(res.headers.location,u).href});return;}
   if(res.statusCode!==200){res.resume();reject(Error('La web respondió HTTP '+res.statusCode));return;}
   if(!/^(text\/(html|plain)|application\/json)/i.test(res.headers['content-type']||'')){res.resume();reject(Error('La página no es texto legible'));return;}
   let size=0;const chunks=[];res.on('data',c=>{size+=c.length;if(size>1500000){req.destroy(Error('La página supera el límite de lectura'));return;}chunks.push(c);});res.on('end',()=>resolve({text:Buffer.concat(chunks).toString('utf8'),url:u.href}));res.on('error',reject);
  });const timer=setTimeout(()=>req.destroy(Error('Tiempo de lectura agotado')),15000);req.on('close',()=>clearTimeout(timer));req.on('error',reject);
 });
 return response.redirect?publicGet(response.redirect,depth+1,signal):response;
 }
 catch(err){if(err===signal?.reason||err?.name==='AbortError')throw err;throw sanitizeNetError(err);}
}
export function parseDuckDuckGoResults(html,limit=4){
 const anchors=[...String(html||'').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
 const matches=anchors.filter(([,attributes])=>/\bclass\s*=\s*(['"])[^'"]*\bresult-link\b[^'"]*\1/i.test(attributes));
 const results=[],seen=new Set();
 for(let i=0;i<matches.length&&results.length<limit;i++){
  const [anchor,attributes,titleMarkup]=matches[i];
  const href=attributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  if(!href)continue;
  try{
   const link=new URL((href[1]||href[2]).replace(/&amp;/gi,'&'),'https://lite.duckduckgo.com');
   const isDuckDomain=link.hostname==='duckduckgo.com'||link.hostname.endsWith('.duckduckgo.com');
   const destination=isDuckDomain&&link.pathname==='/l/'?link.searchParams.get('uddg'):link.href;
   const url=webUrl(destination).href;if(seen.has(url))continue;
   const nextIndex=matches[i+1]?.index??String(html).length;
   const region=String(html).slice((matches[i].index||0)+anchor.length,nextIndex);
   const snippet=region.match(/<td\b[^>]*class\s*=\s*(['"])[^'"]*\bresult-snippet\b[^'"]*\1[^>]*>([\s\S]*?)<\/td>/i);
   const title=extractText(titleMarkup),excerpt=snippet?extractText(snippet[2]).slice(0,1400):'';
   if(!title)continue;
   seen.add(url);results.push({url,title,excerpt,fetchedAt:new Date().toISOString(),method:'Resultado DuckDuckGo Lite; extracto del índice, página de destino no leída'});
  }catch{}
 }
 return results;
}
export async function webEvidence(question,{signal}={}){
 signal?.throwIfAborted();const get=url=>publicGet(url,0,signal);
 const links=question.match(/https:\/\/[^\s<>"']+/g)?.map(s=>s.replace(/[),.;]+$/,'' )).slice(0,2)||[];
 if(links.length){const results=await Promise.allSettled(links.map(async url=>{const r=await get(url);return {url:r.url,requestedUrl:new URL(url).href,excerpt:extractText(r.text).slice(0,3500),fetchedAt:new Date().toISOString(),method:'Página pública leída ahora'};}));signal?.throwIfAborted();return {sources:results.filter(r=>r.status==='fulfilled').map(r=>r.value),errors:results.filter(r=>r.status==='rejected').map(r=>sanitizeNetError(r.reason).message)};}
 const query=question.slice(0,200);let searchFailure='';
 const googleResult=await google.search(query,signal);
 try{
  const outcomes=await Promise.allSettled(researchQueries(question).map(async q=>{
   const r=await get('https://lite.duckduckgo.com/lite/?q='+encodeURIComponent(q)+'&kl=es-es');
   return parseDuckDuckGoResults(r.text,3);
  }));
  signal?.throwIfAborted();const seen=new Set(),sources=[];
  // Interleave queries so specialised sources are not displaced by generic hits.
  const groups=[googleResult.sources,...outcomes.filter(x=>x.status==='fulfilled').map(x=>x.value)];
  for(let i=0;i<3;i++)for(const group of groups){const s=group[i];if(s&&!seen.has(s.url)&&sources.length<6){seen.add(s.url);sources.push({...s,sourceKind:sourceKind(s.url)});}}
  const errors=[...googleResult.errors,...outcomes.filter(x=>x.status==='rejected').map(x=>sanitizeNetError(x.reason).message)];
  await Promise.all(sources.slice(0,2).map(async s=>{try{const page=await get(s.url);const text=extractText(page.text);if(text.length<100)throw Error('Contenido insuficiente');s.excerpt=text.slice(0,3500);s.url=page.url;s.method='Página pública leída ahora';}catch(e){errors.push('Lectura '+s.url+': '+sanitizeNetError(e).message);}}));
  signal?.throwIfAborted();
  if(sources.length)return {sources,errors};
  searchFailure='DuckDuckGo Lite no devolvió resultados interpretables.';
 }catch(e){signal?.throwIfAborted();searchFailure='DuckDuckGo Lite: '+sanitizeNetError(e).message;}
 const u='https://es.wikipedia.org/w/api.php?action=query&list=search&format=json&utf8=1&srlimit=3&srsearch='+encodeURIComponent(query);
 try{
  const r=await get(u),j=JSON.parse(r.text);if(j.error)throw Error('La búsqueda enciclopédica no está disponible');
  const sources=(j.query?.search||[]).map(s=>({url:'https://es.wikipedia.org/wiki/'+encodeURIComponent(s.title.replaceAll(' ','_')),excerpt:extractText(s.snippet),title:s.title,fetchedAt:new Date().toISOString(),method:'Resultado de búsqueda Wikipedia; extracto, no artículo completo'}));
  if(sources.length)return {sources,errors:[...googleResult.errors,...(searchFailure?[searchFailure+'; se usó Wikipedia como alternativa.']:[])]};
  throw Error('La búsqueda enciclopédica no devolvió resultados.');
 }catch(e){throw Error([...googleResult.errors,searchFailure,sanitizeNetError(e).message].filter(Boolean).join(' '));}
}
