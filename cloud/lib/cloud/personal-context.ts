export type PersonalMemory={title:string;text:string;kind:string;status:string;date:string};
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const words=(value:string)=>new Set(normalize(value).match(/[a-z0-9]{4,}/g)||[]);
const clean=(value:string,max:number)=>value.replace(/\bgsk_[A-Za-z0-9_-]{10,}\b/g,'[redactado]').slice(0,max);
/** Select saved user data, never conversation archives or another user's state.
 * Retired entries and version history must not silently become current facts. */
export function selectPersonalMemories(content:string|undefined|null,question:string):PersonalMemory[]{
 let state;try{state=JSON.parse(content||'{}');}catch{return [];}
 if(!state||typeof state!=='object'||Array.isArray(state))return [];
 const query=words(question),candidates:Array<{memory:PersonalMemory;score:number}>=[];
 for(const m of (Array.isArray(state.memories)?state.memories:[]).slice(0,200)){
  if(!m||typeof m!=='object'||(m.scope!==undefined&&m.scope!=='global'&&m.scope!=='module:chat')||!['Preferencia','Regla','Contexto','Objetivo'].includes(m.kind)||!['Aportado','Por revisar','Confirmado'].includes(m.status)||typeof m.title!=='string'||typeof m.text!=='string'||!m.text.trim())continue;
  const overlap=[...words(m.title+' '+m.text)].filter(w=>query.has(w)).length;
  const priority=m.kind==='Regla'||m.kind==='Preferencia';
  if(!priority&&!overlap)continue;
  candidates.push({memory:{title:clean(m.title,180),text:clean(m.text,1200),kind:m.kind,status:m.status,date:typeof m.date==='string'?m.date.slice(0,40):''},score:(priority?8:0)+overlap*3+(m.status==='Confirmado'?1:0)});
 }
 // User corrections remain explicitly attributed, not independently verified.
 for(const c of (Array.isArray(state.corrections)?state.corrections:[]).slice(-20)){
  if(!c||typeof c.after!=='string'||!c.after.trim())continue;
  const overlap=[...words(c.after+' '+(c.reason||''))].filter(w=>query.has(w)).length;
  if(overlap)candidates.push({memory:{title:'Corrección aportada por la persona',text:clean(c.after,1200),kind:'Corrección',status:'Aportado',date:typeof c.date==='string'?c.date.slice(0,40):''},score:10+overlap*3});
 }
 return candidates.sort((a,b)=>b.score-a.score||b.memory.date.localeCompare(a.memory.date)).slice(0,12).map(c=>c.memory);
}
