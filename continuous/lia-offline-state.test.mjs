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
test('offline persistence is opt-in, authenticated, revision guarded and reversible',()=>{
 const ui=readFileSync(new URL('../cloud/app/chat/offline/offline-chat.tsx',import.meta.url),'utf8');
 assert.match(ui,/async function saveConversation\(\)/);
 assert.match(ui,/fetch\('\/api\/state'/);
 assert.match(ui,/revision:snapshot\.revision/);
 assert.match(ui,/Guardar en mi espacio Atlas/);
 assert.match(ui,/no se guarda automáticamente/);
 assert.match(ui,/Exportar conversación/);
});
