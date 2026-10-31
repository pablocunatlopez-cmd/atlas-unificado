import {chunkKnowledge,retrieve,tokens,calculate,deduce,type RetrievalProfile} from '../atlas-core.ts';
import type {AtlasReply} from '../atlas-types.ts';
import {searchInternet,readPublicPage,type WebSearch} from './web.ts';
export function wantsInternet(text:string,enabled:boolean){
 try{if(calculate(text)||deduce(text))return false;}catch{return false;}
 return enabled||/https:\/\/|\b(?:internet|web|busca|buscar|investiga|investigar|actualidad|actualizado|hoy|reciente|noticias)\b/i.test(text);
}
export async function internetForQuestion(text:string):Promise<WebSearch>{
 const url=text.match(/https:\/\/[^\s<>]+/)?.[0];
 if(url){try{const result=await readPublicPage(url);return{query:text.slice(0,240),results:[result],attempts:[{provider:'Lectura HTTPS',ok:true,detail:'Texto leído'}],fetchedAt:new Date().toISOString()};}catch(e){return{query:text.slice(0,240),results:[],attempts:[{provider:'Lectura HTTPS',ok:false,detail:e instanceof Error?e.message:'No disponible'}],fetchedAt:new Date().toISOString()};}}
 const query=tokens(text).filter(t=>!['busca','buscar','investiga','investigar','internet','web','consulta','consultar','explica','explicame','actualizada','actualizado'].includes(t)).slice(0,14).join(' ')||text.slice(0,240);
 return searchInternet(query);
}
export function addInternetReply(reply:AtlasReply,web:WebSearch,profile:RetrievalProfile):AtlasReply{
 const documents=chunkKnowledge(web.results.map((r,i)=>({id:'web:'+i,title:r.title,text:r.text,kind:r.kind,url:r.url,date:web.fetchedAt})));
 const hits=retrieve(web.query,documents,3,profile);
 const ok=web.attempts.some(a=>a.ok);
 const attempts=web.attempts.map(a=>a.provider+': '+(a.ok?a.detail:'no disponible ('+a.detail+')'));
 if(!hits.length)return{...reply,searched:true,answer:(ok?'He consultado fuentes públicas, pero no he encontrado fragmentos suficientes para esta pregunta.':'No he podido acceder a las fuentes públicas en este intento.')+'\n\n'+reply.answer,unknowns:[...reply.unknowns,...attempts].slice(0,12)};
 return{...reply,searched:true,confidence:'Limitada',answer:'He consultado internet y recuperado estos extractos:\n\n'+hits.map((h,i)=>`[${i+1}] ${h.title}\n${h.text.slice(0,900)}`).join('\n\n')+'\n\nSon extractos con procedencia, no una síntesis verificada. Puedo incorporarlos a la investigación si abres Internet y aprendizaje.',basis:`Lectura pública realizada ${web.fetchedAt}. Recuperación propia con perfil ${profile}; sin modelos externos.`,claims:hits.map(h=>({label:/Metadatos/.test(h.kind)?'Referencia por revisar':'Contenido externo por contrastar',text:h.text.slice(0,600),why:h.kind+' · consulta '+web.fetchedAt})),sources:hits.map(h=>({title:h.title,url:h.url!,kind:h.kind})),unknowns:['La fuente puede contener errores o estar desactualizada; la fecha de consulta no es su fecha de publicación.','No he verificado de forma independiente la verdad de los extractos.','Los resúmenes y metadatos no sustituyen la lectura del estudio o código completo.',...attempts.filter((_,i)=>!web.attempts[i].ok)].slice(0,12),nextSteps:['Abre Internet y aprendizaje para investigar el tema, guardar versiones y consultar las pruebas.'],frame:{...reply.frame,environment:'Fuentes públicas consultadas por HTTPS',perspective:'Atlas Core: extracción y recuperación acotadas'},triangle:{...reply.triangle,center:`${web.attempts.filter(a=>a.ok).length}/${web.attempts.length} accesos disponibles en esta consulta.`}};
}
