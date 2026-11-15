import test from 'node:test';
import assert from 'node:assert/strict';
import {coachingCases,gradeCoaching,compareCoaching,coachingDue,weakestDomain,DOMAINS,COACH_VERSION} from '../lib/evolution/coaching.ts';
const cases=coachingCases(1234);
const output=(omit:string[]=[])=>({answers:cases.filter(c=>!omit.includes(c.id)).map(c=>({id:c.id,value:c.expected}))});
test('coaching samples all domains with disjoint development and held-out cases',()=>{
 assert.equal(new Set(cases.map(c=>c.id)).size,8);
 for(const d of DOMAINS){assert.equal(cases.filter(c=>c.domain===d&&c.split==='development').length,1);assert.equal(cases.filter(c=>c.domain===d&&c.split==='heldout').length,1);}
 assert.notDeepEqual(coachingCases(1234),coachingCases(1235));
 assert.equal(gradeCoaching(cases,output()).passed,8);
});
test('only improvement on both splits without any regression can be promoted',()=>{
 const baseline=gradeCoaching(cases,output(['r-dev','r-test'])),improved=gradeCoaching(cases,output());
 assert.deepEqual(compareCoaching(baseline,improved),{promoted:true,regression:false});
 assert.equal(compareCoaching(baseline,gradeCoaching(cases,output(['r-test']))).promoted,false);
 assert.equal(compareCoaching(baseline,gradeCoaching(cases,output(['p-test']))).promoted,false);
 assert.equal(compareCoaching(improved,improved).promoted,false);
 assert.equal(weakestDomain(baseline),'reasoning');
});
test('missing, duplicated and invented answers never pass a case',()=>{
 assert.equal(gradeCoaching(cases,null).passed,0);
 const duplicate=output();duplicate.answers.push(duplicate.answers[0]);assert.equal(gradeCoaching(cases,duplicate).passed,7);
 assert.equal(gradeCoaching(cases,{answers:cases.map(c=>({id:c.id,value:42}))}).passed,0);
});
test('exact numeric answers and their string representation receive the same grade',()=>{
 const value=output();for(const answer of value.answers)if(/^-?\d+$/.test(answer.value))answer.value=Number(answer.value) as any;
 assert.equal(gradeCoaching(cases,value).passed,8);
 assert.equal(gradeCoaching(cases,{answers:cases.map(c=>({id:c.id,value:NaN}))}).passed,0);
});
test('the schedule does not rerun an evaluation until its persisted due time',()=>{
 const state={nextAttemptAt:'2026-11-12T10:00:00Z',lastTrial:{version:COACH_VERSION}} as any;
 assert.equal(coachingDue(undefined),true);
 assert.equal(coachingDue(state,Date.parse('2026-11-12T09:59:59Z')),false);
 assert.equal(coachingDue(state,Date.parse(state.nextAttemptAt)),true);
});
test('existing daily evaluation state adopts the eight-hour cadence while quota cooldown stays intact',()=>{
 const state={nextAttemptAt:'2026-11-12T10:00:00Z',lastAttemptAt:'2026-11-11T10:00:00Z',lastTrial:{version:COACH_VERSION,status:'completed'}} as any;
 assert.equal(coachingDue(state,Date.parse('2026-11-11T17:59:59Z')),false);
 assert.equal(coachingDue(state,Date.parse('2026-11-11T18:00:00Z')),true);
 state.lastTrial.status='unavailable';state.nextAttemptAt='2026-11-11T11:00:00Z';
 assert.equal(coachingDue(state,Date.parse('2026-11-11T10:30:00Z')),false);
});
