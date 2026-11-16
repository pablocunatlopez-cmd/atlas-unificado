import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyLiaChatSources} from './lia-chat-provenance.mjs';
test('retrieval provenance remains non-authoritative and does not leak content',()=>{
 const sources=[{title:'private',content:'SECRET',url:'file:///private'},
  {title:'web',content:'PRIVATE',url:'https://example.org/article'}];
 const result=classifyLiaChatSources({sources,webRead:true});
 assert.deepEqual(result.items.map(x=>x.component),['Atlas','Ion']);
 assert.equal(result.items[0].evidenceVerified,false);
 assert.equal(result.items[1].provenance,'retrieved_web_unverified');
 assert.ok(!JSON.stringify(result).includes('SECRET'));
 assert.ok(!JSON.stringify(result).includes('PRIVATE'));
 assert.equal(result.unknownComponent,'Constelación');
 assert.equal(result.truthVerified,false);
});
test('unread web references do not become Ion observations',()=>{
 const result=classifyLiaChatSources({sources:[{url:'https://example.org'}],webRead:false,sharedSession:true});
 assert.equal(result.items[0].component,'Atlas');
 assert.equal(result.items[0].privateScope,'shared_isolated');
 assert.throws(()=>classifyLiaChatSources({sources:Array(17).fill({})}));
});
test('local chat includes the source contract without changing retrieval',()=>{
 const source=readFileSync(new URL('./chat.mjs',import.meta.url),'utf8');
 assert.match(source,/classifyLiaChatSources\(\{sources,webRead,sharedSession:/);
 assert.match(source,/LÍA — PROVENIENCIA DE FUENTES/);
 assert.match(source,/liaProvenance,model:CHAT_MODEL/);
 assert.match(source,/searchDocuments\(/);
});
