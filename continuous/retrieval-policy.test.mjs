import test from 'node:test';
import assert from 'node:assert/strict';
import {searchDocuments} from './engine.mjs';
import {publicCitationUrl,retrievalContext,retrievalProvenance} from './retrieval-policy.mjs';

const now='2026-11-04T12:00:00Z';
const document=(id,extra={})=>({url:'https://example.org/'+id,role:'reference',text:'Q594 motor Órbita vigente',...extra});
const search=(documents,options={})=>searchDocuments(documents,'Q594',20,{includeReferences:true,now,...options});

test('legacy sources remain owner-only; shared requires explicit public visibility before ranking',()=>{
 const docs=[document('legacy'),document('public',{visibility:'public'}),document('private',{visibility:'private'}),document('heldout',{role:'validation',visibility:'public'})];
 assert.deepEqual(search(docs).map(x=>x.url).sort(),docs.slice(0,3).map(x=>x.url).sort());
 assert.deepEqual(search(docs,{audience:'shared'}).map(x=>x.url),[docs[1].url]);
});

test('declared owner and subject restrictions cannot be bypassed by public visibility or conflicting ACL fields',()=>{
 const docs=[document('pablo',{ownerId:'pablo',visibility:'public'}),document('one',{access:{visibility:'subjects',subjectIds:['pablo']}}),document('conflict',{visibility:'private',access:{visibility:'public'}}),document('two-lists',{visibility:'public',subjectIds:['pablo'],access:{subjectIds:['other']}}),document('unknown',{access:{write:true}}),document('invalid',{access:{visibility:'subjects',subjectIds:'pablo'}})];
 assert.deepEqual(search(docs),[]);
 assert.deepEqual(search(docs,{subjectId:'pablo'}).map(x=>x.url).sort(),docs.slice(0,2).map(x=>x.url).sort());
 assert.deepEqual(search(docs,{audience:'shared',subjectId:'other'}),[]);
});

test('revocation and text changes are applied on the next query, including a previously cached object',()=>{
 const source=document('mutable',{visibility:'public'}),docs=[source];
 assert.equal(search(docs,{audience:'shared'}).length,1);
 source.visibility='private';assert.deepEqual(search(docs,{audience:'shared'}),[]);
 source.visibility='public';source.text='Otro texto sin el identificador';assert.deepEqual(search(docs,{audience:'shared'}),[]);
 source.text='Q594 recuperado';source.deletedAt=now;assert.deepEqual(search(docs),[]);
});

test('expiry, future effective time, invalid metadata and tombstones are excluded before ranking',()=>{
 const docs=[document('fresh',{validFrom:'2026-11-03T00:00:00Z',validUntil:'2026-11-05T00:00:00Z'}),document('expired',{expiresAt:now}),document('future',{validFrom:'2026-11-05T00:00:00Z'}),document('bad-date',{validUntil:'whenever'}),document('deleted',{deleted:true}),document('tombstone',{tombstone:true}),document('replaced',{supersededBy:'fresh'}),document('historical',{status:'historical'}),document('unknown-status',{status:'surprise'})];
 assert.deepEqual(search(docs).map(x=>x.url),[docs[0].url]);
 assert.deepEqual(search([docs[0]],{now:'2026-11-05T00:00:00Z'}),[]);
});

test('explicit logical versions select the latest current document without treating fetch time as truth',()=>{
 const docs=[document('old',{canonicalId:'Q594-spec',version:1,fetchedAt:'2026-11-04T12:00:00Z',text:'Q594 motor Brisa Q594 Q594'}),document('new',{canonicalId:'Q594-spec',version:'2.0',fetchedAt:'2025-01-01T00:00:00Z'})];
 const result=search(docs);assert.equal(result.length,1);assert.equal(result[0].url,docs[1].url);assert.equal(result[0].version,'2.0');assert.equal(result[0].canonicalId,'Q594-spec');
 assert.equal(result[0].verification,'unverified-source');assert.equal(result[0].citation.verified,false);
});

test('latest revoked or expired version never resurrects an earlier version and future versions wait',()=>{
 const old=document('old',{documentId:'Q594',version:1}),replacement=document('new',{documentId:'Q594',version:2});
 for(const extra of [{deleted:true},{status:'superseded'},{expiresAt:now},{tombstone:true}])assert.deepEqual(search([old,{...replacement,...extra}]),[]);
 assert.deepEqual(search([old,{...replacement,validFrom:'2026-11-05T00:00:00Z'}]).map(x=>x.url),[old.url]);
 assert.deepEqual(search([old,replacement,{...replacement,url:'https://example.org/tombstone',tombstone:true}]),[]);
 assert.deepEqual(search([old,{role:'reference',documentId:'Q594',version:3,tombstone:true}]),[]);
 assert.deepEqual(search([{...old,status:'current'},{role:'reference',documentId:'Q594',tombstone:true}]),[]);
});

test('unversioned conflicts remain unresolved unless one record is explicitly current; unauthorized records do not shadow',()=>{
 const old=document('old',{canonicalId:'Q594'}),current=document('current',{canonicalId:'Q594'});
 assert.deepEqual(search([old,current]),[]);
 assert.deepEqual(search([old,{...current,status:'current'}]).map(x=>x.url),[current.url]);
 const publicSource=document('public',{canonicalId:'Q594',version:1,visibility:'public'}),privateSource=document('private',{canonicalId:'Q594',version:2,visibility:'private'});
 assert.deepEqual(search([publicSource,privateSource],{audience:'shared'}).map(x=>x.url),[publicSource.url]);
});

test('citation links reject executable/local/authenticated targets and retain provenance for canonical local identifiers',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,x','file:///C:/private','http://127.0.0.1/x','http://0x7f000001/x','http://[::1]/x','https://localhost/x','https://internal/x','https://pc.local/x','https://pc.internal/x','https://user:pass@example.org/x','https://example.org/x?token=secret','https://example.org/x?api_key=secret','https://example.org/x?X-Amz-Signature=secret'])assert.equal(publicCitationUrl(url),null,url);
 assert.equal(publicCitationUrl('https://example.org:8443/doc?id=1#part'),'https://example.org:8443/doc?id=1#part');
 const docs=[document('local',{url:'atlas://memory/Q594'}),document('js',{url:'javascript:alert(1)'}),document('data',{url:'data:text/html,Q594'}),document('token',{url:'https://example.org/x?token=secret'}),document('auth',{url:'https://user:pass@example.org/x'})];
 const [source]=search(docs);assert.equal(search(docs).length,1);assert.equal(source.url,'atlas://memory/Q594');assert.equal(source.citation,null);assert.match(source.contentHash,/^[a-f0-9]{64}$/);assert.match(source.sourceId,/^source-[a-f0-9]{20}$/);
 assert.equal(retrievalProvenance(docs[0]).sourceId,source.sourceId);assert.notEqual(retrievalProvenance({...docs[0],text:'contenido distinto'}).sourceId,source.sourceId);
});

test('retrieval options are bounded and an empty query cannot bypass option validation',()=>{
 for(const options of [{audience:'admin'},{subjectId:''},{subjectId:[]},{now:'never'},{now:null},{includeReferences:1},{unknown:true}])assert.throws(()=>search([],options),/Ámbito|Opciones|booleano/);
 assert.equal(retrievalContext({now}).now,Date.parse(now));
 assert.throws(()=>searchDocuments([], '', 5, {audience:'admin'}),/Ámbito/);
});
