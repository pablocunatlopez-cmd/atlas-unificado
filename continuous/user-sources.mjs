import {webUrl,publicGet} from './internet.mjs';
import {normalizeLearnableUrl,extractText,hash} from './engine.mjs';

export function sourceDescriptor(value){
 const u=webUrl(value);u.hash='';
 if(u.hostname.startsWith('[')||u.hostname.endsWith('.localhost.')||u.hostname==='localhost.')throw Error('Destino local no permitido.');
 try{return {url:normalizeLearnableUrl(u.href),role:'train',depth:0};}catch{}
 return {url:u.href,role:'reference',depth:0,userProvided:true};
}
export function extractUserSourceUrls(text){
 const urls=[];
 for(const match of String(text).matchAll(/https:\/\/[^\s<>"']+/g)){
  try{const url=sourceDescriptor(match[0].replace(/[),.;!?]+$/,'')).url;if(!urls.includes(url))urls.push(url);}catch{}
  if(urls.length===8)break;
 }
 return urls;
}
export function trainingDocuments(documents){return documents.filter(d=>d.role==='train'||d.role==='validation');}
export async function fetchUserReference(source,{get=publicGet,maxCharacters=24000,signal}={}){
 signal?.throwIfAborted();const canonical=sourceDescriptor(source.url);
 const page=await get(canonical.url,0,signal);signal?.throwIfAborted();
 const text=extractText(page.text).slice(0,Math.min(24000,Math.max(100,maxCharacters)));
 if(text.length<100)throw Error('La fuente no contiene suficiente texto legible.');
 return {url:canonical.url,finalUrl:page.url,role:'reference',text,hash:hash(text),fetchedAt:new Date().toISOString(),origin:'user-url'};
}
