/** Local-first experience consolidation for Lía.
 * Pure selection and deduplication; no model training, deletion or external calls.
 * Callers must provide evidence status, consent and explicit retention policy.
 */
import {createHash} from 'node:crypto';
const safeId=s=>typeof s==='string'&&/^[a-z][a-z0-9_-]{0,63}$/.test(s);
const digest=s=>createHash('sha256').update(s).digest('hex');
export function consolidateLiaExperiences(experiences,{maxMemories=100,allowUnverified=false}={}){
 if(!Array.isArray(experiences)||experiences.length>10000||
  !Number.isInteger(maxMemories)||maxMemories<0||maxMemories>10000||
  typeof allowUnverified!=='boolean')
  throw new TypeError('Invalid consolidation input');
 const seen=new Set(),candidates=[];let rejected=0,duplicates=0;
 for(const e of experiences){
  if(!e||!safeId(e.characterId)||!['observation','skill','error','hypothesis'].includes(e.kind)||
   typeof e.content!=='string'||!e.content.trim()||e.content.length>4000||
   typeof e.consentToRetain!=='boolean'||typeof e.evidenceVerified!=='boolean'||
   typeof e.priority!=='number'||!Number.isFinite(e.priority)||e.priority<0||e.priority>1)
   throw new TypeError('Invalid experience');
  if(!e.consentToRetain||(!allowUnverified&&!e.evidenceVerified)){rejected++;continue}
  const normalized=e.content.trim().replace(/\s+/g,' ');
  const hash=digest(JSON.stringify([e.characterId,e.kind,normalized]));
  if(seen.has(hash)){duplicates++;continue}
  seen.add(hash);
  candidates.push({characterId:e.characterId,kind:e.kind,content:normalized,
   evidenceVerified:e.evidenceVerified,priority:e.priority,contentHash:hash});
 }
 candidates.sort((a,b)=>b.priority-a.priority||a.contentHash.localeCompare(b.contentHash));
 const retained=candidates.slice(0,maxMemories).map(x=>Object.freeze(x));
 return Object.freeze({schema:'lia-memory-consolidation-v1',retained:Object.freeze(retained),
  rejected,duplicates,capacityDropped:Math.max(0,candidates.length-maxMemories),
  trainedWeights:false,networkAccess:false,rawInputsDeleted:false,
  evidenceIndependentlyChecked:false,requiresReview:true});
}
