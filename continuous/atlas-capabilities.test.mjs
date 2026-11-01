import test from 'node:test';import assert from 'node:assert/strict';import {atlasApplicationCapabilities} from './atlas-capabilities.mjs';
test('shared chat learns implemented media and house without acquiring private controls or memories',()=>{
 const result=atlasApplicationCapabilities({sharedSession:true,experience:{enabled:true,phase:'mind',running:true,objective:{kind:'open-inquiry',focus:'suceso',question:'private hypothesis',taskId:null},experiences:12,learningChanges:1,privatePath:'secret'},agents:{aider:{ready:true}},video:{ready:false,token:'secret'}});
 assert.equal(result.house.rooms,10);assert.equal(result.creation.worlds.available,true);assert.equal(result.creation.music.available,true);assert.equal(result.creation.video.available,false);assert.equal(result.codingCollaborators[1].available,true);assert.equal(result.experience.objective.focus,'suceso');assert.equal(result.memory.ownerPrivateMemoryAccessible,false);assert.equal(result.codexPlugins.copied,false);assert.doesNotMatch(JSON.stringify(result),/secret|private hypothesis/);
 assert.equal(atlasApplicationCapabilities({video:{ready:true}}).creation.video.available,true);
});
