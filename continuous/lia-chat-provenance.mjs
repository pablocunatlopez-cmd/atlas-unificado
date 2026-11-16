import {LIA_IDENTITY} from '../cloud/public/house/lia-identity.js';

/**
 * Read-only provenance view for retrieved chat sources.
 * Never treats a snippet, a model answer or a supplied citation as verified truth.
 */
export function classifyLiaChatSources({sources=[],webRead=false,sharedSession=false}={}){
 if(!Array.isArray(sources)||sources.length>16)throw Error('Invalid source list');
 const items=sources.map((source,index)=>{
  if(!source||typeof source!=='object'||Array.isArray(source))
   throw Error('Invalid source');
  const url=typeof source.url==='string'?source.url:'';
  const publicWeb=/^https?:\/\//i.test(url);
  const vertex=publicWeb&&webRead?'physical':'mental';
  const definition=LIA_IDENTITY.vertices.find(v=>v.id===vertex);
  return Object.freeze({
   index,vertex,component:definition.component,
   provenance:publicWeb?(webRead?'retrieved_web_unverified':'web_reference_unread'):'local_retrieval_unverified',
   evidenceVerified:false,
   // Do not echo private paths, content, source text or user identifiers.
   privateScope:sharedSession?'shared_isolated':'owner'
  });
 });
 return Object.freeze({identity:LIA_IDENTITY.name,items:Object.freeze(items),
  unknownVertex:'event',unknownComponent:'Constelación',
  absenceOfEvidenceIsNotFalsity:true,truthVerified:false});
}
