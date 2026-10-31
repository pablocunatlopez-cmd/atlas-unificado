/** Public, unauthenticated data only. External text is never interpreted as instructions. */
export type WebResult={title:string;url:string;text:string;provider:string;kind:string;publishedAt?:string};
export type WebAttempt={provider:string;ok:boolean;detail:string};
export type WebSearch={query:string;results:WebResult[];attempts:WebAttempt[];fetchedAt:string};
export type Fetcher=(input:string,init?:RequestInit)=>Promise<Response>;
export const PUBLIC_HOSTS=[
 'es.wikipedia.org','en.wikipedia.org','www.mediawiki.org','api.crossref.org','api.github.com',
 'github.com','raw.githubusercontent.com','developer.mozilla.org','docs.python.org',
 'www.w3.org','www.khronos.org','registry.khronos.org','arxiv.org','export.arxiv.org',
 'www.nasa.gov','science.nasa.gov','www.esa.int','www.nature.com','www.science.org',
 'plato.stanford.edu','iep.utm.edu','www.unesco.org','www.who.int','www.ipcc.ch',
 'www.ecb.europa.eu','energy.ec.europa.eu','ec.europa.eu','www.crossref.org',
 'docs.github.com','developers.cloudflare.com','www.python.org','pytorch.org',
 'threejs.org','web.dev','developer.chrome.com','huggingface.co','en.wikibooks.org'
] as const;
const hosts=new Set<string>(PUBLIC_HOSTS);
export function publicUrl(raw:string){
 if(raw.length>2000)throw new Error('URL demasiado larga.');
 const url=new URL(raw);
 if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||!hosts.has(url.hostname))
  throw new Error('Lectura compatible con HTTPS de las fuentes públicas del catálogo.');
 url.hash='';return url.toString();
}
export const sha256=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s.normalize('NFC').trim()))),x=>x.toString(16).padStart(2,'0')).join('');
export function plainText(input:string){
 return input.replace(/<(script|style|svg|noscript|nav|footer|header|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
 .replace(/<!--[^]*?-->/g,' ').replace(/<(?:\/p|\/div|\/section|\/h[1-6]|br|\/li|\/tr)[^>]*>/gi,'\n')
 .replace(/<[^>]*>/g,' ').replace(/&#(x[\da-f]+|\d+);/gi,(_,n:string)=>{const v=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return v>0&&v<=0x10ffff?String.fromCodePoint(v):' ';})
 .replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,n:string)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[n]!))
 .replace(/[ \t\r]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
export async function publicFetch(raw:string,fetcher:Fetcher=fetch,limit=600000){
 let url=publicUrl(raw);
 for(let hop=0;hop<4;hop++){
  const response=await fetcher(url,{method:'GET',redirect:'manual',credentials:'omit',signal:AbortSignal.timeout(9000),headers:{Accept:'application/json, text/html, text/plain;q=0.9','User-Agent':'AtlasResearch/1.0 (+https://atlas-personal.pablo-cunatlopez.chatgpt.site)'}});
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw new Error('Redirección sin destino.');url=publicUrl(new URL(location,url).toString());continue;}
  if(!response.ok){await response.body?.cancel();throw new Error('HTTP '+response.status);}
  const contentType=response.headers.get('content-type')||'';
  if(!/(?:text\/|json|xml)/i.test(contentType)){await response.body?.cancel();throw new Error('Solo se admite texto; no se leen binarios ni PDF.');}
  if(Number(response.headers.get('content-length')||0)>limit){await response.body?.cancel();throw new Error('La respuesta supera el tamaño permitido.');}
  const reader=response.body?.getReader();if(!reader)throw new Error('Respuesta vacía.');const decoder=new TextDecoder();let size=0,text='';
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit)throw new Error('La respuesta supera el tamaño permitido.');text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}
  return {text,url,contentType};
 }
 throw new Error('Demasiadas redirecciones.');
}
const json=async(url:string,fetcher:Fetcher)=>JSON.parse((await publicFetch(url,fetcher)).text);
export async function readPublicPage(raw:string,fetcher:Fetcher=fetch):Promise<WebResult>{
 const url=new URL(publicUrl(raw));
 if(/^(es|en)\.wikipedia\.org$/.test(url.hostname)&&url.pathname.startsWith('/wiki/')){
  const title=decodeURIComponent(url.pathname.slice(6)).replace(/_/g,' ');
  const api=`${url.origin}/w/api.php?`+new URLSearchParams({action:'query',format:'json',formatversion:'2',prop:'extracts|info',inprop:'url',explaintext:'1',exintro:'1',exchars:'5000',titles:title,redirects:'1'});
  const data=await json(api,fetcher),p=data.query?.pages?.[0];if(!p?.extract)throw new Error('No hay un extracto legible.');
  return{title:p.title,url:publicUrl(p.fullurl||url.toString()),text:plainText(p.extract).slice(0,5000),provider:'Wikipedia',kind:'Fuente secundaria · extracto'};
 }
 const response=await publicFetch(url.toString(),fetcher),html=response.text;
 const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]||html;
 const title=plainText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||url.pathname.split('/').filter(Boolean).at(-1)||url.hostname).slice(0,240);
 const text=(/text\/html/.test(response.contentType)?plainText(main):html.trim()).slice(0,5000);
 if(text.length<100)throw new Error('La fuente no contiene suficiente texto legible.');
 return{title,url:response.url,text,provider:new URL(response.url).hostname,kind:/github/.test(url.hostname)?'Repositorio público · contenido no validado':/arxiv/.test(url.hostname)?'Prepublicación · contenido por contrastar':'Documento web · contenido por contrastar'};
}
export async function searchInternet(query:string,fetcher:Fetcher=fetch):Promise<WebSearch>{
 const q=query.trim().slice(0,240);if(q.length<2)throw new Error('Escribe un tema o una pregunta pública.');
 const jobs:{provider:string;run:()=>Promise<WebResult[]>}[]=[
  ...(['es','en'] as const).map(lang=>({provider:'Wikipedia '+lang,run:async()=>{
   const data=await json(`https://${lang}.wikipedia.org/w/api.php?`+new URLSearchParams({action:'query',format:'json',formatversion:'2',generator:'search',gsrsearch:q,gsrnamespace:'0',gsrlimit:'3',prop:'extracts|info',inprop:'url',explaintext:'1',exintro:'1',exchars:'2200'}),fetcher);
   if(data.error)throw new Error(data.error.code||'API no disponible');
   return (data.query?.pages||[]).filter((p:{extract?:string})=>p.extract).map((p:{title:string;fullurl:string;extract:string})=>({title:p.title,url:publicUrl(p.fullurl),text:plainText(p.extract).slice(0,2200),provider:'Wikipedia '+lang,kind:'Fuente secundaria · extracto'}));
  }})),
  {provider:'Crossref',run:async()=>{const d=await json('https://api.crossref.org/works?'+new URLSearchParams({query:q,rows:'3',select:'DOI,title,URL,published,abstract'}),fetcher);return(d.message?.items||[]).map((p:{title?:string[];DOI:string;URL:string;abstract?:string;published?:{'date-parts'?:number[][]}})=>({title:p.title?.[0]||p.DOI,url:'https://doi.org/'+encodeURI(p.DOI),text:plainText(p.abstract||'Referencia bibliográfica: '+(p.title?.[0]||p.DOI))+'. DOI: '+p.DOI,provider:'Crossref',kind:p.abstract?'Resumen editorial · no texto completo':'Metadatos bibliográficos · no evidencia del contenido',publishedAt:p.published?.['date-parts']?.[0]?.join('-')}));}},
 ];
 if(/code|codigo|program|webgl|javascript|python|3d|modelo|model|software|game|videojueg|render|atlas/i.test(q))jobs.push({provider:'GitHub',run:async()=>{const d=await json('https://api.github.com/search/repositories?'+new URLSearchParams({q:q.slice(0,140),per_page:'3'}),fetcher);return(d.items||[]).map((p:{full_name:string;html_url:string;description?:string;updated_at:string})=>({title:p.full_name,url:publicUrl(p.html_url),text:p.description||'Repositorio público sin descripción.',provider:'GitHub',kind:'Metadatos de repositorio · código no ejecutado',publishedAt:p.updated_at}));}});
 const settled=await Promise.allSettled(jobs.map(j=>j.run())),attempts:WebAttempt[]=[],results:WebResult[]=[];
 settled.forEach((r,i)=>{attempts.push({provider:jobs[i].provider,ok:r.status==='fulfilled',detail:r.status==='fulfilled'?`${r.value.length} resultados`:r.reason instanceof Error?r.reason.message:'No disponible'});if(r.status==='fulfilled')for(const item of r.value)if(!results.some(x=>x.url===item.url))results.push({...item,title:item.title.slice(0,240),text:item.text.slice(0,5000),url:item.url.slice(0,2000)});});
 return{query:q,results:results.slice(0,12),attempts,fetchedAt:new Date().toISOString()};
}
