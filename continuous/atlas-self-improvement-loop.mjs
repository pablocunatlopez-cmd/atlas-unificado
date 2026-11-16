import {createHash} from 'node:crypto';
import {planAtlasSelfImprovement} from './atlas-self-improvement-planner.mjs';
import {critiqueAtlasSelfImprovement} from './atlas-self-improvement-critic.mjs';
/**
 * Bounded, pure, dry-run improvement loop. A caller may provide revisions,
 * but this module never invokes models, code execution or repository writes.
 */
export function runAtlasSelfImprovementDryLoop({
 constitution,roadmap,rounds=[],rejectedHistory=[],maxRounds=5
}={}){
 if(!Number.isInteger(maxRounds)||maxRounds<1||maxRounds>10||
    !Array.isArray(rounds)||rounds.length>maxRounds||
    !Array.isArray(rejectedHistory)||rejectedHistory.length>200)
  throw Error('Invalid bounded improvement loop');
 const history=[];
 let previousFingerprint=null;
 let stopReason='input_exhausted';
 for(const observations of rounds){
  const plan=planAtlasSelfImprovement({constitution,roadmap,observations});
  const review=critiqueAtlasSelfImprovement(plan,{rejectedHistory});
  const fingerprint=createHash('sha256').update(JSON.stringify(
   plan.proposals.map(p=>({id:p.id,candidates:p.candidates.map(c=>c.description)}))
  )).digest('hex');
  if(fingerprint===previousFingerprint){
   stopReason='stagnation';
   break;
  }
  previousFingerprint=fingerprint;
  history.push(Object.freeze({round:history.length+1,plan,review,fingerprint}));
  if(review.reviews.length===0){stopReason='no_proposals';break;}
  if(review.reviews.every(r=>r.disposition==='revise_all_candidates')){
   stopReason='all_candidates_need_revision';
   break;
  }
 }
 return Object.freeze({schemaVersion:1,mode:'dry_run',
  history:Object.freeze(history),stopReason,roundsCompleted:history.length,
  codeExecuted:false,patchApplied:false,authorizationGranted:false,
  note:'Rounds are supplied observations, not autonomous model reasoning or tested improvements'});
}
