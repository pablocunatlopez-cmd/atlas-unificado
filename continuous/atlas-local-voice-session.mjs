import {createAtlasVoiceUiController} from './atlas-voice-ui-controller.mjs';
import {answerAtlasReviewedVoice} from './atlas-reviewed-voice-chat.mjs';
/**
 * End-to-end local voice flow orchestrator.
 * Host provides microphone/recording/transcription; this module never
 * accesses the microphone or starts a model without explicit confirmation.
 */
export function createAtlasLocalVoiceSession({startRecording,stopAndTranscribe,
 endpoint,model='local',fetchImpl}={}){
 if(typeof startRecording!=='function'||typeof stopAndTranscribe!=='function')
  throw Error('Trusted local recording callbacks required');
 let lastTranscription=null;
 const ui=createAtlasVoiceUiController({
  onStart:startRecording,
  onStop:async()=>{
   const result=await stopAndTranscribe();
   if(!result||result.status!=='completed'||result.local!==true||
    typeof result.transcript!=='string')throw Error('Invalid local transcription');
   lastTranscription=result;
   return result.transcript;
  },
  onConfirm:async text=>{
   if(!lastTranscription)throw Error('No local transcription to confirm');
   const response=await answerAtlasReviewedVoice({
    transcription:lastTranscription,approvedText:text,confirmed:true,
    endpoint,model,fetchImpl
   });
   return response.answer;
  }
 });
 return Object.freeze({ui,render:()=>ui.render(),dispatch:(action)=>ui.dispatch(action)});
}
