import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeIcarusJourneys,residentForIcarusEvent,icarusEventCaption,planSkyRoute,createSkyJourneys,ICARUS_MEETING_POINT} from '../../public/house/sky-journeys.js';
import {blocked,movePlayer,roomAt} from '../../public/house/layout.js';
import {residentById,RESIDENTS} from '../../public/house/residents.js';
import {buildHouse} from '../../public/house/scene.js';

const at='2026-11-04T07:00:00.000Z',epoch=Date.parse(at);
const event=(extra={})=>({id:'icarus-1',phase:'returning',processId:'creative',focus:'3d',at,startedAt:at,sourceCount:2,usedReferenceCount:1,outcome:'references-available',...extra});
const snapshot=(entry=event())=>({schema:1,total:1,completed:entry.phase==='returning'?1:0,blocked:entry.phase==='blocked'?1:0,active:['seeking','consulting'].includes(entry.phase)?entry:null,recent:['returning','blocked'].includes(entry.phase)?[entry]:[]});
const meta={connected:true,sourceAgeMs:0,receivedAtMs:0};
const advance=(journeys,id,from,to)=>{let value;for(let ms=from;ms<=to;ms+=100)value=journeys.sample(id,ms);return value;};
function geometry(t){
 const prior=globalThis.document,context=new Proxy({},{get:()=>()=>{},set:()=>true});
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
 const house=buildHouse();t.after(()=>{house.dispose();if(prior===undefined)delete globalThis.document;else globalThis.document=prior;});return house;
}

test('journey state is closed, bounded and consistent with the source process and terminal outcome',()=>{
 const raw=snapshot({...event(),question:'private-question',url:'https://private.invalid',script:'never execute'});raw.privateKey='not copied';
 const clean=normalizeIcarusJourneys(raw);assert.equal(clean.recent.length,1);assert.equal(clean.recent[0].usedReferenceCount,1);assert.doesNotMatch(JSON.stringify(clean),/private|execute/);
 assert.equal(normalizeIcarusJourneys({schema:1,total:1,completed:2,blocked:0}),null);
 assert.equal(normalizeIcarusJourneys({...snapshot(),schema:2}),null);
 assert.equal(normalizeIcarusJourneys({...snapshot(),total:0,completed:0}),null,'a receipt cannot exist outside its actual ledger count');
 for(const bad of [{processId:'chat'},{id:'icarus-0'},{phase:'returning',sourceCount:0,usedReferenceCount:0},{usedReferenceCount:3},{phase:'consulting',outcome:'sources-observed'},{at:'not-a-date'}])assert.equal(normalizeIcarusJourneys(snapshot(event(bad))).recent.length,0);
 assert.equal(residentForIcarusEvent(event()).id,'games-maquette');assert.equal(residentForIcarusEvent(event({focus:'conversation',processId:'chat'})).id,'salon-centre');
 assert.equal(residentForIcarusEvent(event({focus:'programming',processId:'tools'})).id,'body-console');assert.equal(residentForIcarusEvent(event({focus:'unknown',processId:'experience'})).id,'mind-desk');
 assert.match(icarusEventCaption(event()),/Consulta registrada/);assert.match(icarusEventCaption(event({phase:'blocked',sourceCount:0,usedReferenceCount:0,outcome:'no-evidence'})),/sin nuevas referencias/);
});

test('all represented visitor routes cross doors and avoid the actual furnished house collision geometry',t=>{
 const house=geometry(t);
 for(const id of ['salon-centre','lab-desk','games-maquette','games-desk','mind-desk','body-console','refutation-candidate','refutation-control','language-object','language-symbol','cinema-projector']){
  const route=planSkyRoute(id,{walls:house.solids});assert.ok(route,id+' has a real collision-safe route');assert.ok(route.points.length<200);assert.deepEqual(route.points.at(-1),ICARUS_MEETING_POINT);
  const resident=residentById(id);assert.deepEqual(route.points[0],[resident.position[0],resident.position[2]]);
  for(let i=1;i<route.points.length;i++){
   const a=route.points[i-1],b=route.points[i],traversed=movePlayer({x:a[0],z:a[1]},b[0]-a[0],b[1]-a[1],{radius:route.radius,walls:house.solids});
   assert.ok(Math.hypot(traversed.x-b[0],traversed.z-b[1])<1e-6,id+' crosses no wall or furniture');
   assert.equal(blocked(b[0],b[1],route.radius,house.solids),false);
  }
  assert.equal(roomAt(...route.points.at(-1)),'constellation');
 }
 for(const id of ['sky-agents','sky-sources','cinema-audience-1','unknown'])assert.equal(planSkyRoute(id,{walls:house.solids}),null);
 assert.equal(planSkyRoute('games-maquette',{walls:[[-17,-17,17,9]]}),null,'a blocked house does not invent a teleport path');
});

test('one recorded consultation produces an outbound, meeting and return sequence without replaying the same ID',()=>{
 const journeys=createSkyJourneys({now:()=>epoch}),id='games-maquette',original=structuredClone(snapshot());
 assert.equal(journeys.sample(id,0),null);assert.equal(journeys.positionForResident('sky-agents'),null);
 journeys.setState(snapshot(),meta);let value=journeys.sample(id,0);assert.equal(value.stage,'outbound');assert.equal(value.recorded,true);assert.match(value.caption,/Consulta registrada/);
 const stages=new Set();for(let ms=100;ms<40000;ms+=100){value=journeys.sample(id,ms);stages.add(value.stage);}
 assert.ok(stages.has('meeting'));assert.ok(stages.has('returning'));assert.equal(value.stage,'home');assert.equal(value.active,false);assert.deepEqual(value.position,residentById(id).position);
 journeys.setState(snapshot(),{...meta,receivedAtMs:40000});value=journeys.sample(id,41000);assert.equal(value.stage,'home');assert.equal(value.active,false);assert.deepEqual(snapshot(),original,'visuals never change backend counts');
 assert.equal(journeys.sample('sky-agents',41000),null);assert.equal(journeys.sample('cinema-audience-1',41000),null);
});

test('fresh phase updates do not restart a trip and stale or disconnected state freezes its last position',()=>{
 const journeys=createSkyJourneys({now:()=>epoch}),id='games-maquette',running=event({phase:'consulting',sourceCount:0,usedReferenceCount:0,outcome:'in-progress'});
 journeys.setState(snapshot(running),meta);const outbound=advance(journeys,id,0,3000);assert.equal(outbound.stage,'outbound');
 journeys.setState(snapshot(running),{...meta,receivedAtMs:3000});const later=journeys.sample(id,3100);assert.notDeepEqual(later.position,residentById(id).position,'repeated polls do not reset to the desk');
 journeys.setState(snapshot(running),{...meta,connected:false,receivedAtMs:3200});const frozen=journeys.sample(id,3300);assert.deepEqual(frozen.position,later.position);assert.equal(frozen.moving,false);assert.equal(frozen.fresh,false);
 assert.deepEqual(journeys.sample(id,3400).position,frozen.position);
 journeys.setState(snapshot(running),{...meta,receivedAtMs:3500});const resumed=journeys.sample(id,3600);assert.notDeepEqual(resumed.position,frozen.position);
 const last=journeys.sample(id,3700);const stale=journeys.sample(id,80000);assert.deepEqual(stale.position,last.position);assert.equal(stale.fresh,false);
});

test('terminal receipts survive newer pending queries and regressive phase packets cannot resurrect a finished trip',()=>{
 const journeys=createSkyJourneys({now:()=>epoch}),id='games-maquette',running=event({phase:'consulting',sourceCount:0,usedReferenceCount:0,outcome:'in-progress'});
 journeys.setState(snapshot(running),meta);advance(journeys,id,0,1000);
 journeys.setState({schema:1,total:2,completed:1,blocked:0,active:{...running,id:'icarus-2'},recent:[event()]},{...meta,receivedAtMs:1000});
 assert.equal(advance(journeys,id,1100,40000).stage,'home','the original terminal receipt is not hidden by a newer query');
 journeys.setState(snapshot(running),{...meta,receivedAtMs:40000});const value=journeys.sample(id,41000);assert.equal(value.stage,'home');assert.equal(value.recorded,true);
});

test('blocked, future, absent and reduced-motion cases cannot invent a successful consultation or learning change',()=>{
 const blockedEvent=event({phase:'blocked',sourceCount:0,usedReferenceCount:0,outcome:'no-evidence'}),journeys=createSkyJourneys({now:()=>epoch});
 journeys.setState(snapshot(blockedEvent),meta);const value=advance(journeys,'games-maquette',0,40000);assert.equal(value.stage,'home');assert.equal(value.sourceCount,0);assert.match(value.caption,/sin nuevas referencias/);assert.equal('acceptedChange' in value,false);
 for(const spec of [null,snapshot(event({at:'2026-11-05T00:00:00.000Z',startedAt:'2026-11-05T00:00:00.000Z'})),snapshot(event({phase:'blocked',sourceCount:0,usedReferenceCount:0,outcome:'cancelled'}))]){const safe=createSkyJourneys({now:()=>epoch});safe.setState(spec,meta);assert.equal(safe.sample('games-maquette',0),null);}
 const reduced=createSkyJourneys({now:()=>epoch,reducedMotion:true});reduced.setState(snapshot(),meta);assert.equal(reduced.sample('games-maquette',0).stage,'home');
 const waiting=event({phase:'consulting',sourceCount:0,usedReferenceCount:0,outcome:'in-progress'});reduced.setState(snapshot({...waiting,id:'icarus-2'}),{...meta,receivedAtMs:1});assert.equal(reduced.sample('games-maquette',1).stage,'meeting');
 assert.equal(RESIDENTS.length,24);
});

test('a fresh new consultation retires an expired presentation after a long hidden or disconnected interval',()=>{
 let clock=epoch;const journeys=createSkyJourneys({now:()=>clock}),id='games-maquette';
 journeys.setState(snapshot(),meta);const before=advance(journeys,id,0,3000);clock+=90000;
 const frozen=journeys.sample(id,93000);assert.deepEqual(frozen.position,before.position);assert.equal(frozen.fresh,false);
 const next=event({id:'icarus-2',at:new Date(clock).toISOString(),startedAt:new Date(clock).toISOString()});
 const state={...snapshot(next),total:2,completed:2};journeys.setState(state,{...meta,receivedAtMs:94000});
 const resumed=journeys.sample(id,94000);assert.equal(resumed.eventId,'icarus-2');assert.equal(resumed.fresh,true);assert.equal(resumed.stage,'outbound');
 assert.deepEqual(resumed.position,residentById(id).position);assert.equal(state.completed,2);assert.equal('acceptedChange' in resumed,false);
});
