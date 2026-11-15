import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderAtlasVoiceControls} from './atlas-voice-controls-view.mjs';
test('renders confirmation buttons for review state',()=>{
 const html=renderAtlasVoiceControls({phase:'review',transcript:'Hola'});
 assert.match(html,/voice-confirm/);
 assert.match(html,/Hola/);
});
test('escapes user-supplied transcription markup',()=>{
 const html=renderAtlasVoiceControls({phase:'review',transcript:'<img src=x onerror=alert(1)>'});
 assert.doesNotMatch(html,/<img/);
 assert.match(html,/&lt;img/);
});
