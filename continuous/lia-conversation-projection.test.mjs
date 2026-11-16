import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectLiaConversation} from './lia-conversation-projection.mjs';
test('canonical chat messages project without pretending to be verified thoughts',()=>{
 const events=projectLiaConversation([
  {id:'a',role:'user',content:'¿Qué sabemos?',createdAt:'2026-11-16T10:00:00Z'},
  {id:'b',role:'assistant',content:'Hipótesis pendiente.',createdAt:'2026-11-16T10:00:01Z'}
 ]);
 assert.equal(events.length,2);
 assert.equal(events[0].vertex,'unknown');
 assert.equal(events[1].vertex,'mental');
 assert.ok(events.every(event=>event.verified===false&&event.provenance==='canonical-chat'));
 assert.equal(events[1].summary,'Hipótesis pendiente.');
});
test('projection limits exposure and rejects invalid records',()=>{
 const messages=Array.from({length:60},(_,i)=>({id:String(i),role:'user',content:'mensaje '+i}));
 assert.equal(projectLiaConversation(messages).length,30);
 assert.equal(projectLiaConversation(messages)[0].id,'30');
 assert.throws(()=>projectLiaConversation([{role:'system',content:'secret'}]));
 assert.throws(()=>projectLiaConversation(messages,{limit:1000}));
});
test('inner world reads authenticated canonical history, never local invented thoughts',()=>{
 const route=readFileSync(new URL('../cloud/app/api/lia-world/conversations/[id]/route.ts',import.meta.url),'utf8');
 const view=readFileSync(new URL('../cloud/app/lia-inner-world.tsx',import.meta.url),'utf8');
 assert.match(route,/cloudUser\(\)/);
 assert.match(route,/store\.conversation\(user\.userId,id\)/);
 assert.match(route,/projectLiaConversation/);
 assert.match(view,/api\/lia-world\/conversations/);
 assert.match(view,/no verificado/);
});
