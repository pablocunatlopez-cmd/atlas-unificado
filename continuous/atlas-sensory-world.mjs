/** Atlas sensory-world geometry. Interpretive UI model, not a physical theory.
 * Lía is the conversational AI that integrates the inhabitants of a separate sensory world.
 * The circle represents accessible sensory experience, not total reality.
 */
export const atlasSensoryWorld=Object.freeze({
 schema:'atlas-sensory-world-v1',
 lia:Object.freeze({id:'lia',name:'Lía',role:'unified-conversational-ai',home:'Casa de Lía',isSensoryWorld:false,isSeparateVertex:false}),
 whole:Object.freeze({id:'sensory-world',name:'Mundo sensorial',shape:'circle',role:'bounded-accessible-experience',isSeparateVertex:false}),
 vertices:Object.freeze([
  Object.freeze({id:'atlas',name:'Atlas',role:'mental',x:0.5,y:0.17}),
  Object.freeze({id:'ion',name:'Ion',role:'physical',x:0.2,y:0.69}),
  Object.freeze({id:'constelacion',name:'Constelación',role:'god-event',x:0.8,y:0.69})
 ]),
 triangle:'internal-relations-between-three-vertices',
 inhabitantsAccess:'visit-and-converse-directly-from-lia-house',
 unifiedConversation:'lia-integrates-character-contributions',
 sensoryBoundary:'accessible-to-observer-through-perception-language-memory-and-instruments',
 beyondBoundary:'unknown-not-directly-observed',
 unexpectedEvent:'record-new-evidence-and-revise-with-history-preserved',
 historicalSymbolism:'eye-and-triangle-as-user-philosophical-metaphor-not-evidence-of-illuminati-control',
 time:'tangent-to-evolving-spiral',
 autonomousAgents:false,
});
export function projectAtlasSensoryWorld({observations=[],hypotheses=[],surprises=[]}={}){
 for(const collection of [observations,hypotheses,surprises])
  if(!Array.isArray(collection)||collection.length>1000)throw new TypeError('Invalid sensory projection');
 const safe=items=>items.map(x=>{
  if(!x||typeof x.id!=='string'||!x.id||typeof x.label!=='string'||x.label.length>500)
   throw new TypeError('Invalid sensory item');
  return Object.freeze({id:x.id,label:x.label,evidenceVerified:x.evidenceVerified===true});
 });
 return Object.freeze({world:atlasSensoryWorld,physical:Object.freeze(safe(observations)),
  mental:Object.freeze(safe(hypotheses)),unknown:Object.freeze(safe(surprises)),
  scope:'declared-observations-only',claimsTotalReality:false,canExecuteActions:false});
}
