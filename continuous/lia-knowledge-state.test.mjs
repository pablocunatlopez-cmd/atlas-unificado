import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectLiaKnowledgeState} from './lia-knowledge-state.mjs';
const record=(id,status,evidenceReferences=[],origin='model')=>({id,jobId:'job-1',claim:'Is the reference valid?',status,evidenceReferences,origin});
test('memory is not automatically factual truth',()=>{
 const result=projectLiaKnowledgeState([record('a','supported',[]),record('b','supported',['tool-output:check:1'],'tool')]);
 assert.equal(result.length,1);
 assert.equal(result[0].state,'check-supported');
 assert.equal(result[0].factualAccuracyVerified,false);
});
test('latest recorded hypothesis without a tool check remains unverified',()=>{
 const result=projectLiaKnowledgeState([record('a','supported',['tool-output:check:1'],'tool'),record('b','proposed',[])]);
 assert.equal(result[0].state,'unverified-hypothesis');
 assert.equal(result[0].memoryRecorded,true);
});
test('authenticated endpoint and viewer use read-only knowledge projection',()=>{
 const route=readFileSync(new URL('../cloud/app/api/lia-world/conversations/[id]/route.ts',import.meta.url),'utf8');
 const view=readFileSync(new URL('../cloud/app/lia-inner-world.tsx',import.meta.url),'utf8');
 assert.match(route,/projectLiaKnowledgeState\(hypothesisTimeline\)/);
 assert.match(route,/store\.conversation\(user\.userId,id\)/);
 assert.match(view,/Memoria, comprobaciones e hipótesis/);
 assert.match(view,/setKnowledge\(Array\.isArray\(data\.knowledgeState\)/);
});
