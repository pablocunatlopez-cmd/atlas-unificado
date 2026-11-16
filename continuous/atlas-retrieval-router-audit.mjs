import {createHash} from 'node:crypto';
import {proposeAtlasRetrievalRoute} from './atlas-retrieval-router.mjs';
const CLASSES=['exact-identifier','conceptual','ambiguous'];
/** Evaluation-only classifier audit. Never changes production routing. */
export function evaluateAtlasRetrievalRouter(cases,{minimumCases=30}={}){
 if(!Array.isArray(cases)||!cases.length||cases.length>10000||
  !Number.isInteger(minimumCases)||minimumCases<1)throw new TypeError('Invalid router audit');
 const matrix=Object.fromEntries(CLASSES.map(c=>[c,Object.fromEntries(CLASSES.map(k=>[k,0]))]));
 const ids=new Set(),errors=[];
 for(const c of cases){
  if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||
   typeof c.question!=='string'||!CLASSES.includes(c.expected))
   throw new TypeError('Invalid or duplicate labeled case');
  ids.add(c.id);
  const actual=proposeAtlasRetrievalRoute(c.question).route;
  matrix[c.expected][actual]++;
  if(actual!==c.expected)errors.push({id:c.id,expected:c.expected,actual});
 }
 const perClass=Object.fromEntries(CLASSES.map(label=>{
  const tp=matrix[label][label];
  const fn=CLASSES.reduce((n,p)=>n+matrix[label][p],0)-tp;
  const fp=CLASSES.reduce((n,p)=>n+matrix[p][label],0)-tp;
  return [label,{precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null,falsePositives:fp,falseNegatives:fn,support:tp+fn}];
 }));
 const correct=CLASSES.reduce((n,c)=>n+matrix[c][c],0);
 const fixtureHash='sha256:'+createHash('sha256').update(JSON.stringify(cases.map(c=>[c.id,c.question,c.expected]).sort((a,b)=>a[0].localeCompare(b[0])))).digest('hex');
 return Object.freeze({schema:'atlas-router-audit-v1',cases:cases.length,fixtureHash,accuracy:correct/cases.length,
  confusionMatrix:matrix,perClass,errors,adequateSample:cases.length>=minimumCases,
  decision:'review-only',autoSwitch:false,verifiedAgainstProduction:false});
}
