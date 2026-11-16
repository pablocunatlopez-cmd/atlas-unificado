import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('canonical Lía conversation is wired to Atlas cloud queue, not Atlas Core fallback',()=>{
 const ui=read('../cloud/app/cloud-chat.tsx');
 const page=read('../cloud/app/chat/page.tsx');
 const legacy=read('../cloud/app/chat/offline/page.tsx');
 assert.match(page,/import CloudChat from '\.\.\/cloud-chat'/);
 assert.match(ui,/\/api\/cloud\/chat/);
 assert.match(ui,/\/api\/cloud\/status/);
 assert.doesNotMatch(ui,/sendOffline|href="\/chat\/offline\/"/);
 assert.match(legacy,/redirect\('\/chat\/'\)/);
});
test('unified chat engine is backed by Atlas conversational pipeline',()=>{
 const chat=read('../continuous/chat.mjs');
 assert.match(chat,/from '\.\/engine\.mjs'/);
 assert.match(chat,/from '\.\/providers\.mjs'/);
 assert.match(chat,/from '\.\/lor-omega\.mjs'/);
 assert.match(chat,/from '\.\/lia-chat-provenance\.mjs'/);
});
