/**
 * Convert a completed local transcription to a bounded user turn.
 * Does not send messages or trigger an autonomous agent action.
 */
export function planAtlasVoiceTurn({transcription,requireReview=true}={}){
 if(!transcription||transcription.status!=='completed'||transcription.local!==true||
  typeof transcription.transcript!=='string')
  throw Error('Completed local transcription required');
 const text=transcription.transcript.trim();
 if(!text||text.length>8000)throw Error('Invalid voice turn length');
 return Object.freeze({role:'user',content:text,source:'local_whisper',
  requiresUserReview:requireReview!==false,
  readyToSubmit:requireReview===false,
  submitted:false,executed:false});
}
