import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('recursive inner-world UI shares one state and bounds nesting',()=>{
 const source=readFileSync(new URL('../cloud/app/lia-inner-world.tsx',import.meta.url),'utf8');
 assert.match(source,/liaPerspectiveLevels\(perspective\)/);
 assert.match(source,/dispatch\(\{type:'enter'\}\)/);
 assert.match(source,/dispatch\(\{type:'exit'\}\)/);
 assert.match(source,/useState\(initialLiaPerspective\)/);
 assert.match(source,/VERTICES\[focus\]/);
 assert.doesNotMatch(source,/new Worker\(|setInterval\(/);
});
test('the world is routed separately without replacing the canonical chat',()=>{
 const page=readFileSync(new URL('../cloud/app/lia-world/page.tsx',import.meta.url),'utf8');
 const chat=readFileSync(new URL('../cloud/app/chat/page.tsx',import.meta.url),'utf8');
 assert.match(page,/LiaInnerWorld/);
 assert.match(chat,/CloudChat/);
});

test('spatial viewer offers depth, rotation and a genuine static fallback',()=>{
 const source=readFileSync(new URL('../cloud/app/lia-inner-world.tsx',import.meta.url),'utf8');
 assert.match(source,/perspective:900/);
 assert.match(source,/rotateY/);
 assert.match(source,/type:'rotate'/);
 assert.match(source,/immersive\?\x60rotateY/);
 assert.match(source,/aria-label=\{\x60Vista espacial/);
 assert.match(source,/sin WebGL/);
});

test('one reusable avatar represents exterior and interior without independent agents',()=>{
 const avatar=readFileSync(new URL('../cloud/app/lia-avatar.tsx',import.meta.url),'utf8');
 const world=readFileSync(new URL('../cloud/app/lia-inner-world.tsx',import.meta.url),'utf8');
 assert.match(avatar,/export default function LiaAvatar/);
 assert.match(avatar,/mode==='interior'/);
 assert.match(world,/import LiaAvatar from/);
 assert.match(world,/depth===0\?'exterior':'interior'/);
 assert.match(world,/<LiaAvatar/);
 assert.doesNotMatch(avatar,/fetch\(|new Worker\(/);
});
