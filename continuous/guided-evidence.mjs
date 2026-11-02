import {atlasGuidance} from './atlas-guidance.mjs';
import {webUrl} from './internet.mjs';

const METHOD='Lectura directa de una referencia curada; no búsqueda global';
const ALIASES={
 aider:['aider'],smolagents:['smolagents','smol agents'],llama:['llama cpp','llama.cpp'],
 'lm-eval':['lm eval','lm evaluation harness','lm-evaluation-harness','eleutherai'],
 evalplus:['evalplus','eval plus'],three:['three js','threejs','three.js','instancedmesh'],
 gltf:['gltf','gltf validator'],assets:['gltf','gltf sample assets','khronos sample assets'],
 mit:['6 006','6.006','mit algoritmos','mit algorithms']
};
const generic=new Set(['agent','agents','agente','agentes','model','modelo','models','modelos','assets','three','llama','mit','casa','house']);
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const text=(value,max)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,max):'';
function publicUrl(value){try{const url=webUrl(value);if(url.href.length>2048||url.search||url.hash)return null;return url.href;}catch{return null;}}
function phraseMatch(question,phrase){const value=normalized(phrase);return value.length>=4&&!generic.has(value)&&(' '+question+' ').includes(' '+value+' ')?value.length:0;}
function candidates(question,resources){
 const topic=normalized(question);
 return resources.map((resource,index)=>{
  if(!resource||typeof resource!=='object')return null;
  const aliases=Object.hasOwn(ALIASES,resource.id)?ALIASES[resource.id]:[resource.id,resource.name];
  const score=Math.max(0,...aliases.map(value=>phraseMatch(topic,value)),phraseMatch(topic,resource.name));
  const urls=[resource.docs,resource.url].map(publicUrl).filter((url,index,values)=>url&&values.indexOf(url)===index);
  return score&&urls.length?{name:text(resource.name,150)||'Referencia pública',urls,score,index}:null;
 }).filter(Boolean).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,2);
}
function sourcesFrom(result,requestedUrl,name){
 if(!Array.isArray(result?.sources))return [];
 const sources=[];
 for(const item of result.sources.slice(0,16)){
  if(!item||typeof item!=='object')continue;
  const url=publicUrl(item.url),requested=publicUrl(item.requestedUrl),excerpt=text(item.excerpt,3500);
  // The reader must identify the original request for a redirect. A public URL
  // supplied without that provenance is not evidence of this particular read.
  if(!url||!excerpt||(url!==requestedUrl&&requested!==requestedUrl))continue;
  if(!sources.some(source=>source.url===url))sources.push({url,requestedUrl,title:text(item.title,200)||name,excerpt,method:METHOD+' · '+name,...(Number.isFinite(Date.parse(item.fetchedAt))?{fetchedAt:new Date(item.fetchedAt).toISOString()}:{}),epistemicStatus:'unverified-source'});
  if(sources.length===4)break;
 }
 return sources;
}

/** A narrow recovery path when search cannot find evidence. Only reviewed URLs
 * are read; the private question is used locally to choose a reference. Reading
 * a source neither installs a tool nor proves the source's claims. */
export function createGuidedEvidence({read,resources=atlasGuidance.resources}={}){
 if(typeof read!=='function'||!Array.isArray(resources))throw new TypeError('Se requiere un lector y referencias públicas.');
 return async function lookup(question,{signal}={}){
  signal?.throwIfAborted();
  const sources=[],errors=[],seenUrls=new Set();let attempts=0;
  for(const candidate of candidates(typeof question==='string'?question:'',resources)){
   for(const url of candidate.urls){
    if(attempts>=2)break;
    if(seenUrls.has(url))continue;
    signal?.throwIfAborted();seenUrls.add(url);attempts++;
    let result;
    try{result=await read(url,{signal});signal?.throwIfAborted();}
    catch(error){signal?.throwIfAborted();errors.push('No se pudo leer la referencia curada: '+candidate.name+'.');continue;}
    const found=sourcesFrom(result,url,candidate.name);
    if(!found.length){errors.push('La referencia curada no aportó texto verificable de esta lectura: '+candidate.name+'.');continue;}
    for(const source of found)if(!sources.some(previous=>previous.url===source.url))sources.push(source);
    break;
   }
   if(attempts>=2)break;
  }
  return {sources:sources.slice(0,4),errors,method:METHOD};
 };
}
