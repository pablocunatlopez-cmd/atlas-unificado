import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAgentResearch,createAgentResearch} from './agent-research.mjs';

const NOW=Date.parse('2026-11-03T12:00:00Z');
function repo(owner,name,description='Coding agent for local models'){
 const full=owner+'/'+name,at='2026-11-01T10:00:00Z';
 return {url:'https://github.com/'+full,owner,repo:name,description,verificationStatus:'verified',metadataVerifiedAt:at,verifiedLicense:'MIT',licenseVerification:{sourceUrl:'https://api.github.com/repos/'+full,verifiedAt:at},metadata:{fullName:full,htmlUrl:'https://github.com/'+full,archived:false,disabled:false,stars:10,pushedAt:'2026-10-15T00:00:00Z',license:{spdxId:'MIT'}}};
}

test('ranking explains local relevance, freshness and reported licence without using stars as quality',()=>{
 const local=repo('example','local-coding-agent'),remote=repo('example','remote-agent','Agent framework');remote.metadata.stars=999999;
 const result=buildAgentResearch({repositories:[remote,local],now:NOW});
 assert.equal(result.candidates[0].repository,'example/local-coding-agent');assert.equal(result.candidates[1].metadata.stars,999999);
 assert.equal(result.candidates[0].rank.measuredQuality,false);assert.ok(result.candidates[0].rank.reasons.includes('local-model-relevance'));assert.ok(result.candidates[0].rank.reasons.includes('recent-activity-metadata'));assert.ok(result.candidates[0].rank.reasons.includes('license-metadata-available'));
 assert.deepEqual(result.candidates[0].metadata.license,{spdxId:'MIT',sourceUrl:'https://api.github.com/repos/example/local-coding-agent',at:'2026-11-01T10:00:00.000Z',verification:'github-rest-metadata'});
 assert.match(result.scope,/estrellas no prueban calidad/);assert.equal(result.candidates[0].evaluation,'reference-only');assert.equal(result.candidates[0].executionVerified,false);
});

test('only canonical public GitHub repository identities survive; archived and disabled entries are excluded',()=>{
 const invalid=['http://github.com/example/agent','https://github.com.evil.invalid/example/agent','https://user:secret@github.com/example/agent','https://github.com/example/agent?token=secret','https://github.com/example/agent#secret','https://github.com/example/agent/tree/main','https://github.com/example/agent.git','https://127.0.0.1/example/agent','https://github.com/example/a%2fb','https://github.com/-example/agent'];
 const records=invalid.map(url=>({...repo('example','agent'),url}));records.push({...repo('example','agent'),metadata:{archived:true}},{...repo('example','other-agent'),metadata:{disabled:true}},{...repo('example','private-agent'),metadata:{private:true}},{...repo('example','private-row-agent'),private:true},{...repo('example','mismatch-agent'),metadata:{fullName:'other/agent'}},{...repo('example','owner-agent'),owner:'other'});
 assert.deepEqual(buildAgentResearch({repositories:records,now:NOW}).candidates,[]);
});

test('free text, unknown providers, URL secrets and unverified licence claims never enter the snapshot',()=>{
 const record=repo('example','claude-agent');record.description='Claude coding agent. SECRET-PRIVATE-DESCRIPTION';record.rawClaims='SECRET-RAW-CLAIMS';record.extra='SECRET-EXTRA';record.licenseClaim='MIT SECRET-LICENCE';record.licenseVerification.sourceUrl='https://api.github.com/repos/example/claude-agent?token=SECRET-QUERY';
 const result=buildAgentResearch({repositories:[record],collaborators:{claude:{installed:true,ready:true,model:'SECRET-MODEL'},aider:{installed:true,ready:true,busy:true,inferenceVerified:true,secret:'SECRET-PROVIDER'}},now:NOW});
 assert.doesNotMatch(JSON.stringify(result),/SECRET/);assert.equal(result.candidates[0].metadata.license,null);
 assert.deepEqual(result.localCollaborators.map(item=>item.id),['native','aider','smolagents']);assert.equal(result.localCollaborators[1].ready,true);assert.equal(result.localCollaborators[1].model,'Qwen local');assert.equal(result.localCollaborators[0].installed,false);
 assert.deepEqual(result.externalModels.claude,{connected:false,requiresOwnAuthentication:true,sdkIsModelAccess:false});
});

test('GitHub search licence metadata keeps source and date while arbitrary or unsupported identifiers stay unknown',()=>{
 const record=repo('example','agent');delete record.licenseVerification;delete record.metadataVerifiedAt;delete record.verifiedLicense;record.verificationStatus='pending';record.evidence='C';record.searchSource={url:'https://api.github.com/search/repositories?q=SECRET-QUERY',at:'2026-11-02T00:00:00Z'};
 let result=buildAgentResearch({repositories:[record],now:NOW});assert.equal(result.candidates[0].metadata.license.verification,'github-search-metadata');assert.equal(result.candidates[0].metadata.license.sourceUrl,'https://api.github.com/search/repositories');assert.doesNotMatch(JSON.stringify(result),/SECRET/);
 for(const value of ['NOASSERTION','UNKNOWN','LicenseRef-private','SECRET-UNKNOWN-LICENCE']){record.metadata.license.spdxId=value;result=buildAgentResearch({repositories:[record],now:NOW});assert.equal(result.candidates[0].metadata.license,null);}
});

test('the pure snapshot bounds inputs, removes duplicate repositories and uses only observed dates',()=>{
 const records=Array.from({length:130},(_,i)=>repo('example','agent-'+String(i).padStart(3,'0'))),dup=repo('EXAMPLE','AGENT-001');dup.metadata.stars=999;records[2]=dup;records[3].metadata.pushedAt='2099-01-01T00:00:00Z';
 const result=buildAgentResearch({repositories:records,now:NOW});assert.equal(result.candidates.length,6);assert.equal(new Set(result.candidates.map(item=>item.url)).size,result.candidates.length);assert.ok(result.candidates.every(item=>!item.repository.endsWith('agent-129')));
 const future=buildAgentResearch({repositories:[records[3]],now:NOW});assert.equal(future.candidates[0].metadata.lastPushAt,null);assert.ok(!future.candidates[0].rank.reasons.includes('recent-activity-metadata'));assert.throws(()=>buildAgentResearch({now:NaN}),/reloj/);
 const missing=repo('example','agent');delete missing.metadataVerifiedAt;delete missing.licenseVerification;missing.metadata.stars=1;
 const observed=structuredClone(missing);observed.metadataVerifiedAt='2026-11-01T10:00:00Z';observed.metadata.stars=2;
 assert.equal(buildAgentResearch({repositories:[missing,observed],now:NOW}).candidates[0].metadata.stars,2);
});

test('the callback reads exactly three fixed bounded local queries and status, never a caller question',async()=>{
 const calls=[];let statusCalls=0;
 const research=createAgentResearch({now:()=>NOW,listRepositories:async(options,extra)=>{calls.push({options,extraKeys:Object.keys(extra)});return {items:[repo('example','agent')]};},getCollaborators:async()=>{statusCalls++;return {native:{installed:true,ready:true,inferenceVerified:true},smolagents:{installed:false,ready:true}};}});
 const result=await research({question:'SECRET-PRIVATE-QUESTION',url:'https://private.invalid/SECRET'});
 assert.deepEqual(calls.map(call=>call.options),['agent','claude','coding'].map(query=>({query,limit:40,offset:0})));assert.ok(calls.every(call=>call.extraKeys.join(',')==='signal'));assert.equal(statusCalls,1);assert.equal(result.status,'ready');assert.equal(result.candidates.length,1);assert.doesNotMatch(JSON.stringify(calls)+JSON.stringify(result),/SECRET/);assert.equal(result.localCollaborators[0].inferenceVerified,true);assert.equal(result.localCollaborators[2].ready,false);
});

test('reader failures are closed partial/unavailable states and cancellation propagates without extra reads',async()=>{
 const unavailable=createAgentResearch({listRepositories:async()=>{throw Error('SECRET-ERROR');},getCollaborators:async()=>{throw Error('SECRET-CREDENTIAL');},now:()=>NOW});
 const result=await unavailable();assert.equal(result.status,'unavailable');assert.equal(result.candidates.length,0);assert.doesNotMatch(JSON.stringify(result),/SECRET/);
 const partial=createAgentResearch({listRepositories:async()=>({items:[]}),getCollaborators:async()=>{throw Error('unavailable');},now:()=>NOW});assert.equal((await partial()).status,'partial');
 let reads=0;const controller=new AbortController(),reason=Error('stop research');const cancelled=createAgentResearch({listRepositories:async()=>{reads++;controller.abort(reason);throw reason;},getCollaborators:async()=>{throw Error('must not read');},now:()=>NOW});
 await assert.rejects(cancelled({signal:controller.signal}),error=>error===reason);assert.equal(reads,1);await assert.rejects(cancelled({signal:controller.signal}),error=>error===reason);assert.equal(reads,1);
});
