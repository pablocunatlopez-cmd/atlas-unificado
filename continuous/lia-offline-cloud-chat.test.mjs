import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('cloud offline mode uses the real authenticated Atlas Core route without pretending to invoke Qwen',()=>{
 const ui=readFileSync(new URL('../cloud/app/cloud-chat.tsx',import.meta.url),'utf8');
 const route=readFileSync(new URL('../cloud/app/api/chat/route.ts',import.meta.url),'utf8');
 assert.match(ui,/async function sendOffline\(\)/);
 assert.match(ui,/readJson<\{reply:\{answer:string;engine:string\}\}>\('\/api\/chat'/);
 assert.match(ui,/engine:'native',web:false/);
 assert.match(ui,/sin Qwen local/);
 assert.match(ui,/no se guarda en el historial/);
 assert.match(route,/getChatGPTUser\(\)/);
 assert.match(route,/makeReply\(/);
});
