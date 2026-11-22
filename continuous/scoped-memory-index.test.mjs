import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createScopedMemoryIndex} from './scoped-memory-index.mjs';

test('does not leak memories across owners or projects',()=>{
 const index=createScopedMemoryIndex([
  {id:'1',owner:'alice',project:'atlas',kind:'episodic',text:'private alpha'},
  {id:'2',owner:'bob',project:'atlas',kind:'semantic',text:'private beta'},
  {id:'3',owner:'alice',project:'eras',kind:'negative',text:'private gamma'},
 ]);
 assert.deepEqual(index.search({owner:'alice',project:'atlas'}).map(x=>x.id),['1']);
 assert.deepEqual(index.search({owner:'bob',project:'atlas'}).map(x=>x.id),['2']);
 assert.deepEqual(index.search({owner:'alice',project:'eras'}).map(x=>x.id),['3']);
});
test('requires explicit owner and project',()=>{
 const index=createScopedMemoryIndex();
 assert.throws(()=>index.search({owner:'alice'}));
 assert.throws(()=>index.search({project:'atlas'}));
});
test('prevents mutation of stored memory through returned objects',()=>{
 const index=createScopedMemoryIndex([{id:'1',owner:'a',project:'p',kind:'negative',text:'avoid'}]);
 const first=index.search({owner:'a',project:'p'});
 first[0].text='changed';
 assert.equal(index.search({owner:'a',project:'p'})[0].text,'avoid');
});
test('rejects duplicate IDs and unsupported kinds',()=>{
 assert.throws(()=>createScopedMemoryIndex([
  {id:'1',owner:'a',project:'p',kind:'semantic',text:'x'},
  {id:'1',owner:'a',project:'p',kind:'semantic',text:'y'},
 ]));
 assert.throws(()=>createScopedMemoryIndex([{id:'1',owner:'a',project:'p',kind:'secret',text:'x'}]));
});
