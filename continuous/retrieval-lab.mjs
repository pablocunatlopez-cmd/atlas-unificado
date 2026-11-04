import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {searchDocuments} from './engine.mjs';
import {memoryQuery} from './chat.mjs';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stop=new Set('como para que una uno los las del con sin por es se el la de en un y the is how to do'.split(' '));
function terms(text){return [...new Set((text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[\p{L}\p{N}_]+/gu)||[]).filter(value=>value.length>=2&&!stop.has(value)))].slice(0,24);}
function checkedDocuments(documents){
 if(!Array.isArray(documents)||documents.length<1||documents.length>2000)throw new TypeError('Corpus del laboratorio fuera de límites.');
 const seen=new Set();let size=0;
 return documents.map(item=>{if(!object(item)||typeof item.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(item.id)||seen.has(item.id)||typeof item.title!=='string'||item.title.length>200||typeof item.text!=='string'||!item.text.trim()||item.text.length>12000||(size+=item.text.length)>2*1024*1024)throw new TypeError('Documento del laboratorio no válido.');seen.add(item.id);return {id:item.id,title:item.title,text:item.text};});
}

/** An isolated in-memory FTS5 comparison. Never opens Atlas's canonical DB,
 * reads a private corpus, sends network traffic or loads a model. */
export function createRetrievalLab(documents){
 const corpus=checkedDocuments(documents),db=new DatabaseSync(':memory:');let closed=false;
 try{db.exec("CREATE VIRTUAL TABLE passages USING fts5(id UNINDEXED,title,text,tokenize='unicode61 remove_diacritics 2');");const insert=db.prepare('INSERT INTO passages(id,title,text) VALUES(?,?,?)');db.exec('BEGIN');for(const item of corpus)insert.run(item.id,item.title,item.text);db.exec('COMMIT');}catch(error){db.close();throw error;}
 const lexical=corpus.map(d=>({url:'lab://'+d.id,role:'reference',text:d.title+' '+d.text}));
 function search(question,{method='fts5',limit=3}={}){
  if(closed)throw Error('Laboratorio cerrado.');if(typeof question!=='string'||question.length>6000||!Number.isInteger(limit)||limit<1||limit>20||!['fts5','atlas-lexical'].includes(method))throw new TypeError('Consulta de laboratorio no válida.');
  // Both methods receive the same chat normalization, including identifiers.
  const query=memoryQuery(question);
  if(method==='atlas-lexical')return searchDocuments(lexical,query,limit,{includeReferences:true}).filter(r=>r.score>=.35).map(r=>({id:r.url.slice(6),score:r.score}));
  const words=terms(query);if(!words.length)return [];
  const match=words.map(word=>'"'+word.replaceAll('"','""')+'"').join(' OR ');
  return db.prepare('SELECT id,bm25(passages,0,2,1) AS score FROM passages WHERE passages MATCH ? ORDER BY score,id LIMIT ?').all(match,limit).map(row=>({id:row.id,score:row.score}));
 }
 return Object.freeze({search,corpusHash:hash(corpus),close(){if(!closed){closed=true;db.close();}}});
}

/** Rank fusion only: this does not manufacture embeddings or verify facts. */
export function reciprocalRankFusion(rankings,{constant=60,limit=3}={}){
 if(!Array.isArray(rankings)||rankings.length<1||rankings.length>4||!Number.isInteger(constant)||constant<1||constant>1000||!Number.isInteger(limit)||limit<1||limit>20)throw new TypeError('Rangos de fusión no válidos.');
 const scores=new Map();for(const list of rankings){if(!Array.isArray(list)||list.length>1000)throw new TypeError('Lista de fusión fuera de límites.');const seen=new Set();let rank=0;for(const id of list){if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(id))throw new TypeError('ID de fusión no válido.');if(seen.has(id))continue;seen.add(id);rank++;scores.set(id,(scores.get(id)||0)+1/(constant+rank));}}
 return [...scores].map(([id,score])=>({id,score})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,limit);
}

export function evaluateRetrieval(lab,cases,{method='fts5',limit=3,repeats=20}={}){
 if(!Array.isArray(cases)||!cases.length||cases.length>100||!Number.isInteger(repeats)||repeats<1||repeats>100)throw new TypeError('Evaluación fuera de límites.');
 const frozen=cases.map(c=>{if(!object(c)||typeof c.question!=='string'||!Array.isArray(c.relevant)||c.relevant.some(id=>typeof id!=='string'))throw new TypeError('Caso no válido.');return structuredClone(c);}),latencies=[],rows=[];
 const firstStart=performance.now();lab.search(frozen[0].question,{method,limit});const firstSearchMs=performance.now()-firstStart;
 for(const c of frozen){const results=lab.search(c.question,{method,limit}),ids=results.map(x=>x.id),gold=new Set(c.relevant),hits=ids.filter(id=>gold.has(id)).length,first=ids.findIndex(id=>gold.has(id));rows.push({question:c.question,relevant:c.relevant,returned:ids,recall:gold.size?hits/gold.size:null,reciprocalRank:gold.size?(first<0?0:1/(first+1)):null,abstained:ids.length===0});}
 for(let repeat=0;repeat<repeats;repeat++)for(const c of frozen){const start=performance.now();lab.search(c.question,{method,limit});latencies.push(performance.now()-start);}
 latencies.sort((a,b)=>a-b);const answerable=rows.filter(x=>x.recall!==null),absent=rows.filter(x=>x.recall===null),mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
 return {method,corpusHash:lab.corpusHash,casesHash:hash(frozen),k:limit,queryCount:rows.length,recallAtK:mean(answerable.map(x=>x.recall)),mrr:mean(answerable.map(x=>x.reciprocalRank)),noAnswerAbstention:mean(absent.map(x=>Number(x.abstained))),timing:{firstSearchMs,samples:latencies.length,p50Ms:latencies[Math.floor((latencies.length-1)*.5)],p95Ms:latencies[Math.ceil(latencies.length*.95)-1],scope:'Query normalization and retrieval only; excludes generation and embeddings.'},rows,scope:'Small synthetic retrieval experiment, not a general RAG or answer-quality benchmark.'};
}
