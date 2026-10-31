import test from 'node:test';
import assert from 'node:assert/strict';
import {googleBlockReason,parseGoogleResults,createGoogleSearch} from './google-search.mjs';
import {webUrl} from './internet.mjs';
test('Google results retain only public HTTPS heading links, not internal or private targets',()=>{
 const html='<a href="/url?q=https%3A%2F%2Fdeveloper.mozilla.org%2Fdocs&amp;sa=U"><h3>MDN docs</h3></a><a href="https://127.0.0.1/secret"><h3>Private</h3></a><a href="https://www.google.com/search?q=x"><h3>Search</h3></a><a href="https://developer.mozilla.org/docs"><h3>Duplicate</h3></a>';
 const r=parseGoogleResults(html,webUrl);assert.equal(r.length,1);assert.equal(r[0].url,'https://developer.mozilla.org/docs');assert.match(r[0].method,/no leída/);
});
test('consent, captcha and JavaScript screens are never treated as search evidence',()=>{
 assert.match(googleBlockReason('Before you continue to Google'),/consentimiento/);
 assert.match(googleBlockReason('unusual traffic'),/CAPTCHA/);
 assert.match(googleBlockReason('Enable JavaScript'),/JavaScript/);
 assert.equal(googleBlockReason('<h3>Docs</h3>'),null);
});
test('blocked Google calls back off without attempting to solve the challenge',async()=>{
 let calls=0,time=100000;
 const google=createGoogleSearch(async()=>{calls++;return {url:'https://www.google.com/sorry/',text:'unusual traffic'};},webUrl,()=>time);
 assert.deepEqual((await google.search('documentation')).sources,[]);
 await google.search('another question');assert.equal(calls,1);assert.equal(google.status().status,'blocked');
 time+=31*60000;await google.search('retry');assert.equal(calls,2);
});
test('valid results mark Google available; network failure returns explicit fallback reason',async()=>{
 const good=createGoogleSearch(async()=>({url:'https://www.google.com/search',text:'<a href="https://example.org/doc"><h3>Documentation</h3></a>'}),webUrl);
 assert.equal((await good.search('documentation')).sources.length,1);assert.equal(good.status().status,'available');
 const bad=createGoogleSearch(async()=>{throw Error('connect EACCES');},webUrl);
 const r=await bad.search('documentation');assert.equal(r.sources.length,0);assert.match(r.errors[0],/EACCES/);
});
