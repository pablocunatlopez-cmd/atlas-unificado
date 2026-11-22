import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planErasSceneAudioSync} from './eras-scene-audio-sync.mjs';
test('tracks camera position and only audio-enabled scene entities',()=>{
 const p=planErasSceneAudioSync({camera:{position:[2,3,4]},entities:[
  {id:'tree',position:[1,0,0]},
  {id:'river',position:[5,0,0],audio:{gain:0.6}}]});
 assert.deepEqual(p.listener,[2,3,4]);
 assert.deepEqual(p.emitters,[{id:'river',position:[5,0,0],gain:0.6}]);
 assert.equal(p.rendered,false);
});
test('rejects excessive emitters and malformed coordinates',()=>{
 assert.throws(()=>planErasSceneAudioSync({camera:{position:[0,0,0]},maxEmitters:1,
  entities:[{id:'a',position:[0,0,0],audio:{gain:1}},
   {id:'b',position:[1,0,0],audio:{gain:1}}]}));
 assert.throws(()=>planErasSceneAudioSync({camera:{position:[NaN,0,0]}}));
});
