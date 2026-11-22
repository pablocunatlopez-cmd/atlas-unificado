import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LIA_IDENTITY,planLiaConversation} from './lia-identity-and-conversation.mjs';
test('Lía is principal intelligence; Atlas is her mental vertex',()=>{
 assert.equal(LIA_IDENTITY.id,'lia');
 assert.equal(LIA_IDENTITY.vertices.mental,'atlas');
 assert.equal(LIA_IDENTITY.worldIsLia,false);
 assert.equal(LIA_IDENTITY.isAtlas,false);
});
test('unified and character conversations retain Lía coordination',()=>{
 const general=planLiaConversation({message:'Hola'});
 const atlas=planLiaConversation({message:'Razona esto',characterId:'atlas'});
 assert.equal(general.mode,'unified-chat');
 assert.equal(atlas.mode,'direct-character');
 assert.equal(atlas.coordinator,'lia');
 assert.equal(atlas.responseGenerated,false);
 assert.equal(atlas.characterExecuted,false);
});
test('unknown or duplicate character roster is rejected',()=>{
 assert.throws(()=>planLiaConversation({message:'hola',characterId:'unknown'}));
 assert.throws(()=>planLiaConversation({message:'hola',availableCharacters:['lia','lia']}));
 assert.throws(()=>planLiaConversation({message:'hola',availableCharacters:['atlas']}));
});
