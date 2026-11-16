import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildAtlasRepoMap,selectAtlasRepoContext,stripJsComments,selectAtlasAffectedModules} from './atlas-repo-map.mjs';
test('indexes relative imports and selects dependencies within budget',()=>{
 const map=buildAtlasRepoMap([
  {path:'src/a.mjs',content:"import {x} from './b.mjs'; export const y=x;"},
  {path:'src/b.mjs',content:'export const x=1;'},
  {path:'src/unrelated.mjs',content:'export const z=2;'}
 ]);
 assert.deepEqual(map.files.find(f=>f.path==='src/a.mjs').imports,['src/b.mjs']);
 assert.deepEqual(selectAtlasRepoContext(map,{targets:['src/a.mjs']}).files.map(f=>f.path),['src/a.mjs','src/b.mjs']);
});
test('rejects traversal and duplicate paths',()=>{
 assert.throws(()=>buildAtlasRepoMap([{path:'../x',content:'x'}]));
 assert.throws(()=>buildAtlasRepoMap([{path:'a.mjs',content:'x'},{path:'a.mjs',content:'y'}]));
});
test('honors byte and file budgets',()=>{
 const map=buildAtlasRepoMap([{path:'a.mjs',content:"import './b.mjs';"},{path:'b.mjs',content:'123456789'}]);
 assert.equal(selectAtlasRepoContext(map,{targets:['a.mjs'],maxFiles:1}).files.length,1);
 assert.equal(selectAtlasRepoContext(map,{targets:['a.mjs'],maxBytes:5}).files.length,0);
});
test('ignores imports that only appear inside comments',()=>{
 const map=buildAtlasRepoMap([
  {path:'src/a.mjs',content:"// import {x} from './ghost.mjs';\nimport {y} from './b.mjs';\n/* import './nope.mjs'; */"},
  {path:'src/b.mjs',content:'export const y=1;'},
  {path:'src/ghost.mjs',content:'export const x=0;'},
  {path:'src/nope.mjs',content:'export const n=0;'}
 ]);
 assert.deepEqual(map.files.find(f=>f.path==='src/a.mjs').imports,['src/b.mjs']);
});
test('stripJsComments preserves string contents',()=>{
 const src="const s=\"// not a comment\"; /* block */ import './x.mjs';";
 assert.match(stripJsComments(src),/not a comment/);
 assert.doesNotMatch(stripJsComments(src),/block/);
});
test('selectAtlasAffectedModules walks reverse imports',()=>{
 const map=buildAtlasRepoMap([
  {path:'src/lib.mjs',content:'export const v=1;'},
  {path:'src/a.mjs',content:"import {v} from './lib.mjs';"},
  {path:'src/b.mjs',content:"import {v} from './lib.mjs';"}
 ]);
 const affected=selectAtlasAffectedModules(map,{targets:['src/lib.mjs']}).affected.sort();
 assert.deepEqual(affected,['src/a.mjs','src/b.mjs','src/lib.mjs']);
});
