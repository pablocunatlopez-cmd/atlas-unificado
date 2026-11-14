import type {WebResult} from './web.ts';
const stop=new Set('que como donde cuando cuales cual para por con sin los las una uno unos unas del el la de en un y o se es al lo su sus the and for with from this that what how which are is does do based specific metrics metric tools tool metricas metrica especificas herramientas buscar estudios fuentes fuente documentacion informacion'.split(' '));
const aliases:Record<string,string>={sonido:'audio',senal:'signal',senales:'signal',imagen:'image',imagenes:'image',frecuencia:'frequency',geometria:'geometry',malla:'mesh',memoria:'memory',programacion:'programming',semantica:'semantic',semantico:'semantic',rendimiento:'performance',compresion:'compression',texturas:'texture'};
function terms(value:string){return [...new Set((value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]{2,}/g)||[]).filter(t=>!stop.has(t)).map(t=>(aliases[t]||t).slice(0,7)))];}
export function selectResearchSources(query:string,candidates:WebResult[],limit=3){
 const queryTerms=terms(query),ranked=candidates.map((source,index)=>{
  const title=new Set(terms(source.title)),body=new Set(terms(source.text));
  const titleHits=queryTerms.filter(t=>title.has(t)).length,bodyHits=queryTerms.filter(t=>body.has(t)).length;
  const metadata=/Metadatos/.test(source.kind),accepted=!metadata&&queryTerms.length>0&&(titleHits>=1||bodyHits>=2);
  return{source,index,accepted,score:titleHits*4+bodyHits,reason:metadata?'Solo metadatos; no evidencia del contenido.':accepted?'Coincidencia léxica; no validación semántica.':'Relación léxica insuficiente con la consulta.'};
 }).sort((a,b)=>b.score-a.score||a.index-b.index);
 const chosen=ranked.filter(r=>r.accepted).slice(0,limit),ids=new Set(chosen.map(r=>r.index));
 return{accepted:chosen.map(r=>r.source),rejected:ranked.filter(r=>!ids.has(r.index)).map(r=>({title:r.source.title,url:r.source.url,reason:r.accepted?'Fuera del límite de esta vuelta.':r.reason})),method:'lexical-overlap-v1' as const};
}
