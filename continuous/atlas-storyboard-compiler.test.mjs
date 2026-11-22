import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileAtlasStoryboard} from './atlas-storyboard-compiler.mjs';
test('storyboard has bounded timeline and does not pretend to render video',()=>{
 const s=compileAtlasStoryboard({id:'intro',worldId:'eras-forest',shots:[
  {id:'opening',description:'Establishing shot',durationSeconds:5,camera:'aerial'},
  {id:'close',description:'Character',durationSeconds:3,camera:'close-up'}]});
 assert.equal(s.durationSeconds,8);
 assert.equal(s.rendered,false);
 assert.equal(s.shots[1].camera,'close-up');
});
test('invalid durations, duplicates and cameras fail closed',()=>{
 const base={id:'x',worldId:'w',shots:[{id:'s',description:'Hi',durationSeconds:2}]};
 assert.throws(()=>compileAtlasStoryboard({...base,shots:[base.shots[0],base.shots[0]]}));
 assert.throws(()=>compileAtlasStoryboard({...base,shots:[{...base.shots[0],durationSeconds:31}]}));
 assert.throws(()=>compileAtlasStoryboard({...base,shots:[{...base.shots[0],camera:'arbitrary'}]}));
});
