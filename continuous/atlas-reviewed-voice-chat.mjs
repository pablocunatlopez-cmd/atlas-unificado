import {planAtlasVoiceTurn} from './atlas-voice-turn-planner.mjs';
import {queryAtlasLocalLlama} from './atlas-local-llama-client.mjs';
/**
 * Human-reviewed voice-to-local-model bridge.
 * Explicit confirmation is mandatory before invoking local inference.
 */
export async function answerAtlasReviewedVoice({transcription,approvedText,endpoint,
 model='local',fetchImpl}={}){
 const plan=planAtlasVoiceTurn({transcription});
 if(typeof approvedText!=='string'||!approvedText.trim()||
  approvedText.trim().length>8000||approvedText.trim()!==plan.content)
  throw Error('Voice transcript must be explicitly reviewed and confirmed');
 const response=await queryAtlasLocalLlama({
  endpoint,messages:[{role:'user',content:approvedText.trim()}],
  model,fetchImpl
 });
 return Object.freeze({answer:response.answer,source:'reviewed_local_voice',
  submittedToLocalModel:true,remote:false,modelVerified:false});
}
