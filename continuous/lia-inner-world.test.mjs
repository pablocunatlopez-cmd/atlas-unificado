import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('recursive inner-world UI shares one state and bounds nesting',()=>{
 const source=readFileSync(new URL('../cloud/app/lia-inner-world.tsx',import.meta.url),'utf8');
 assert.match(source,/const MAX_DEPTH=6/);
 assert.match(source,/Math\.min\(MAX_DEPTH,d\+1\)/);
 assert.match(source,/Math\.max\(0,d-1\)/);
 assert.match(source,/useState\(0\)/);
 assert.match(source,/VERTICES\[focus\]/);
 assert.doesNotMatch(source,/fetch\(|new Worker\(|setInterval\(/);
});
test('the world is routed separately without replacing the canonical chat',()=>{
 const page=readFileSync(new URL('../cloud/app/lia-world/page.tsx',import.meta.url),'utf8');
 const chat=readFileSync(new URL('../cloud/app/chat/page.tsx',import.meta.url),'utf8');
 assert.match(page,/LiaInnerWorld/);
 assert.match(chat,/CloudChat/);
});
