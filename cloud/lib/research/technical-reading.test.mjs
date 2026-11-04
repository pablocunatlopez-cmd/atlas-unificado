import test from 'node:test';
import assert from 'node:assert/strict';
import {createTechnicalReading,getTechnicalCatalog,sanitizeTechnicalReading,selectTechnicalDocuments} from './technical-reading.mjs';

const AT=Date.UTC(2026,10,3),SIX_HOURS=6*3600000,HALF_HOUR=30*60000;
const prose='The public documentation describes bounded execution, explicit inputs, validation, and reproducible testing. Each operation preserves its inputs and reports an observable result. ';
const body=(text=prose.repeat(10),type='text/plain')=>new Response(text,{headers:{'content-type':type}});
const nativeHash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),value=>value.toString(16).padStart(2,'0')).join('');

test('catalog is closed, exact, copied and explicitly describes excerpts',()=>{
 const catalog=getTechnicalCatalog();assert.deepEqual(catalog.map(({id,url})=>[id,url]),[
  ['aider-lint','https://aider.chat/docs/usage/lint-test.html'],
  ['smolagents','https://raw.githubusercontent.com/huggingface/smolagents/main/docs/source/en/reference/agents.md'],
  ['claude-sdk','https://raw.githubusercontent.com/anthropics/claude-agent-sdk-python/main/README.md'],
  ['claude-skills','https://raw.githubusercontent.com/anthropics/skills/main/README.md'],
  ['three-box3','https://threejs.org/docs/pages/Box3.html'],
  ['three-instanced','https://threejs.org/docs/pages/InstancedMesh.html'],
  ['csv-rfc','https://www.rfc-editor.org/rfc/rfc4180.html'],
  ['patch-rfc','https://www.rfc-editor.org/rfc/rfc6902.html'],
 ]);assert.ok(catalog.every(item=>item.method==='excerpt'&&item.excerptLimit===1000));
 catalog[0].url='https://evil.invalid/';catalog.pop();assert.equal(getTechnicalCatalog().length,8);assert.equal(getTechnicalCatalog()[0].url,'https://aider.chat/docs/usage/lint-test.html');
});

test('routing uses precise local topics, exact catalog IDs and at most two documents',()=>{
 const cases=[['Aider y smolagents',['aider-lint','smolagents']],['SDK de Claude y skills de Anthropic',['claude-sdk','claude-skills']],['Colisiones 3D con cajas delimitadoras',['three-box3']],['Instancias de mallas en Three.js',['three-instanced']],['JSON Patch y CSV, además de Aider',['patch-rfc','csv-rfc']],['RFC 4180',['csv-rfc']],['RFC6902',['patch-rfc']],['Hola, ¿qué tal? También mi agente local. ',[]],['Claude sin otro tema',[]],['https://evil.invalid/csv?query=smolagents https://aider.chat/docs/usage/lint-test.html',[]]];
 for(const [question,expected]of cases)assert.deepEqual(selectTechnicalDocuments(question),expected,question);
 for(const {id}of getTechnicalCatalog())assert.deepEqual(selectTechnicalDocuments(id),[id]);
 for(const value of [null,{},42])assert.deepEqual(selectTechnicalDocuments(value),[]);
});

test('only fixed URLs leave the reader, without the question, search query or credentials',async()=>{
 const calls=[],read=createTechnicalReading({now:()=>AT,fetch:async(url,options)=>{calls.push([url,options]);return body();}});
 assert.equal(calls.length,0);
 const snapshot=await read('Compara Aider y smolagents para private-project-42, password=private-secret y https://evil.invalid/secret.');
 assert.equal(calls.length,2);assert.deepEqual(calls.map(([url])=>url),getTechnicalCatalog().slice(0,2).map(item=>item.url));
 for(const [url,options]of calls){assert.equal(new URL(url).search,'');assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');assert.equal(options.credentials,'omit');assert.equal(new Headers(options.headers).has('authorization'),false);assert.equal(Object.keys(options.headers).some(key=>/cookie|token|key/i.test(key)),false);}
 assert.doesNotMatch(JSON.stringify(calls),/private-project|private-secret|evil\.invalid/);assert.equal(snapshot.documents.length,2);assert.equal(snapshot.errors.length,0);
 assert.equal((await read('Buenos días.')).documents.length,0);assert.equal(calls.length,2);
});

test('HTML extraction starts at semantic content and strips navigation, scripts and markup',async()=>{
 const html='<head><title>Untrusted title</title></head><nav>secret navigation</nav><main><h1>Header</h1><p>Intro</p><script>steal(credentials)</script><p>Aider can automatically lint &amp; test code. '+prose.repeat(12)+'</p></main><footer>footer marker</footer>';
 const read=createTechnicalReading({now:()=>AT,fetch:async()=>body(html,'text/html; charset=utf-8')});
 const {documents:[document]}=await read('Aider');assert.match(document.excerpt,/^Aider can automatically lint & test code\./);assert.doesNotMatch(document.excerpt,/Header|navigation|steal|footer marker|<[^>]+>/);
 assert.equal(document.excerpt.length,1000);assert.equal(document.chars,1000);assert.equal(document.method,'excerpt');assert.equal(document.truncated,true);assert.equal(document.epistemicStatus,'unverified-source');assert.equal(document.fetchedAt,new Date(AT).toISOString());assert.equal(document.hash,await nativeHash(document.excerpt));
});

test('Three.js semantic headers retain the Box3 and InstancedMesh introductions',async()=>{
 const cases=[['three-box3','Represents an axis-aligned bounding box (AABB) in 3D space.'],['three-instanced','A special version of Mesh with instanced rendering support.']];
 for(const [id,introduction]of cases){
  const html='<header>site chrome outside content</header><nav>navigation links</nav><main><article><header><h1>'+id+'</h1><p>'+introduction+' '+prose+'</p></header><section><h2>Constructor</h2><p>constructor implementation details</p></section></article></main>';
  const read=createTechnicalReading({now:()=>AT,fetch:async()=>body(html,'text/html')}),{documents:[document]}=await read(id);
  assert.ok(document.excerpt.startsWith(introduction));assert.doesNotMatch(document.excerpt,/site chrome|navigation links|<[^>]+>/);assert.equal(document.hash,await nativeHash(document.excerpt));
 }
});

test('Three.js sibling class-description headers survive article extraction',async()=>{
 const cases=[['three-box3','Box3','Represents an axis-aligned bounding box (AABB) in 3D space.'],['three-instanced','InstancedMesh','A special version of Mesh with instanced rendering support.']];
 for(const [id,title,introduction]of cases){
  const html='<html><head><title>'+title+' metadata marker</title></head><body><header>site chrome outside content</header><nav>navigation links</nav><h1>'+title+'</h1><section><header><div class="class-description"><p>'+introduction+'</p><p>'+prose+'</p></div><nav>inner navigation marker</nav></header><article><div class="container-overview"><h2>Constructor</h2><p>constructor implementation details</p></div></article></section><footer>footer marker</footer></body></html>';
  const read=createTechnicalReading({now:()=>AT,fetch:async()=>body(html,'text/html')}),{documents:[document]}=await read(id);
  assert.ok(document.excerpt.startsWith(introduction));assert.match(document.excerpt,/Constructor\nconstructor implementation details/);assert.doesNotMatch(document.excerpt,/site chrome|navigation links|inner navigation marker|footer marker|metadata marker|<[^>]+>/);assert.equal(document.hash,await nativeHash(document.excerpt));
 }
});

test('article extraction keeps only an adjacent semantic header',async()=>{
 const headers=['<header><div class="not-class-description">unrelated header marker</div></header>','<header><div class="class-description">unrelated header marker</div></header><div>separate content marker</div>'];
 for(const header of headers){
  const html='<body><section>'+header+'<article><h2>Constructor</h2><p>'+prose+'</p></article></section></body>';
  const read=createTechnicalReading({now:()=>AT,fetch:async()=>body(html,'text/html')}),{documents:[document]}=await read('three-box3');
  assert.match(document.excerpt,/^Constructor\n/);assert.doesNotMatch(document.excerpt,/unrelated header marker|separate content marker/);
 }
});

test('smolagents reads the bounded official Markdown source and retains agent reference prose',async()=>{
 const calls=[],markdown='# Agents\n\nOur agents inherit from `MultiStepAgent`, which means they can act in multiple steps.\n\n## CodeAgent\n\nThis agent writes Python code to call tools.\n'+prose;
 const read=createTechnicalReading({now:()=>AT,fetch:async url=>{calls.push(url);return body(markdown,'text/plain; charset=utf-8');}}),{documents:[document]}=await read('smolagents');
 assert.deepEqual(calls,['https://raw.githubusercontent.com/huggingface/smolagents/main/docs/source/en/reference/agents.md']);assert.equal(document.url,calls[0]);assert.match(document.excerpt,/^Our agents inherit from `MultiStepAgent`/);assert.match(document.excerpt,/CodeAgent/);assert.equal(document.hash,await nativeHash(document.excerpt));
});

test('RFC anchors skip the table of contents and select the last requested section',async()=>{
 const read=createTechnicalReading({now:()=>AT,fetch:async url=>url.includes('4180')?body('<main>2. Definition of the CSV Format ... table of contents ...\n2. Definition of the CSV Format\nEach CSV record uses fields and quotes. '+prose.repeat(8)+'</main>','text/html'):body('4. Operations ... table of contents ...\n4. Operations\nJSON Patch add, remove and replace preserve their operation order. '+prose.repeat(8))});
 const value=await read('CSV y JSON Patch');assert.equal(value.documents.length,2);
 assert.match(value.documents[0].excerpt,/^2\. Definition of the CSV Format\nEach CSV record/);assert.match(value.documents[1].excerpt,/^4\. Operations\nJSON Patch add/);assert.doesNotMatch(JSON.stringify(value),/table of contents/);
});

test('RFC HTML section-number anchors may introduce whitespace before the heading dot',async()=>{
 const cases=[['csv-rfc','2','Definition of the CSV Format','Each record is located on a separate line, delimited by a line break.'],['patch-rfc','4','Operations','Operation objects MUST have exactly one op member, whose value indicates the operation to perform.']];
 for(const [id,number,title,technical]of cases){
  const html='<html><head><title>RFC metadata</title></head><body><pre>Publication header and table of contents\n<a href="#section-'+number+'">'+number+'</a>. '+title+' ........... page 3</pre><h2><a class="selflink" id="section-'+number+'" href="#section-'+number+'">'+number+'</a>. '+title+'</h2><pre>'+technical+' '+prose.repeat(8)+'</pre></body></html>';
  const read=createTechnicalReading({now:()=>AT,fetch:async()=>body(html,'text/html')}),{documents:[document]}=await read(id);
  assert.match(document.excerpt,new RegExp('^'+number+'\\s*\\.\\s*'+title+'\\n'+technical.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.doesNotMatch(document.excerpt,/Publication header|table of contents|page 3/);assert.equal(document.hash,await nativeHash(document.excerpt));
 }
});

test('Markdown remains readable, credential shapes are removed, and the digest covers exact NFC text',async()=>{
 const secret=('sk-'+'a'.repeat(41)),hfSecret='hf_012345678901234567890123456789';
 const markdown='# Claude Agent SDK for Python\n![badge](https://example.invalid/badge)\n[Cafe\u0301](https://example.invalid/docs) uses '+secret+' and Bearer ABCDEFGHIJKLMNOPQRSTUVXYZ.\napi_key=another-private-key and '+hfSecret+'. '+prose.repeat(8);
 const read=createTechnicalReading({now:()=>AT,fetch:async()=>body(markdown,'text/markdown')});
 const {documents:[document]}=await read('Claude SDK');assert.match(document.excerpt,/Café uses/);assert.doesNotMatch(document.excerpt,/sk-proj-|ABCDEFGHIJKLMNOPQRSTUVXYZ|another-private-key|hf_012345|https:\/\/example/);assert.equal(document.excerpt.length,1000);assert.equal(document.excerpt,document.excerpt.normalize('NFC'));assert.equal(document.hash,await nativeHash(document.excerpt));
 assert.ok(sanitizeTechnicalReading({version:1,at:new Date(AT).toISOString(),documents:[document],errors:[]}));
});

test('excerpt digests agree with independent WebCrypto across SHA blocks and Unicode truncation boundaries',async()=>{
 const inputs=[...[100,119,120,127,128,129,255,256,999,1000].map(size=>'A'.repeat(size)),'Cafe\u0301 🧪 漢字 '.repeat(180),'a'.repeat(999)+'🧪'+prose,'token=abcdefghijklmnopqrstuv '+prose.repeat(8)];
 for(const input of inputs){
  const read=createTechnicalReading({now:()=>AT,fetch:async()=>body(input)}),{documents:[document]}=await read('CSV');
  assert.ok(document.excerpt.length<=1000);assert.equal(document.hash,await nativeHash(document.excerpt));assert.equal(document.excerpt,document.excerpt.normalize('NFC'));assert.doesNotMatch(document.excerpt,/[\uD800-\uDBFF]$/);assert.ok(sanitizeTechnicalReading({version:1,at:new Date(AT).toISOString(),documents:[document],errors:[]}));
 }
});

test('redirects are rejected without following their target and upstream prose is never returned',async()=>{
 const calls=[],read=createTechnicalReading({now:()=>AT,fetch:async(url,options)=>{calls.push(url);assert.equal(options.redirect,'manual');return new Response('private upstream detail',{status:302,headers:{location:'http://127.0.0.1/private'}});}});
 const value=await read('CSV');assert.equal(calls.length,1);assert.deepEqual(value.errors,[{id:'csv-rfc',reason:'redirect-rejected',retryAt:new Date(AT+HALF_HOUR).toISOString()}]);assert.doesNotMatch(JSON.stringify(value),/127\.0\.0\.1|upstream detail/);
});

test('unsupported or missing MIME, HTTP failures and insufficient text have closed error reasons',async()=>{
 const cases=[['application/pdf','unsupported-content'],['application/json','unsupported-content'],['','unsupported-content']];
 for(const [type,reason]of cases){const read=createTechnicalReading({now:()=>AT,fetch:async()=>new Response(prose,{headers:{'content-type':type}})});assert.equal((await read('CSV')).errors[0].reason,reason);}
 for(const [response,reason]of [[new Response('private denied prose',{status:403}),'http-error'],[new Response('private throttling prose',{status:429}),'rate-limited'],[body('short'),'empty-content']]){const read=createTechnicalReading({now:()=>AT,fetch:async()=>response});const snapshot=await read('CSV');assert.equal(snapshot.errors[0].reason,reason);assert.doesNotMatch(JSON.stringify(snapshot),/private denied|private throttling/);}
});

test('both Content-Length and actual streamed bytes enforce the 128 KiB limit',async()=>{
 for(const response of [new Response(prose,{headers:{'content-type':'text/plain','content-length':String(128*1024+1)}}),new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(90000));controller.enqueue(new Uint8Array(50000));controller.close();}}),{headers:{'content-type':'text/plain'}})]){
  const read=createTechnicalReading({now:()=>AT,fetch:async()=>response});assert.equal((await read('CSV')).errors[0].reason,'oversized-response');
 }
 const read=createTechnicalReading({now:()=>AT,fetch:async()=>body('x'.repeat(128*1024))});assert.equal((await read('CSV')).documents[0].chars,1000);
});

test('one global deadline bounds two stalled fetches, even when fetch ignores abort',async()=>{
 let calls=0;const read=createTechnicalReading({now:()=>AT,timeoutMs:8,fetch:async()=>{calls++;return new Promise(()=>{});}}),started=Date.now();
 const value=await read('Aider y smolagents');assert.equal(calls,2);assert.equal(value.errors.length,2);assert.ok(value.errors.every(error=>error.reason==='timeout'));assert.ok(Date.now()-started<1500);
 await read('Aider y smolagents');assert.equal(calls,2);
});

test('the deadline also bounds stalled stream reads and cancels the response reader',async()=>{
 let cancelled=0;const read=createTechnicalReading({now:()=>AT,timeoutMs:8,fetch:async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(prose));},cancel(){cancelled++;}}),{headers:{'content-type':'text/plain'}})}),started=Date.now();
 const value=await read('CSV');assert.equal(value.errors[0].reason,'timeout');assert.ok(Date.now()-started<1500);assert.equal(cancelled,1);
});

test('caller cancellation is propagated and does not negative-cache an abandoned read',async()=>{
 let calls=0,blocked=true;const controller=new AbortController(),read=createTechnicalReading({now:()=>AT,fetch:async()=>{calls++;return blocked?new Promise(()=>{}):body();}});
 const pending=read('CSV',{signal:controller.signal});await Promise.resolve();controller.abort();await assert.rejects(pending,error=>error.name==='AbortError');blocked=false;
 assert.equal((await read('CSV')).documents.length,1);assert.equal(calls,2);
 const preAborted=new AbortController();preAborted.abort();await assert.rejects(read('Aider',{signal:preAborted.signal}),error=>error.name==='AbortError');assert.equal(calls,2);
});

test('concurrent requests own separate I/O and cancelling one cannot cancel another',async()=>{
 let calls=0;const signals=[],read=createTechnicalReading({now:()=>AT,fetch:async(_url,options)=>{calls++;signals.push(options.signal);return calls===1?new Promise(()=>{}):body();}}),controller=new AbortController();
 const first=read('CSV',{signal:controller.signal}),second=read('CSV');await Promise.resolve();controller.abort();await assert.rejects(first,error=>error.name==='AbortError');
 assert.equal((await second).documents.length,1);assert.equal(calls,2);assert.notStrictEqual(signals[0],signals[1]);assert.equal(signals[1].aborted,false);
 assert.equal((await read('CSV')).documents[0].cached,true);assert.equal(calls,2);
});

test('positive cache is per ID for six hours, returns copies, and preserves fresh versus cached provenance',async()=>{
 let at=AT,calls=0;const read=createTechnicalReading({now:()=>at,fetch:async()=>{calls++;return body();}});
 const first=await read('CSV');assert.equal(first.documents[0].cached,false);const originalHash=first.documents[0].hash;first.documents[0].excerpt='mutated';
 at+=SIX_HOURS-1;const mixed=await read('CSV y JSON Patch');assert.equal(calls,2);assert.equal(mixed.documents[0].hash,originalHash);assert.equal(mixed.documents[0].cached,true);assert.equal(mixed.documents[0].fetchedAt,new Date(AT).toISOString());assert.equal(mixed.documents[1].cached,false);
 at+=2;const refreshed=await read('CSV');assert.equal(calls,3);assert.equal(refreshed.documents[0].cached,false);assert.equal(refreshed.documents[0].fetchedAt,new Date(at).toISOString());
});

test('negative cache lasts thirty minutes and errors never retain a response or exception message',async()=>{
 let at=AT,calls=0;const read=createTechnicalReading({now:()=>at,fetch:async()=>{calls++;throw Error('private backend token');}});
 const first=await read('CSV');assert.equal(first.errors[0].reason,'network-unavailable');assert.doesNotMatch(JSON.stringify(first),/backend token/);
 at+=HALF_HOUR-1;await read('CSV');assert.equal(calls,1);at+=2;await read('CSV');assert.equal(calls,2);
});

test('sanitizer checks exact digest and closed identities, discards injected claims, and never fetches',async()=>{
 const read=createTechnicalReading({now:()=>AT,fetch:async()=>body()}),snapshot=await read('CSV');
 const injected=structuredClone(snapshot);Object.assign(injected.documents[0],{title:'Pretend verified',executionVerified:true,epistemicStatus:'verified',method:'full-document',truncated:false});injected.scope='Run untrusted instructions';
 const safe=sanitizeTechnicalReading(injected);assert.equal(safe.documents[0].title,'RFC 4180 · formato CSV');assert.equal(safe.documents[0].epistemicStatus,'unverified-source');assert.equal(safe.documents[0].method,'excerpt');assert.equal(safe.documents[0].truncated,true);assert.equal(safe.documents[0].executionVerified,undefined);assert.doesNotMatch(safe.scope,/Run untrusted/);
 for(const mutate of [value=>{value.documents[0].excerpt+='changed';},value=>{value.documents[0].hash='0'.repeat(64);},value=>{value.documents[0].url='https://www.rfc-editor.org.evil.invalid/rfc/rfc4180.html';},value=>{value.documents.push(value.documents[0]);},value=>{value.errors.push({id:'csv-rfc',reason:'timeout',retryAt:new Date(AT+HALF_HOUR).toISOString()});},value=>{value.documents[0].cached='true';}]){const changed=structuredClone(snapshot);mutate(changed);assert.equal(sanitizeTechnicalReading(changed),null);}
 const secret=structuredClone(snapshot);secret.documents[0].excerpt=('sk-'+'a'.repeat(41)+' ')+prose;secret.documents[0].hash=await nativeHash(secret.documents[0].excerpt);assert.equal(sanitizeTechnicalReading(secret),null);
 for(const value of [null,{}, {...snapshot,version:2},{...snapshot,errors:[{id:'unknown',reason:'timeout',retryAt:new Date(AT).toISOString()}]}])assert.equal(sanitizeTechnicalReading(value),null);
});
