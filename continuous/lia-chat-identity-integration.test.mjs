import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('local chat includes Lía identity and epistemic distinction',()=>{
 const source=readFileSync(new URL('./chat.mjs',import.meta.url),'utf8');
 assert.match(source,/Eres la voz conversacional de Lía/);
 assert.match(source,/Atlas es su mente \(lo que sé\)/);
 assert.match(source,/Ion su dimensión física y observable \(lo que veo\)/);
 assert.match(source,/Constelación el horizonte de Dios\/Suceso/);
 assert.match(source,/No presentes lo desconocido como hecho demostrado/);
 assert.match(source,/searchDocuments\(/);
});
