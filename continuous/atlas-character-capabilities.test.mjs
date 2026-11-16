import {test} from 'node:test';
import assert from 'node:assert/strict';
import {atlasCharacterCapabilityMap,proposeAtlasCharacterForCapability} from './atlas-character-capabilities.mjs';
test('world map retains central roles and assigns each character a bounded capability',()=>{
 const names=new Set(atlasCharacterCapabilityMap.map(x=>x.name));
 for(const name of ['Atlas','Lía','Ion','Constelación','Da Vinci','Ícaro','Noa','Talo','Vera','Mnemosine','Galileo','Darwin'])assert.ok(names.has(name),name);
 assert.equal(new Set(atlasCharacterCapabilityMap.map(x=>x.id)).size,atlasCharacterCapabilityMap.length);
 assert.ok(atlasCharacterCapabilityMap.every(x=>x.room&&x.capability&&!x.autonomous&&!x.canGrantPermissions));
});
test('proposal never claims an implemented agent or permission',()=>{
 const result=proposeAtlasCharacterForCapability('verification');
 assert.equal(result.characters[0].name,'Vera');
 assert.equal(result.implemented,false);
 assert.equal(result.requiresIntegrationReview,true);
 assert.throws(()=>proposeAtlasCharacterForCapability(''));
});
