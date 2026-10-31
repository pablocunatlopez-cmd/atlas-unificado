import {evaluateExtension,executePure,validateAcceptance} from './extensions.mjs';
import {isDeepStrictEqual} from 'node:util';
export async function checkToolContract(item){
 const model=await evaluateExtension(item);
 const acceptance=validateAcceptance(item.acceptanceTests||[]);
 const inherited=item.regressionTests||[];
 if(!Array.isArray(inherited)||inherited.length>100||JSON.stringify(inherited).length>100000)throw Error('Contrato heredado demasiado grande o inválido');
 const results=[];
 for(const test of [...acceptance,...inherited]){
  if(!test||!Object.hasOwn(test,'input')||!Object.hasOwn(test,'expected'))throw Error('Caso heredado inválido');
  try{const actual=await executePure(item.source,test.input);results.push({...test,actual,passed:isDeepStrictEqual(actual,test.expected)});}catch(e){results.push({...test,passed:false,error:e.message});}
 }
 return {passed:model.passed&&results.every(t=>t.passed),modelResults:model.results,contractResults:results};
}
export async function retainContract(candidate,parent){
 const cases=[...(parent.regressionTests||[]),...(parent.tests||[]),...(parent.acceptanceTests||[])];
 const seen=new Set();candidate.regressionTests=cases.filter(t=>{const k=JSON.stringify([t.input,t.expected]);if(seen.has(k))return false;seen.add(k);return true;});
 try{candidate.contractCheck=await checkToolContract(candidate);candidate.passed=candidate.passed&&candidate.contractCheck.passed;}
 catch(e){candidate.passed=false;candidate.contractCheck={passed:false,error:e.message};}
 return candidate;
}
