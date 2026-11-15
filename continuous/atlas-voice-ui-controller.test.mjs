import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasVoiceUiController} from './atlas-voice-ui-controller.mjs';
test('connects start, stop, review and confirm in order',async()=>{
 const calls=[];
 const ui=createAtlasVoiceUiController({
  onStart:async()=>calls.push('start'),
  onStop:async()=>{calls.push('stop');return 'Hola Atlas';},
  onConfirm:async text=>{calls.push('confirm:'+text);return 'Hola';}
 });
 await ui.dispatch('voice-start');
 assert.equal(ui.state.phase,'recording');
 await ui.dispatch('voice-stop');
 assert.equal(ui.state.phase,'review');
 assert.match(ui.render(),/voice-confirm/);
 await ui.dispatch('voice-confirm');
 assert.equal(ui.state.phase,'answered');
 assert.deepEqual(calls,['start','stop','confirm:Hola Atlas']);
});
test('does not call confirmation without review',async()=>{
 let confirmations=0;
 const ui=createAtlasVoiceUiController({
  onStart:async()=>{},onStop:async()=>'',onConfirm:async()=>{confirmations++;}});
 await assert.rejects(ui.dispatch('voice-confirm'));
 assert.equal(confirmations,0);
});

test('rejects concurrent voice actions while a callback is pending',async()=>{
 let release;
 const pending=new Promise(resolve=>{release=resolve;});
 const ui=createAtlasVoiceUiController({
  onStart:()=>pending,onStop:async()=>'',onConfirm:async()=>''});
 const first=ui.dispatch('voice-start');
 await assert.rejects(ui.dispatch('voice-stop'),/already in progress/);
 release();
 await first;
 assert.equal(ui.state.phase,'recording');
});
