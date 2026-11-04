import test from 'node:test';
import assert from 'node:assert/strict';
import {chat} from './chat.mjs';
const runtime={cognitiveCore:{decide:async()=>({review:false})}};
const input={messages:[{role:'user',content:'¿Cuál es el motor Q594 actual?'}]};
const docs=[{role:'reference',url:'https://example.org/old',canonicalId:'motor-q594',version:1,text:'Q594 Q594 Q594 motor Brisa'},{role:'reference',url:'https://example.org/new',canonicalId:'motor-q594',version:2,text:'Q594 motor Órbita',fetchedAt:'2026-11-04T00:00:00Z'}];
function modelReply(content,onRequest=()=>{}){return async(_url,options)=>{onRequest(JSON.parse(options.body));return Response.json({choices:[{message:{content}}]});};}

test('ten checks and trusted version filtering reach the prompt before generation with source labels',async()=>{
 let report,request;
 const result=await chat(input,docs,modelReply('Órbita [F1].',body=>request=body),'','',null,'',[],'',{...runtime,onSpecialistReview:value=>report=value});
 assert.equal(report.executedChecks,10);assert.equal(report.modelCalls,0);assert.equal(result.sources.length,1);assert.equal(result.sources[0].version,2);assert.equal(result.sources[0].citationLabel,'F1');
 assert.match(request.messages[0].content,/REVISIÓN LOCAL DE DIEZ/);assert.match(request.messages[0].content,/Órbita/);assert.doesNotMatch(request.messages[0].content,/Brisa/);
 assert.deepEqual(result.citationAudit.referencedLabels,['F1']);assert.equal(result.citationAudit.semanticSupportVerified,false);assert.equal(result.specialistConsultation.status,'not-requested');
});
test('Qwen uses selected perspectives in the existing review, without ten extra inference calls',async()=>{
 let calls=0,last;
 const result=await chat({messages:[{role:'user',content:'Revisa este código Python'}],refute:true},[],modelReply('Revisión entregada.',body=>{calls++;last=body;}),'','',null,'',[],'',runtime);
 assert.equal(calls,2);assert.equal(result.specialistConsultation.status,'completed');assert.deepEqual(result.specialistConsultation.roles,['programming','evaluation']);
 assert.match(last.messages.at(-1).content,/Perspectivas locales/);assert.match(last.messages.at(-1).content,/programming/);assert.equal(result.specialistConsultation.independentModels,0);
});
test('shared prompts exclude all accidentally supplied owner memory channels',async()=>{
 let request;
 const secret='OWNER_ONLY_SENTINEL';
 const result=await chat(input,docs,modelReply('No consta.',body=>request=body),'','',null,secret,[{question:'Q594 actual motor',critique:'Q594 '+secret}],secret,{...runtime,sharedSession:true,importedMemory:[{excerpt:secret}],repositoryNotes:[{text:secret}]});
 assert.doesNotMatch(JSON.stringify(request),new RegExp(secret));assert.deepEqual(result.sources,[]);assert.equal(result.reflectionMemoryUsed,0);assert.equal(result.specialists.scope,'shared');
});
test('unknown citation IDs are flagged and a failed model review is not recorded as completed',async()=>{
 let calls=0;
 const result=await chat({...input,refute:true},docs,async()=>{if(++calls>1)throw Error('review unavailable');return Response.json({choices:[{message:{content:'Dato [F99].'}}]});},'','',null,'',[],'',runtime);
 assert.equal(result.specialistConsultation.status,'failed');assert.equal(result.reviewed,false);assert.deepEqual(result.citationAudit.unknownLabels,['F99']);assert.ok(result.warnings.some(value=>value.includes('F99')));
});
test('unsafe web-source metadata is removed before the model and cannot become a read or a citation',async()=>{
 let request;
 const result=await chat({...input,internet:true},[],modelReply('No consta en las fuentes.',body=>request=body),'','',null,'',[],'',{...runtime,lookupEvidence:async()=>({sources:[{url:'https://example.org/doc?token=WEB_SENTINEL',excerpt:'unsafe',citation:{url:'https://example.org/other'}}],errors:[]})});
 assert.deepEqual(result.sources,[]);assert.equal(result.webRead,false);assert.doesNotMatch(JSON.stringify(request),/WEB_SENTINEL|example\.org\/other/);
});
