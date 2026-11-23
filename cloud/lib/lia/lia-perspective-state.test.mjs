import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialLiaPerspective,transitionLiaPerspective,liaPerspectiveLevels,LIA_MAX_DEPTH} from './lia-perspective-state.mjs';
test('one identity survives recursive entry and exit',()=>{
 let state=initialLiaPerspective;
 for(let i=0;i<20;i++)state=transitionLiaPerspective(state,{type:'enter'});
 assert.equal(state.depth,LIA_MAX_DEPTH);
 assert.equal(state.identity,'lia');
 assert.equal(liaPerspectiveLevels(state).length,LIA_MAX_DEPTH+1);
 assert.ok(liaPerspectiveLevels(state).every(level=>level.identity==='lia'));
 for(let i=0;i<20;i++)state=transitionLiaPerspective(state,{type:'exit'});
 assert.equal(state.depth,0);
});
test('focus, rotation and reset are deterministic',()=>{
 let state=transitionLiaPerspective(initialLiaPerspective,{type:'focus',focus:'physical'});
 state=transitionLiaPerspective(state,{type:'rotate',degrees:-20});
 assert.equal(state.yaw,340);
 assert.equal(state.focus,'physical');
 assert.equal(transitionLiaPerspective(state,{type:'reset'}).focus,'mental');
 assert.equal(initialLiaPerspective.focus,'mental');
});
test('invalid actions and forged identities fail closed',()=>{
 assert.throws(()=>transitionLiaPerspective(initialLiaPerspective,{type:'focus',focus:'unknown'}));
 assert.throws(()=>transitionLiaPerspective(initialLiaPerspective,{type:'rotate',degrees:Infinity}));
 assert.throws(()=>transitionLiaPerspective({...initialLiaPerspective,identity:'other'},{type:'enter'}));
 assert.throws(()=>transitionLiaPerspective(initialLiaPerspective,{type:'run-robot'}));
});

test('corrupt perspective orientation and mode are rejected',()=>{
 assert.throws(()=>transitionLiaPerspective({...initialLiaPerspective,yaw:Infinity},{type:'enter'}));
 assert.throws(()=>transitionLiaPerspective({...initialLiaPerspective,mode:'robot'},{type:'enter'}));
});
