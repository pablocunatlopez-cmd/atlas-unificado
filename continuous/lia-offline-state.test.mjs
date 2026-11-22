import {test} from 'node:test';
import assert from 'node:assert/strict';
import {offlineThreadToState} from '../cloud/lib/core/lia-offline-state.mjs';
import {readFileSync} from 'node:fs';
test('offline transcript conversion preserves existing private Atlas state',()=>{
 const state={threads:[{id:'existing'}],memories:[{id:'m1'}],settings:{name:'Pablo'}};
 const updated=offlineThreadToState(state,[{role:'user',text:'Hola'},{role:'assistant',text:'Hola'}],{threadId:'offline-1'});
 assert.equal(state.threads.length,1);
 assert.equal(updated.threads.length,2);
 assert.deepEqual(updated.memories,state.memories);
 assert.equal(updated.threads[1].messages[0].role,'user');
 assert.throws(()=>offlineThreadToState(updated,[],{threadId:'offline-1'}));
});
test('legacy offline state helper is not wired into canonical Lía chat',()=>{
 const main=readFileSync(new URL('../cloud/app/cloud-chat.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(main,/lia-offline-state|saveConversation/);
});
