import test from 'node:test';import assert from 'node:assert/strict';import {atlasApplicationCapabilities} from './atlas-capabilities.mjs';
test('shared chat learns implemented media and house without acquiring private controls or memories',()=>{
 const result=atlasApplicationCapabilities({sharedSession:true,experience:{enabled:true,phase:'mind',running:true,objective:{kind:'open-inquiry',focus:'suceso',question:'private hypothesis',taskId:null},experiences:12,learningChanges:1,privatePath:'secret'},agents:{aider:{ready:true}},video:{ready:false,token:'secret'}});
 assert.equal(result.house.rooms,10);assert.equal(result.creation.worlds.available,true);assert.equal(result.creation.music.available,true);assert.equal(result.creation.video.available,false);assert.equal(result.codingCollaborators[1].available,true);assert.equal(result.experience.objective.focus,'suceso');assert.equal(result.memory.ownerPrivateMemoryAccessible,false);assert.equal(result.codexPlugins.copied,false);assert.doesNotMatch(JSON.stringify(result),/secret|private hypothesis/);
 assert.equal(atlasApplicationCapabilities({video:{ready:true}}).creation.video.available,true);
});

test('the inhabited house and automatic plan application expose scope without claiming a turn execution or weight improvement',()=>{
 const {house}=atlasApplicationCapabilities();
 assert.deepEqual({total:house.residents.total,workstations:house.residents.workstations,audience:house.residents.audience},{total:24,workstations:18,audience:6});
 assert.equal(house.residents.independentModels,false);assert.match(house.residents.scope,/no son 24 modelos/);
 const design=house.adaptiveDesign;assert.equal(design.automatic,true);assert.deepEqual(design.targets,['maquette','terrace']);assert.deepEqual(design.requires,{cases:6,passed:6,invariantsPreserved:true});
 assert.equal(design.qwenWeightsChanged,false);assert.equal(design.arbitraryCodeExecution,false);assert.equal(design.visualQualityVerified,false);
 assert.match(design.scope,/no demuestra que este turno/);assert.match(design.scope,/no entrena Qwen ni acredita calidad estética/);
 assert.ok(house.source.atlasFiles.includes('public/house/residents.js'));assert.ok(house.source.atlasFiles.includes('public/house/creative-installation.js'));
});
