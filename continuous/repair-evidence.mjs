import {isDeepStrictEqual} from 'node:util';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function firstDifference(left,right,path='$',depth=0){
 if(isDeepStrictEqual(left,right))return null;
 if(depth>=12)return path+':depth';
 if(Array.isArray(left)&&Array.isArray(right)){
  if(left.length!==right.length)return path+'.length';
  for(let i=0;i<Math.min(left.length,256);i++){const found=firstDifference(left[i],right[i],path+'[*]',depth+1);if(found)return found;}
  return path+':array';
 }
 if(object(left)&&object(right)){
  const keys=Object.keys(left).sort(),other=Object.keys(right).sort();if(!isDeepStrictEqual(keys,other))return path+':keys';
  for(const key of keys.slice(0,128)){const found=firstDifference(left[key],right[key],path+'.'+key,depth+1);if(found)return found;}
  return path+':object';
 }
 return path+':value';
}

/** Selects prompt examples only. The caller must retain and execute every
 * regression outside this selection. Groups are a heuristic for repeated
 * mismatch shapes, not a proof that two inputs have equivalent semantics.
 * Whole observed JSON packets are kept; oversized packets are omitted rather
 * than inventing a smaller input, truncating JSON or changing an oracle.
 */
export function selectRepairEvidence(failures,{maxChars=2800,maxExamples=4}={}){
 if(!Array.isArray(failures)||!Number.isSafeInteger(maxChars)||maxChars<2||maxChars>8000||!Number.isSafeInteger(maxExamples)||maxExamples<1||maxExamples>8)throw new TypeError('Presupuesto de refutaciones no válido.');
 const groups=new Map();
 for(const [index,item] of failures.slice(0,10000).entries()){
  if(!object(item)||!Object.hasOwn(item,'input')||!Object.hasOwn(item,'expected'))continue;
  try{
   const value={input:item.input,expected:item.expected,...(Object.hasOwn(item,'actual')?{actual:item.actual}:{}),...(typeof item.error==='string'?{error:item.error.slice(0,250)}:{})};
   // JSON round-trip rejects non-serializable observations and isolates results.
   const encoded=JSON.stringify(value),packet=JSON.parse(encoded);if(encoded.length+2>maxChars||!Object.hasOwn(packet,'input')||!Object.hasOwn(packet,'expected'))continue;
   if(Object.hasOwn(packet,'actual')&&!packet.error&&isDeepStrictEqual(packet.actual,packet.expected))continue;
   const expectedError=typeof packet.expected?.error==='string'?packet.expected.error:'';
   const executionError=typeof packet.error==='string'?packet.error.replace(/\b[\da-f]{8,}\b|\d+/gi,'#'):'';
   const signature=JSON.stringify([expectedError,executionError,Object.hasOwn(packet,'actual')?firstDifference(packet.expected,packet.actual):'unobserved']);
   const old=groups.get(signature);if(!old||encoded.length<old.encoded.length)groups.set(signature,{packet,encoded,index:old?.index??index});
  }catch{}
 }
 const selected=[];
 for(const candidate of [...groups.values()].sort((a,b)=>a.encoded.length-b.encoded.length||a.index-b.index)){
  if(selected.length===maxExamples)break;
  const next=[...selected,candidate];if(JSON.stringify(next.map(value=>value.packet)).length<=maxChars)selected.push(candidate);
 }
 return selected.sort((a,b)=>a.index-b.index).map(value=>value.packet);
}
