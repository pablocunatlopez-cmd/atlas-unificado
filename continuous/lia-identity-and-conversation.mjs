/** Lía is the unified conversational intelligence; Atlas is her mental vertex.
 * Read-only routing plan; no model invocation or character execution is implied.
 */
export const LIA_IDENTITY=Object.freeze({
 id:'lia',name:'Lía',role:'unified-conversational-intelligence',
 home:'Casa de Lía',primaryChat:true,world:'sensory-world',
 vertices:Object.freeze({mental:'atlas',physical:'ion',unexpected:'constelacion'}),
 atlasRole:'mental-reasoning-and-hypotheses',isAtlas:false,
 characterInteraction:'direct-or-unified',worldIsLia:false,
 projectDisplayName:'Lía',historicalRepositoryName:'atlas-unificado'
});
const safeId=s=>typeof s==='string'&&/^[a-z][a-z0-9_-]{0,63}$/.test(s);
export function planLiaConversation({message,characterId='lia',availableCharacters=['lia','atlas','ion','constelacion']}={}){
 if(typeof message!=='string'||!message.trim()||message.length>6000||
  !safeId(characterId)||!Array.isArray(availableCharacters)||availableCharacters.length>200||
  availableCharacters.some(x=>!safeId(x))||new Set(availableCharacters).size!==availableCharacters.length||
  !availableCharacters.includes('lia')||!availableCharacters.includes(characterId))
  throw new TypeError('Invalid Lía conversation request');
 return Object.freeze({schema:'lia-conversation-plan-v1',speaker:characterId,
  coordinator:'lia',mode:characterId==='lia'?'unified-chat':'direct-character',
  mentalVertex:'atlas',world:'sensory-world',
  message:message.trim(),requiresCharacterExecutor:characterId!=='lia',
  responseGenerated:false,characterExecuted:false,toolExecuted:false,
  historicalDataPreserved:true});
}
