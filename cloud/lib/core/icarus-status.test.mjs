import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeIcarusStatus} from './icarus-status.mjs';
import {sanitizeExperienceStatus} from './experience-status.mjs';
import {sanitizeProcessTelemetry} from './process-telemetry.mjs';

const at='2026-11-04T07:00:05.000Z',startedAt='2026-11-04T07:00:00.000Z';
const row=(patch={})=>({id:'icarus-1',phase:'returning',processId:'creative',focus:'3d',at,startedAt,sourceCount:3,usedReferenceCount:2,outcome:'sources-observed',...patch});
const snapshot=(patch={})=>({schema:1,active:null,recent:[row()],total:1,completed:1,blocked:0,...patch});

test('Icarus public trips rebuild rooms and retain measured reference use without private material',()=>{
 const value=snapshot({recent:[row({question:'PRIVATE-QUESTION',dialogue:'PRIVATE-DIALOGUE',sourceRoom:'PRIVATE-ROOM',destinationRoom:'PRIVATE-DESTINATION',sources:[{url:'https://private.invalid/PRIVATE-URL'}],code:'PRIVATE-CODE',acceptedChange:true})],token:'PRIVATE-TOKEN'});
 const clean=sanitizeIcarusStatus(value),event=clean.recent[0];
 assert.equal(event.sourceRoom,'games');assert.equal(event.destinationRoom,'constellation');assert.equal(event.sourceCount,3);assert.equal(event.usedReferenceCount,2);
 assert.equal(clean.completed,1);assert.equal(Object.hasOwn(event,'acceptedChange'),false);assert.doesNotMatch(JSON.stringify(clean),/PRIVATE|"(?:question|dialogue|sources|token|code|acceptedChange)":/);
 assert.deepEqual(sanitizeIcarusStatus(clean),clean);
});
test('event IDs, process IDs, phase outcomes and dates are closed and failed consultations do not become returns',()=>{
 for(const patch of [{id:'PRIVATE-ID'},{id:'icarus-0'},{id:'icarus-1000000001'},{processId:'PRIVATE-PROCESS'},{focus:'PRIVATE-FOCUS'},{phase:'teleporting'},{outcome:'omniscient'},{startedAt:'2026-11-04T07:01:00.000Z'},{at:'PRIVATE-DATE'},{sourceCount:0}])assert.deepEqual(sanitizeIcarusStatus(snapshot({recent:[row(patch)]})).recent,[],JSON.stringify(patch));
 const blocked=row({phase:'blocked',sourceCount:0,usedReferenceCount:0,outcome:'lookup-failed'});
 assert.equal(sanitizeIcarusStatus(snapshot({recent:[blocked],completed:0,blocked:1})).recent[0].phase,'blocked');
 assert.equal(sanitizeIcarusStatus(snapshot({recent:[{...blocked,outcome:'interrupted'}]})).recent[0].outcome,'interrupted');
 assert.deepEqual(sanitizeIcarusStatus(snapshot({recent:[{...blocked,outcome:'sources-observed'}]})).recent,[]);
 for(const bad of [null,[],{schema:2}])assert.equal(sanitizeIcarusStatus(bad),null);
});
test('active work is separate from bounded terminal history and duplicate polls cannot create trips',()=>{
 const active=row({id:'icarus-50',phase:'consulting',sourceCount:0,usedReferenceCount:0,outcome:'in-progress'}),recent=Array.from({length:24},(_,i)=>row({id:'icarus-'+(i+1)}));
 const value=sanitizeIcarusStatus(snapshot({active,recent:[...recent,row(),active],total:30,completed:20,blocked:4}));
 assert.equal(value.active.id,'icarus-50');assert.equal(value.recent.length,8);assert.equal(new Set(value.recent.map(item=>item.id)).size,8);assert(value.recent.every(item=>item.id!=='icarus-50'));
 assert.deepEqual(sanitizeIcarusStatus(value),value);
 assert.equal(sanitizeIcarusStatus(snapshot({active:row()})).active,null);
});
test('process assignment and progress counters agree with the closed consultation ledger',()=>{
 assert.deepEqual(sanitizeIcarusStatus(snapshot({recent:[row({processId:'tools',focus:'3d'})]})).recent,[]);
 assert.equal(sanitizeIcarusStatus(snapshot({active:row({phase:'consulting',outcome:'in-progress'})})).active,null);
 assert.deepEqual(sanitizeIcarusStatus(snapshot({recent:[row({phase:'blocked',outcome:'no-evidence'})]})).recent,[]);
 const active=row({phase:'seeking',sourceCount:0,usedReferenceCount:0,outcome:'in-progress'});
 assert.equal(sanitizeIcarusStatus(snapshot({active,recent:[]})).active.processId,'creative');
});
test('untrusted counts are bounded and evidence counts do not claim accepted improvements',()=>{
 const clean=sanitizeIcarusStatus(snapshot({total:4,completed:3,blocked:8,recent:[row({sourceCount:100,usedReferenceCount:100})]}));
 assert.equal(clean.completed,3);assert.equal(clean.blocked,1);assert.equal(clean.recent[0].sourceCount,32);assert.equal(clean.recent[0].usedReferenceCount,32);
 const invalid=sanitizeIcarusStatus(snapshot({total:NaN,completed:Infinity,blocked:-1,recent:[row({phase:'blocked',outcome:'cancelled',sourceCount:NaN,usedReferenceCount:Infinity})]}));
 assert.equal(invalid.total,0);assert.equal(invalid.completed,0);assert.equal(invalid.blocked,0);assert.equal(invalid.recent[0].sourceCount,0);assert.equal(invalid.recent[0].usedReferenceCount,0);
});
test('consultation events survive experience, process, bridge-style repeated whitelists without raw text',()=>{
 const raw={enabled:true,running:true,phase:'ion',icarus:snapshot({recent:[row({question:'PRIVATE-QUESTION'})]})};
 const experience=sanitizeExperienceStatus(raw),process=sanitizeProcessTelemetry({at,experience:raw});
 assert.deepEqual(experience.icarus,sanitizeIcarusStatus(raw.icarus));assert.deepEqual(process.experience.icarus,experience.icarus);
 assert.deepEqual(sanitizeProcessTelemetry(process).experience.icarus,experience.icarus);assert.doesNotMatch(JSON.stringify(process),/PRIVATE/);
});
