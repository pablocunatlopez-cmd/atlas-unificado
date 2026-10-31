import {TinyLanguageModel, encode, validateSnapshot,random,config as modelConfig} from '../public/core/language-model.mjs';
import {createHash} from 'node:crypto';
export const hash = text => createHash('sha256').update(text).digest('hex');
export function normalizeLearnableUrl(value){
  let u;try{u=new URL(value);}catch{throw Error('La dirección no es una URL válida.');}
  if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('Solo se admiten páginas HTTPS públicas sin credenciales ni puerto personalizado.');
  const p=u.pathname,h=u.hostname.toLowerCase();
  const allowed=(h==='developer.mozilla.org'&&/^\/(?:es|en-us)\/docs\/Web\//.test(p))||
    (h==='docs.python.org'&&/^\/(?:es\/3|3)\/(?:tutorial|library)\//.test(p))||
    (h==='docs.godotengine.org'&&/^\/(?:en|es)\/stable\//.test(p))||
    (h==='docs.unity3d.com'&&/^\/(?:es|en)\/current\/Manual\//.test(p))||
    (h==='docs.blender.org'&&/^\/manual\/(?:en|es)\/latest\//.test(p))||
    (h==='dev.epicgames.com'&&/^\/documentation\/(?:en-us\/)?unreal-engine(?:\/|$)/.test(p))||
    (h==='learn.microsoft.com'&&/^\/(?:en-us|es-es)\/dotnet\/(?:csharp|api)\//.test(p))||
    (h==='react.dev'&&/^\/learn(?:\/|$)/.test(p))||
    (h==='www.typescriptlang.org'&&/^\/docs(?:\/|$)/.test(p))||
    (h==='threejs.org'&&/^\/manual(?:\/|$)/.test(p));
  if(!allowed)throw Error('URL fuera de la lista de documentación oficial admitida.');
  u.hash='';u.search='';return u.href;
}
export function discoverLinks(html,base) {
  const found=new Set();
  for(const m of html.matchAll(/href=["']([^"']+)["']/gi)){
    try{
      found.add(normalizeLearnableUrl(new URL(m[1],base).href));
    }catch{}
  }
  return [...found];
}
export function extractText(html) {
  const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  return main.replace(/<(script|style|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
    .replace(/<[^>]+>/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),0x10ffff)))
    .replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(Math.min(parseInt(n,16),0x10ffff)))
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39|ndash|mdash|hellip);/gi,s=>({'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&ndash;':'–','&mdash;':'—','&hellip;':'…'}[s.toLowerCase()]))
    .replace(/\s+/g,' ').trim();
}
const normalize=text=>text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const searchIndexCache=new WeakMap();
function indexedRows(documents){
  const cached=searchIndexCache.get(documents);if(cached)return cached;
  const rows=documents.filter(d=>d.role==='train').map(doc=>{
    const tokens=normalize(doc.text).match(/[a-z0-9_]{2,}/g)||[],freq=new Map();
    for(const token of tokens)freq.set(token,(freq.get(token)||0)+1);
    return {doc,freq,length:tokens.length};
  });
  const result={rows,averageLength:Math.max(1,rows.reduce((sum,row)=>sum+row.length,0)/Math.max(rows.length,1))};
  searchIndexCache.set(documents,result);return result;
}
export function searchDocuments(documents,query,limit=5){
  const stop=new Set('para por con sin una uno unos unas los las del que como donde cuando desde hasta sobre entre esta este esto estos estas son ser eres soy tengo tienes quiero puedes puede puedo ayuda atlas'.split(' '));
  const terms=[...new Set((normalize(query).match(/[a-z0-9_]{2,}/g)||[]).filter(t=>!stop.has(t)))].slice(0,12);
  if(!terms.length)return [];
  const {rows,averageLength}=indexedRows(documents);
  const idf=new Map(terms.map(term=>{
    const df=rows.reduce((sum,row)=>sum+(row.freq.has(term)?1:0),0);
    return [term,Math.log(1+(rows.length-df+0.5)/(df+0.5))];
  }));
  const weightTotal=[...idf.values()].reduce((sum,value)=>sum+value,0)||1;
  const phrase=terms.join(' ');
  return rows.map(row=>{
    const matched=terms.filter(term=>row.freq.has(term));
    if(!matched.length)return null;
    let score=0;
    for(const term of matched){
      const tf=row.freq.get(term),denominator=tf+1.2*(1-0.75+0.75*row.length/averageLength);
      score+=idf.get(term)*(tf*2.2/denominator);
    }
    score/=weightTotal;
    const text=normalize(row.doc.text),phraseBoost=phrase.length>5&&text.includes(phrase)?0.12:0;
    score=Math.min(1,score+phraseBoost);
    const firstPosition=Math.min(...matched.map(term=>text.indexOf(term)).filter(position=>position>=0));
    const start=Math.max(0,(Number.isFinite(firstPosition)?firstPosition:0)-180);
    return {url:row.doc.url,fetchedAt:row.doc.fetchedAt,score,matchedTerms:matched,excerpt:row.doc.text.slice(start,start+850)};
  }).filter(Boolean).sort((a,b)=>b.score-a.score||a.url.localeCompare(b.url)).slice(0,limit);
}
export function replayIndices(length,steps,offset=0){
  if(length<1)throw Error('No hay documentos de entrenamiento.');
  // Alternate the newest document with a rotating replay of older documents.
  return Array.from({length:Math.ceil(steps/100)},(_,i)=>
    i%2===0?length-1:(Math.floor(i/2)+offset)%Math.max(1,length-1));
}
export async function experiment(snapshot, documents, steps, cancelled=()=>false,options={}) {
  const available=documents.filter(d=>d.role==='train');
  // Bound each worker's memory; always include the newest document.
  const offset=Math.floor((snapshot?.steps||0)/100)%Math.max(1,available.length-1);
  const training=available.length<=64?available:[...Array.from({length:63},(_,i)=>available[(offset+i)%(available.length-1)]),available.at(-1)];
  const validation=documents.filter(d=>d.role==='validation');
  if(!training.length || !validation.length)throw Error('Faltan documentos separados para entrenamiento y validación.');
  if(available.some(a=>validation.some(b=>a.url===b.url||a.hash===b.hash)))throw Error('Contaminación: documento compartido entre entrenamiento y validación.');
  const model=new TinyLanguageModel(snapshot);
  const rows=training.map(d=>encode(d.text)).filter(d=>d.length>100);
  const reserve=validation.map(d=>encode(d.text)).filter(d=>d.length>100);
  if(!rows.length||!reserve.length)throw Error('Texto insuficiente.');
  const score=()=>reserve.reduce((sum,row)=>sum+model.evaluate(row,100),0)/reserve.length;
  const before=score();
  let completed=0;
  const indices=replayIndices(rows.length,steps,Math.floor(model.steps/200));
  const used=new Set();
  const rng=random(options.seed??109);
  for(;completed<steps;){
    if(cancelled())throw Error('Entrenamiento pausado.');
    const count=Math.min(100,steps-completed);
    const index=indices[Math.floor(completed/100)];used.add(index);
    if(options.learningRate){
      const row=rows[index],context=modelConfig.context;
      for(let k=0;k<count;k++){const position=context+Math.floor(rng()*(row.length-context));model.trainOne(row.slice(position-context,position),row[position],options.learningRate);}
    }else model.train(rows[index],count,(options.seed??109)+completed);
    completed+=count;
    await new Promise(resolve=>setTimeout(resolve,options.yieldMs??30));
  }
  const after=score(), candidate=model.snapshot();
  if(!validateSnapshot(candidate)||!Number.isFinite(before)||!Number.isFinite(after))throw Error('Pesos o métricas no finitos.');
  return {candidate,metrics:{before,after,steps:completed,accepted:after<before-.001,trainingDocuments:training.length,documentsActuallyTrained:used.size,newestDocumentTrained:used.has(rows.length-1),validationDocuments:validation.length,
    evaluation:'Validación reutilizada para selección; no es test ciego ni demuestra capacidad de programar.'}};
}
