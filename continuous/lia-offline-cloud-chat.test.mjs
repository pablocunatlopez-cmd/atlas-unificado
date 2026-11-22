import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('Lía uses canonical Atlas Unificado chat; deprecated offline path redirects',()=>{
 const main=read('../cloud/app/cloud-chat.tsx');
 const page=read('../cloud/app/chat/offline/page.tsx');
 assert.match(main,/\/api\/cloud\/chat/);
 assert.doesNotMatch(main,/href="\/chat\/offline\/"|sendOffline/);
 assert.match(page,/redirect\('\/chat\/'\)/);
 assert.equal(existsSync(new URL('../cloud/app/chat/offline/offline-chat.tsx',import.meta.url)),false);
});
