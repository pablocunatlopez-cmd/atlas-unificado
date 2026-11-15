/**
 * Explicit UI state machine for voice interaction.
 * Never starts recording or submits content on its own.
 */
export function reduceAtlasVoiceUi(state={phase:'idle',transcript:''},event={}){
 const phase=state?.phase;
 if(!['idle','recording','review','submitting','answered','error'].includes(phase))
  throw Error('Invalid voice UI state');
 const type=event?.type;
 if(type==='RESET')return Object.freeze({phase:'idle',transcript:''});
 if(type==='START'&&phase==='idle')return Object.freeze({phase:'recording',transcript:''});
 if(type==='TRANSCRIBED'&&phase==='recording'&&
  typeof event.text==='string'&&event.text.trim()&&event.text.length<=8000)
  return Object.freeze({phase:'review',transcript:event.text.trim()});
 if(type==='CONFIRM'&&phase==='review')
  return Object.freeze({phase:'submitting',transcript:state.transcript});
 if(type==='ANSWERED'&&phase==='submitting'&&typeof event.answer==='string')
  return Object.freeze({phase:'answered',transcript:state.transcript,answer:event.answer});
 if(type==='FAIL'&&['recording','review','submitting'].includes(phase))
  return Object.freeze({phase:'error',transcript:state.transcript??'',error:'voice_operation_failed'});
 throw Error('Voice UI transition not allowed');
}
