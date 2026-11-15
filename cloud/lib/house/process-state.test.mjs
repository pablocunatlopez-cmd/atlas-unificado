import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProcessState,
  processForRoom,
  processCaption,
  processMotion,
  creatureArchetype,
  measuredChanges,
  telemetryAge,
  telemetryFreshness,
  TELEMETRY_CONTRACT_VERSION,
  REASON_LABELS,
} from '../../public/house/process-state.js';

test('process display accepts bounded evidence and rejects unknown states, counters and executable fields',()=>{
 const value=normalizeProcessState({at:'2026-10-31T12:00:00Z',secret:'ignored',processes:[{id:'library',state:'running',phase:'observe',label:'Repositorios\n públicos',counters:{observations:14,accepted:0,rejected:-1,trials:1e30},script:'run()'},{id:'__proto__',state:'running'},{id:'bad',room:'missing',state:'passed'},{id:'core',state:'superintelligent'},{id:'custom',room:'language',state:'passed',counters:{accepted:2}}]});
 assert.equal(value.at,'2026-10-31T12:00:00.000Z');assert.equal(value.processes.length,2);assert.deepEqual(value.processes[0],{id:'library',room:'mind',state:'running',label:'Repositorios públicos',phase:'observe',counters:{observations:14,accepted:0}});assert.equal(value.secret,undefined);assert.equal(value.processes[0].script,undefined);
 assert.match(processCaption(value.processes[0]),/Observar.*En ejecución.*Aceptados reportados 0/);
 assert.equal(normalizeProcessState({processes:Array.from({length:100},()=>({id:'chat',state:'idle'}))}).processes.length,32);
});

test('the scene preserves only closed Icarus consultation state without inventing learning or exposing text',()=>{
 const event={id:'icarus-12',processId:'creative',focus:'3d',phase:'returning',at:'2026-11-04T09:00:00Z',startedAt:'2026-11-04T08:59:50Z',sourceCount:2,usedReferenceCount:1,outcome:'references-available',question:'PRIVATE QUESTION',url:'https://private.invalid'};
 const value=normalizeProcessState({at:event.at,connected:false,processes:[{id:'experience',state:'waiting',counters:{accepted:3}}],icarus:{schema:1,total:12,completed:9,blocked:3,active:null,recent:[event],secret:'PRIVATE TOKEN'}});
 assert.equal(value.connected,false);assert.equal(value.icarus.recent[0].id,event.id);assert.equal(value.icarus.recent[0].usedReferenceCount,1);assert.equal(measuredChanges(value),null);assert.doesNotMatch(JSON.stringify(value),/PRIVATE|private\.invalid/);
 assert.equal(normalizeProcessState({processes:[],icarus:{schema:99}}).icarus,null);
});
test('fresh running state drives work, stale or absent telemetry becomes waiting without inventing learning',()=>{
 const data=normalizeProcessState({at:'2026-11-01T12:00:00Z',processes:[{id:'library',state:'running',phase:'observe',counters:{observations:8}}]});
 const live=processForRoom(data,'mind',{ageMs:74000});
 assert.equal(live.state,'running');
 assert.equal(live.reason,'fresh');
 assert.equal(live.workVerified,true);
 const stale=processForRoom(data,'mind',{ageMs:76000});
 assert.equal(stale.state,'waiting');
 assert.equal(stale.reason,'stale');
 assert.equal(stale.workVerified,false);
 assert.equal(stale.counters.observations,8);
 assert.equal(stale.counters.accepted,undefined);
 assert.match(stale.label,/Sin señal/);
 const missing=processForRoom(data,'body');
 assert.equal(missing.state,'waiting');
 assert.equal(missing.reason,'no_process');
 assert.equal(missing.counters,undefined);
 assert.match(missing.label,/Sin telemetría/);
 const poses=Array.from({length:10},(_,i)=>processMotion(stale,i/2));
 assert.ok(poses.every(pose=>pose.travel===0&&pose.limb===0&&pose.bob===0));
 assert.ok(Array.from({length:10},(_,i)=>processMotion({...processForRoom(data,'mind'),phase:'connect'},i/2)).some(pose=>Math.abs(pose.travel)>.1));
});

test('telemetryFreshness classifies disconnected, invalid and stale signals',()=>{
 const at='2026-11-01T12:00:00Z';
 const now=Date.parse(at)+1000;
 assert.deepEqual(telemetryFreshness({at,connected:true},{now}),{fresh:true,reason:'fresh',ageMs:1000});
 assert.equal(telemetryFreshness({at,connected:false},{now}).reason,'disconnected');
 assert.equal(telemetryFreshness({at:'not-a-date',connected:true},{now}).reason,'invalid_time');
 assert.equal(telemetryFreshness({at,connected:true},{now:now+80000}).reason,'stale');
 assert.equal(REASON_LABELS.stale,'Sin señal reciente');
 assert.equal(REASON_LABELS.disconnected,'Puente desconectado');
});

test('future, malformed or missing timestamps have no valid age and cannot keep reported changes current',()=>{
 const now=Date.parse('2026-11-01T12:00:00Z');
 assert.equal(telemetryAge('2026-11-01T11:59:59Z',{now}),1000);
 for(const at of ['2026-11-01T12:00:01Z','not-a-date',null,undefined])assert.equal(telemetryAge(at,{now}),null);
 assert.equal(measuredChanges({at:'2026-11-01T12:00:01Z',processes:[{id:'experience',counters:{accepted:2}}]},{now}),null);
 assert.equal(measuredChanges({at:'2026-11-01T12:00:00Z',processes:[{id:'experience',counters:{accepted:2}}]},{now:now+76000}),null);
});

test('missing, future or offline evidence cannot authorize work, and phases produce distinct verified poses',()=>{
 const data=normalizeProcessState({at:'2026-11-01T12:00:00Z',processes:[{id:'experience',state:'running',phase:'apply',counters:{accepted:2}}]});
 for(const value of [normalizeProcessState({processes:data.processes}),{...data,connected:false}]){
  const room=processForRoom(value,'mind');
  assert.equal(room.workVerified,false);
  assert.ok(room.reason==='invalid_time'||room.reason==='disconnected');
 }
 for(const ageMs of [-1,Infinity,76000])assert.equal(processForRoom(data,'mind',{ageMs}).workVerified,false);
 assert.equal(processMotion({state:'running'},1).working,false);
 const live=processForRoom(data,'mind',{ageMs:1000}),poses=['observe','understand','connect','apply','refute','retain'].map(phase=>processMotion({...live,phase},1));
 assert.equal(new Set(poses.map(pose=>JSON.stringify(pose))).size,6);assert.match(processCaption({...live,phase:'retain'}),/Conservar.*Cambios reportados 2/);
 assert.equal(measuredChanges(data,{now:Date.parse(data.at)+1000}),2);assert.equal(measuredChanges({processes:[{id:'tools',counters:{accepted:99}}]}),null);
 assert.equal(creatureArchetype({id:'experience'},'mind'),'human');assert.equal(creatureArchetype({id:'agents'},'constellation'),'bird');assert.equal(creatureArchetype({id:'research'},'mind'),'human');assert.equal(creatureArchetype({id:'external'},'constellation'),'bird');
 assert.equal(creatureArchetype({id:'lab',state:'waiting'},'lab'),'animal');assert.equal(creatureArchetype({id:'creative',state:'running'},'lab'),'animal');assert.equal(creatureArchetype({id:'tools'},'body'),'robot');
});

test('refuted and passed evidence have distinct labels while their creatures never walk as if still working',()=>{
 const data=normalizeProcessState({processes:[{id:'tools',state:'passed',counters:{trials:12,accepted:3}},{id:'review',state:'failed',phase:'refute',counters:{rejected:2}}]});
 const pass=processForRoom(data,'body'),fail=processForRoom(data,'refutation');assert.match(processCaption(pass),/Resultado reportado.*Aceptados reportados 3/);assert.match(processCaption(fail),/Refutar.*Fallo reportado.*Rechazados reportados 2/);
 for(const record of [pass,fail])for(let time=0;time<8;time+=.5){assert.equal(processMotion(record,time).limb,0);assert.equal(processMotion(record,time).travel,0);}
});

test('reported counters expire and invalid clocks never promote stale coordinator data',()=>{
 const at='2026-11-14T20:00:00Z',now=Date.parse(at),sample={at,connected:true,processes:[{id:'experience',counters:{accepted:3}}]};
 assert.equal(measuredChanges(sample,{now:now+75000}),3);assert.equal(measuredChanges(sample,{now:now+75001}),null);assert.equal(measuredChanges(sample,{now:now-1}),null);assert.equal(measuredChanges({...sample,at:'invalid'},{now}),null);assert.equal(measuredChanges({...sample,connected:false},{now}),null);assert.equal(measuredChanges(sample,{now,maxAgeMs:NaN}),null);
});
