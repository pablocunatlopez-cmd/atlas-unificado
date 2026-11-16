import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hybridRerank} from './neural-hybrid-retrieval.mjs';
import {readFileSync} from 'node:fs';
test('hybrid ranking preserves lexical fallback when no neural model is installed',()=>{
 const hits=[{url:'a',score:0.8},{url:'b',score:0.2}];
 assert.deepEqual(hybridRerank(hits,new Map()).map(x=>x.url),['a','b']);
 assert.ok(hybridRerank(hits,new Map()).every(x=>x.rankingMethod==='lexical-only'));
});
test('verified semantic scores can rerank lexical candidates, without hallucinating similarities',()=>{
 const hits=[{url:'a',score:0.6},{url:'b',score:0.5}];
 const ranked=hybridRerank(hits,new Map([['b',1]]),{alpha:0.2});
 assert.equal(ranked[0].url,'b');
 assert.equal(ranked[0].rankingMethod,'lexical+neural');
 assert.throws(()=>hybridRerank(hits,new Map(),{alpha:2}));
});
test('Atlas retrieval accepts optional semantic scores without replacing lexical search',()=>{
 const source=readFileSync(new URL('./engine.mjs',import.meta.url),'utf8');
 assert.match(source,/hybridRerank\(hits,options.semanticScores/);
 assert.match(source,/searchDocuments\(documents,query/);
});
