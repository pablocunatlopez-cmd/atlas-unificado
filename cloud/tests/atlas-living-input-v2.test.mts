import test from 'node:test';
import assert from 'node:assert/strict';
import {livingBuildInput} from '../lib/evolution/living-policy.ts';
import {livingBudget} from '../lib/evolution/living-tools.mjs';

test('new build modes and styles are explicit strings without JSON coercion',()=>{
 for(const mode of ['auto','experiment','design-kit'])assert.equal(livingBuildInput({requestId:'mode-'+mode,mode}).mode,mode);
 for(const style of ['gallery','observatory','garden','arcade'])assert.equal(livingBuildInput({requestId:'style-'+style,mode:'design-kit',style}).style,style);
 for(const value of [['experiment'],['auto'],[],{},null,1,true])assert.throws(()=>livingBuildInput({requestId:'bad-mode',mode:value}),/INPUT/);
 for(const value of [['garden'],['arcade'],[],{},null,1,true])assert.throws(()=>livingBuildInput({requestId:'bad-style',style:value}),/INPUT/);
});

test('a provider pause cannot extend yesterday quota into the next UTC budget',()=>{
 const at=Date.parse('2026-11-11T23:55:00Z'),tomorrow=Date.parse('2026-11-12T00:00:00Z');
 const row={day:'2026-11-11',requests:12,blocked_until:tomorrow+3600000};
 assert.equal(livingBudget(row,at).nextAvailableAt,new Date(tomorrow).toISOString());
 assert.equal(livingBudget(row,tomorrow).backgroundAvailable,true);
 assert.equal(livingBudget({...row,blocked_until:at+60000},at).nextAvailableAt,new Date(at+60000).toISOString());
});
