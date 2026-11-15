import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/atlas-types.ts';
import {stateSchema} from '../lib/atlas-validation.ts';

test('memory scopes survive state validation only when they are known',()=>{
 const state=initialState();
 assert.equal(stateSchema.safeParse(state).success,true);
 const memory=state.memories[0];
 const accepted={...state,memories:[{...memory,scope:'resident:salon-centre'},{...memory,id:'room',scope:'room:music'},{...memory,id:'module',scope:'module:chat'}]};
 assert.equal(stateSchema.safeParse(accepted).success,true);
 for(const scope of ['resident:unknown','room:unknown','module:unknown','resident:salon-centre:extra','GLOBAL']){
  const invalid={...state,memories:[{...memory,scope}]};
  assert.equal(stateSchema.safeParse(invalid).success,false,scope);
 }
});
