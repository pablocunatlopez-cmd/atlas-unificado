import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RESIDENTS} from '../../public/house/residents.js';
import {ROOMS} from '../../public/house/layout.js';
import {MEMORY_MODULES,isMemoryScope,memoryScope,memoryScopeLabel,memoryScopeOptions} from './memory-scopes.mjs';

test('memory scopes are closed to known residents, rooms and modules',()=>{
 assert.equal(isMemoryScope('global'),true);
 assert.equal(isMemoryScope('resident:salon-centre'),true);
 assert.equal(isMemoryScope('room:music'),true);
 assert.equal(isMemoryScope('module:chat'),true);
 for(const value of ['','resident:','resident:unknown','room:unknown','module:unknown','resident:salon-centre:extra','GLOBAL',null,undefined,42]){
  assert.equal(isMemoryScope(value),false,String(value));
 }
 assert.equal(memoryScope('resident:unknown'),'global');
 assert.equal(memoryScope('room:music'),'room:music');
});

test('every implemented resident and room has one labelled option and no duplicate keys',()=>{
 const options=memoryScopeOptions();
 assert.equal(options.length,1+RESIDENTS.length+ROOMS.length+MEMORY_MODULES.length);
 assert.equal(new Set(options.map(option=>option.value)).size,options.length);
 assert.ok(options.every(option=>option.value==='global'||isMemoryScope(option.value)));
 assert.ok(options.every(option=>option.label.trim().length>0));
 assert.match(memoryScopeLabel('resident:salon-centre'),/Lía/);
 assert.match(memoryScopeLabel('room:music'),/música/i);
 assert.equal(memoryScopeLabel('module:workshop'),'Taller');
 assert.equal(memoryScopeLabel('unknown'),'General');
});
