import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Lía cloud chat renders provenance only when returned by backend',()=>{
 const s=readFileSync(new URL('../cloud/app/cloud-chat.tsx',import.meta.url),'utf8');
 assert.match(s,/liaProvenance\?:LiaProvenance/);
 assert.match(s,/liaProvenance:result\.result\?\.liaProvenance/);
 assert.match(s,/message\.role==='assistant'&&message\.liaProvenance\?/);
 assert.match(s,/Fuentes no verificadas/);
 assert.match(s,/message\.role==='user'\?'Tú':'Lía'/);
});
