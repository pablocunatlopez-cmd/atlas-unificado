/**
 * Atlas/ERAS trusted asset registry. Scene instructions reference asset IDs,
 * never arbitrary URLs, filesystem paths or executable code.
 */
const ID=/^[a-z][a-z0-9_-]{0,63}$/;
const HASH=/^[a-f0-9]{64}$/i;
const TYPES=new Set(['model','texture','animation','audio','environment']);
export function createErasAssetRegistry({maxAssets=1000}={}){
 if(!Number.isSafeInteger(maxAssets)||maxAssets<1||maxAssets>10000)throw Error('Invalid asset limit');
 const assets=new Map();
 return Object.freeze({
  register({id,type,uri,sha256,bytes}={}){
   if(typeof id!=='string'||!ID.test(id)||assets.has(id)||assets.size>=maxAssets||
      !TYPES.has(type)||typeof uri!=='string'||uri.length>512||
      !/^\/assets\/[a-zA-Z0-9_./-]+$/.test(uri)||uri.includes('..')||
      !HASH.test(sha256)||!Number.isSafeInteger(bytes)||bytes<1||bytes>500_000_000)
     throw Error('Invalid or duplicate asset');
   const asset=Object.freeze({id,type,uri,sha256:sha256.toLowerCase(),bytes});
   assets.set(id,asset);return {...asset};
  },
  resolve(id){const asset=assets.get(id);return asset?{...asset}:null;},
  list(){return [...assets.values()].map(x=>({...x}));},
  validateReferences(nodes){
   if(!Array.isArray(nodes))throw Error('Invalid nodes');
   const missing=[];
   for(const node of nodes){
     if(!node||typeof node.asset!=='string')throw Error('Invalid node asset');
     if(node.asset&&!assets.has(node.asset))missing.push({nodeId:node.id,assetId:node.asset});
   }
   return {valid:missing.length===0,missing};
  },
 });
}
