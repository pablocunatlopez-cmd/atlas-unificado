import {reduceAtlasVoiceUi} from './atlas-voice-ui-state.mjs';
import {renderAtlasVoiceControls} from './atlas-voice-controls-view.mjs';
/**
 * Browser-independent voice UI controller. Trusted host supplies callbacks.
 * The view never invokes microphone or model calls by itself.
 */
export function createAtlasVoiceUiController({onStart,onStop,onConfirm}={}){
 if([onStart,onStop,onConfirm].some(f=>typeof f!=='function'))
  throw Error('Voice UI callbacks required');
 let state={phase:'idle',transcript:''};
 let busy=false;
 const render=()=>renderAtlasVoiceControls(state);
 const transition=event=>{state=reduceAtlasVoiceUi(state,event);return render();};
 return Object.freeze({
  get state(){return Object.freeze({...state});},
  render,
  async dispatch(action,payload){
   if(busy)throw Error('Voice UI operation already in progress');
   if(action==='voice-reset')return transition({type:'RESET'});
   busy=true;
   try{
   if(action==='voice-start'){
    transition({type:'START'});
    try{await onStart();}catch{transition({type:'FAIL'});}
    return render();
   }
   if(action==='voice-stop'){
    if(state.phase!=='recording')throw Error('Voice UI transition not allowed');
    try{
     const transcript=await onStop();
     return transition({type:'TRANSCRIBED',text:transcript});
    }catch{return transition({type:'FAIL'});}
   }
   if(action==='voice-confirm'){
    if(state.phase!=='review')throw Error('Voice UI transition not allowed');
    const text=state.transcript;
    transition({type:'CONFIRM'});
    try{
     const answer=await onConfirm(text);
     return transition({type:'ANSWERED',answer});
    }catch{return transition({type:'FAIL'});}
   }
   throw Error('Unsupported voice UI action');
   }finally{busy=false;}
  }
 });
}
