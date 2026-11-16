import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('execution events are owner-scoped and use actual stored jobs',()=>{
 const queue=readFileSync(new URL('../cloud/lib/cloud/queue.mjs',import.meta.url),'utf8');
 assert.match(queue,/async function conversationExecutionEvents\(userId,id\)/);
 assert.match(queue,/await ownedConversation\(userId,id\)/);
 assert.match(queue,/FROM cloud_jobs WHERE conversation_id=\? AND user_id=\?/);
 assert.match(queue,/evidence:'cloud_jobs'/);
 assert.match(queue,/hypothesis:null,revision:null/);
 assert.match(queue,/conversationExecutionEvents,getJob/);
});
test('authenticated endpoint joins canonical messages and actual execution records',()=>{
 const route=readFileSync(new URL('../cloud/app/api/lia-world/conversations/[id]/route.ts',import.meta.url),'utf8');
 assert.match(route,/await cloudUser\(\)/);
 assert.match(route,/store\.conversation\(user\.userId,id\)/);
 assert.match(route,/store\.conversationExecutionEvents\(user\.userId,id\)/);
});
test('visualization explicitly labels unrecorded hypothesis and revision',()=>{
 const view=readFileSync(new URL('../cloud/app/lia-inner-world.tsx',import.meta.url),'utf8');
 assert.match(view,/Ejecuciones registradas/);
 assert.match(view,/Hipótesis: no registrada/);
 assert.match(view,/Revisión: no registrada/);
});
