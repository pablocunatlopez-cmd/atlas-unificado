import {test} from 'node:test';import assert from 'node:assert/strict';import {sanitizeProcessTelemetry,sanitizeAgentResearchStatus} from './process-telemetry.mjs';

test('MCP connectivity survives repeated whitelists without publishing queries, URLs or session tokens',()=>{const raw={publicDocs:{serverId:'openai-docs',readOnly:true,connected:true,searchAvailable:true,checkedAt:'2026-11-01T20:00:00Z',tools:[{name:'search_openai_docs'}],query:'private text',session:'secret',endpoint:'private-url'}};const first=sanitizeProcessTelemetry(raw);assert.equal(first.publicDocs.toolCount,1);assert.equal(first.publicDocs.searchAvailable,true);assert.deepEqual(sanitizeProcessTelemetry(first).publicDocs,first.publicDocs);assert.doesNotMatch(JSON.stringify(first),/private|secret/);});
test('public process telemetry never forwards user labels, prompts, paths, secrets or candidate code',()=>{const value=sanitizeProcessTelemetry({at:'2026-10-31T12:00:00Z',processes:[{id:'research',label:'private prompt',room:'private-path',state:'running',phase:'observe',counters:{observations:22,secret:'key'},source:'private.doc'},{id:'untrusted',state:'running'}],core:{generation:2,version:'policy-v2',code:'arbitrary',qwenWeightsChanged:true},token:'key'});assert.equal(value.processes.length,1);assert.equal(value.processes[0].label,'Observación de fuentes');assert.equal(value.processes[0].counters.observations,22);assert.equal(value.core.qwenWeightsChanged,false);assert.doesNotMatch(JSON.stringify(value),/private|arbitrary|key/);});
test('unknown states and non-finite metrics cannot animate or count as an improvement',()=>{const value=sanitizeProcessTelemetry({processes:[{id:'core',state:'imaginary'},{id:'lor',state:'failed',counters:{accepted:Infinity,rejected:-1}}],lor:{verdict:'REFUTED',baseline:.7,score:.6,delta:-.1,negativeControlDelta:NaN}});assert.equal(value.processes.length,1);assert.deepEqual(value.processes[0].counters,{});assert.equal(value.lor.delta,-.1);assert.equal(value.lor.negativeControlDelta,null);});
test('executed-agent latency survives the PC and cloud whitelists without forwarding raw records',()=>{const raw={agents:{aider:{installed:true,ready:true,inferenceVerified:true,attempts:1,passed:1,totalMs:23615,source:'private-file'},native:{ready:true}}};const first=sanitizeProcessTelemetry(raw),second=sanitizeProcessTelemetry(first);assert.deepEqual(second.agents,first.agents);assert.equal(second.agents.aider.meanMs,23615);assert.doesNotMatch(JSON.stringify(second),/private-file/);});

const researchCandidate=(name='local-agent')=>({repository:'example/'+name,url:'https://github.com/example/'+name,rank:{score:19,reasons:['coding-agent-relevance','local-model-relevance','recent-activity-metadata','license-metadata-available','SECRET-REASON'],measuredQuality:true},metadata:{lastPushAt:'2026-11-01T10:00:00Z',observedAt:'2026-11-02T10:00:00Z',stars:99999,license:{spdxId:'MIT',verification:'github-rest-metadata',sourceUrl:'https://private.invalid/SECRET-LICENSE',at:'SECRET-DATE'},description:'SECRET-METADATA'},description:'SECRET-DESCRIPTION',question:'SECRET-QUESTION',path:'SECRET-PATH',executionVerified:true});
const researchSnapshot=candidates=>({version:1,status:'ready',at:'2026-11-03T10:00:00Z',candidates,localCollaborators:[{id:'SECRET-LOCAL'}],externalModels:{claude:{connected:true,token:'SECRET-TOKEN'}},error:'SECRET-ERROR',candidateCount:9999});

test('public repository research has a closed projection, finite ranking and metadata-only provenance across repeated sanitization',()=>{
 const raw=researchSnapshot([researchCandidate()]),before=structuredClone(raw),value=sanitizeAgentResearchStatus(raw);
 assert.equal(value.candidateCount,1);assert.equal(value.candidates[0].rank.measuredQuality,false);assert.equal(value.executionVerified,false);assert.equal(value.claudeConnected,false);assert.equal(value.basis,'public-repository-metadata');
 assert.deepEqual(Object.keys(value).sort(),['at','basis','candidateCount','candidates','claudeConnected','executionVerified','status']);
 assert.deepEqual(Object.keys(value.candidates[0]).sort(),['metadata','rank','repository','url']);
 assert.deepEqual(value.candidates[0].metadata.license,{spdxId:'MIT',verification:'github-rest-metadata'});
 assert.deepEqual(value.candidates[0].rank.reasons,['coding-agent-relevance','local-model-relevance','recent-activity-metadata','license-metadata-available']);
 assert.deepEqual(sanitizeAgentResearchStatus(value),value);assert.deepEqual(sanitizeProcessTelemetry(sanitizeProcessTelemetry({research:raw})).research,value);assert.deepEqual(raw,before);assert.doesNotMatch(JSON.stringify(value),/SECRET|stars|sourceUrl|question|path/);
});

test('research rejects private repositories, mismatched identities and noncanonical GitHub links instead of stripping their private markers',()=>{
 const invalid=['http://github.com/example/agent','https://github.com.evil.invalid/example/agent','https://user:SECRET@github.com/example/agent','https://github.com:443/example/agent','https://github.com/example/agent?token=SECRET','https://github.com/example/agent#SECRET','https://github.com/example/agent/tree/main','https://github.com/example/a%2fb','https://github.com/example/a/../agent','https://github.com/example/agent.git','https://github.com/-example/agent'];
 const rows=invalid.map(url=>({...researchCandidate('agent'),url}));
 rows.push({...researchCandidate('private-row'),private:true},{...researchCandidate('private-metadata'),metadata:{private:true}},{...researchCandidate('private-visibility'),metadata:{visibility:'private'}},{...researchCandidate('mismatch'),repository:'other/repository'});
 assert.deepEqual(sanitizeAgentResearchStatus(researchSnapshot(rows)).candidates,[]);
 const source=researchCandidate();source.repository='EXAMPLE/LOCAL-AGENT';source.url='https://github.com/EXAMPLE/LOCAL-AGENT/';
 assert.equal(sanitizeAgentResearchStatus(researchSnapshot([source])).candidates[0].url,'https://github.com/example/local-agent');
});

test('research limits unique candidates and reasons, rejects invalid scores and retains only recognised licence metadata',()=>{
 const first=researchCandidate('agent-0'),duplicate=structuredClone(first);
 const rows=[first,duplicate,...Array.from({length:20},(_,i)=>researchCandidate('agent-'+(i+1)))];
 const value=sanitizeAgentResearchStatus(researchSnapshot(rows));assert.equal(value.candidateCount,6);assert.equal(new Set(value.candidates.map(item=>item.repository)).size,6);
 for(const score of [NaN,Infinity,-1,31,'19']){const row=researchCandidate();row.rank.score=score;assert.equal(sanitizeAgentResearchStatus(researchSnapshot([row])).candidateCount,0);}
 for(const spdxId of ['NOASSERTION','LicenseRef-private','SECRET-LICENSE']){const row=researchCandidate();row.metadata.license.spdxId=spdxId;assert.equal(Object.hasOwn(sanitizeAgentResearchStatus(researchSnapshot([row])).candidates[0].metadata,'license'),false);}
 const search=researchCandidate();search.rank.reasons=Array(20).fill('local-model-relevance');search.metadata.license.verification='github-search-metadata';search.metadata.lastPushAt='2099-01-01T00:00:00Z';
 const clean=sanitizeAgentResearchStatus(researchSnapshot([search])).candidates[0];assert.deepEqual(clean.rank.reasons,['local-model-relevance']);assert.equal(clean.metadata.lastPushAt,null);assert.equal(clean.metadata.license.verification,'github-search-metadata');
 for(const status of ['ready','partial','unavailable'])assert.equal(sanitizeAgentResearchStatus({...researchSnapshot([]),status}).status,status);
 for(const bad of [{...researchSnapshot([]),version:2},{...researchSnapshot([]),status:'SECRET-STATUS'},{...researchSnapshot([]),at:'SECRET-DATE'},{status:'ready',at:'2026-11-03T10:00:00Z',candidates:[]}])assert.equal(sanitizeAgentResearchStatus(bad),null);
});

test('per-task agent selection exposes only builder-contract scope and counts measured canonical task families',()=>{
 const raw={agents:{measurementScope:'builder-contracts',taskMetrics:{'csv-parse':{aider:{attempts:3,passed:2,failed:1,code:'SECRET-CODE'}},'json-patch-apply':{native:{attempts:1,passed:0,failed:1}},'stable-dedupe':{native:{attempts:0,cancelled:5}},'untrusted-family':{native:{attempts:100}},'numeric-statistics':{native:{attempts:Infinity}}},aider:{attempts:3,totalMs:300},selection:'SECRET-SELECTION'}};
 const first=sanitizeProcessTelemetry(raw),second=sanitizeProcessTelemetry(first);assert.equal(first.agents.selectionByTask,true);assert.equal(first.agents.measuredTaskTypes,2);assert.equal(first.agents.scope,'builder-contracts');assert.deepEqual(second.agents,first.agents);assert.doesNotMatch(JSON.stringify(first),/SECRET|taskMetrics|untrusted/);
 const historical=sanitizeProcessTelemetry({agents:{aider:{attempts:100}}});assert.equal(historical.agents.selectionByTask,false);assert.equal(historical.agents.measuredTaskTypes,0);assert.equal(Object.hasOwn(historical.agents,'scope'),false);
 for(const measuredTaskTypes of [-1,9,Infinity,1.5]){const result=sanitizeProcessTelemetry({agents:{selectionByTask:true,scope:'builder-contracts',measuredTaskTypes}});assert.equal(result.agents.selectionByTask,false);assert.equal(result.agents.measuredTaskTypes,0);}
});
