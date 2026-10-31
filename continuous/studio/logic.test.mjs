import test from 'node:test';import assert from 'node:assert/strict';import {initial,step,free,targets} from './logic.mjs';
test('las paredes y los límites bloquean el movimiento',()=>{assert.equal(free(-8,0),false);assert.equal(free(25,0),false);let s={...initial(),x:-11.1,z:0};let n=step(s,{right:true},.05);assert.equal(n.x,s.x);});
test('recoger un objetivo no lo duplica',()=>{let s={...initial(),...targets[0]};s=step(s,{},.01);s=step(s,{},.01);assert.deepEqual(s.collected,[0]);});
test('el portal solo permite ganar con todos los objetivos',()=>{assert.equal(step({...initial(),z:-22},{},.01).won,false);assert.equal(step({...initial(),z:-22,collected:[0,1,2,3,4]},{},.01).won,true);});
test('la diagonal no corre más y el tiempo de un frame queda limitado',()=>{const s=initial(),a=step(s,{up:true},.05),b=step(s,{up:true,right:true},8);assert.ok(Math.abs(Math.hypot(b.x-s.x,b.z-s.z)-Math.abs(a.z-s.z))<1e-8);assert.equal(b.time,.05);});
