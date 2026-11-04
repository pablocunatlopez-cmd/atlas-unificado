import {publicCitationUrl} from './retrieval-policy.mjs';

// This checks reference identity only. It cannot prove that a source supports
// a statement, or that a page was read during this turn.
export function labelCitationSources(sources){
 const safe=[];
 for(const source of (Array.isArray(sources)?sources:[]).slice(0,32)){
  if(!source||typeof source!=='object'||Array.isArray(source))continue;
  const citationUrl=publicCitationUrl(source.url);
  // Local canonical memory can have a non-web identifier. Web contexts with
  // credentials, executable schemes or local destinations are excluded, not
  // merely rendered as plain text. An external citation object has no authority.
  const localIdentifier=typeof source.url==='string'&&source.verification==='unverified-source'&&/^(?:atlas|lab|memory|file):\/\//.test(source.url)&&/^source-[a-f0-9]{20}$/.test(source.sourceId||'');
  if(!citationUrl&&!localIdentifier)continue;
  const item={url:source.url,citationLabel:'F'+(safe.length+1),citationUrl};
  for(const [key,limit] of Object.entries({title:300,excerpt:4000,method:200,fetchedAt:80,sourceId:100,contentHash:64,canonicalId:200,validFrom:80,validUntil:80,verification:80}))if(typeof source[key]==='string')item[key]=source[key].slice(0,limit);
  if(typeof source.version==='number'&&Number.isFinite(source.version))item.version=source.version;
  else if(typeof source.version==='string')item.version=source.version.slice(0,80);
  if(typeof source.score==='number'&&Number.isFinite(source.score))item.score=source.score;
  if(Array.isArray(source.matchedTerms))item.matchedTerms=source.matchedTerms.filter(value=>typeof value==='string').slice(0,12).map(value=>value.slice(0,100));
  if(source.requestedUrl&&publicCitationUrl(source.requestedUrl))item.requestedUrl=source.requestedUrl;
  item.citation=citationUrl?{id:source.sourceId||item.citationLabel,url:citationUrl,kind:'source-provenance',verified:false}:null;
  safe.push(item);if(safe.length===12)break;
 }
 return safe;
}
export function auditCitations(answer,sources){
 const available=new Map((Array.isArray(sources)?sources:[]).filter(source=>/^F\d+$/.test(source?.citationLabel)).map(source=>[source.citationLabel,source]));
 const text=String(answer??'').slice(0,64000).replace(/```[\s\S]*?(?:```|$)/g,'').replace(/`[^`\n]+`/g,'');
 const labels=[...new Set([...text.matchAll(/\[(F\d+)\]/g)].map(match=>match[1]))].slice(0,50);
 const unknownLabels=labels.filter(label=>!available.has(label));
 const knownUrls=new Set([...available.values()].map(source=>source.citationUrl).filter(Boolean));
 const linkedUrls=[...new Set([...text.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map(match=>publicCitationUrl(match[1])).filter(Boolean))].slice(0,50);
 return {kind:'reference-identity-only',semanticSupportVerified:false,sourceTruthVerified:false,availableSources:available.size,referencedLabels:labels.filter(label=>available.has(label)),unknownLabels,providedSourceLinks:linkedUrls.filter(url=>knownUrls.has(url)).length,otherLinks:linkedUrls.filter(url=>!knownUrls.has(url)).length,status:unknownLabels.length?'unknown-references':labels.length||linkedUrls.length?'references-checked':'unattributed'};
}
export function citationInstructions(sources){
 if(!sources.length)return '';
 return 'Referencias de este turno: cada extracto lleva citationLabel F1, F2, etc. Para afirmaciones tomadas de esos extractos usa [F1], [F2] según corresponda. No inventes etiquetas ni fuentes. Si una fuente es histórica o no verificada, dilo cuando afecte a la respuesta. Un enlace fuera de estas fuentes es un recurso no consultado, no evidencia leída. Si los extractos no resuelven la pregunta, declara que no consta en ellos. Una cita acredita procedencia, no verdad ni vigencia por sí sola.';
}
