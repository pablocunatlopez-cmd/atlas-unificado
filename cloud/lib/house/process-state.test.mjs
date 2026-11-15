import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProcessState,processForRoom,processCaption,processMotion,creatureArchetype,measuredChanges} from '../../public/house/process-state.js';

test('process display accepts bounded evidence and rejects unknown states, counters and executable fields',()=>{
 const value=normalizeProcessState({at:'2026-10-31T12:00:00Z',secret:'ignored',processes:[{id:'library',state:'running',phase:'observe',label:'Repositorios\n públicos',counters:{observations:14,accepted:0,rejected:-1,trials:1e30},script:'run()'},{id:'__proto__',state:'running'},{id:'bad',room:'missing',state:'passed'},{id:'core',state:'superintelligent'},{id:'custom',room:'language',state:'passed',counters:{accepted:2}}]});
 assert.equal(value.at,'2026-10-31T12:00:00.000Z');assert.equal(value.processes.length,2);assert.deepEqual(value.processes[0],{id:'library',room:'mind',state:'running',label:'Repositorios públicos',phase:'observe',counters:{observations:14,accepted:0}});assert.equal(value.secret,undefined);assert.equal(value.processes[0].script,undefined);
 assert.match(processCaption(value.processes[0]),/Observar.*En ejecución.*Aceptados reportados 0/);
 assert.equal(normalizeProcessState({processes:Array.from({length:100},()=>({id:'chat',state:'idle'}))}).processes.length,32);
});
test('fresh running state drives work, stale or absent telemetry becomes waiting without inventing learning',()=>{
 const data=normalizeProcessState({at:'2026-11-01T12:00:00Z',processes:[{id:'library',state:'running',phase:'observe',counters:{observations:8}}]});
 assert.equal(processForRoom(data,'mind',{ageMs:74000}).state,'running');const stale=processForRoom(data,'mind',{ageMs:76000});assert.equal(stale.state,'waiting');assert.equal(stale.counters.observations,8);assert.equal(stale.counters.accepted,undefined);assert.match(stale.label,/Sin señal/);
 const missing=processForRoom(data,'body');assert.equal(missing.state,'waiting');assert.equal(missing.counters,undefined);assert.match(missing.label,/Sin telemetría/);
 const poses=Array.from({length:10},(_,i)=>processMotion(stale,i/2));assert.ok(poses.every(pose=>pose.travel===0&&pose.limb===0&&pose.bob===0));assert.ok(Array.from({length:10},(_,i)=>processMotion({...processForRoom(data,'mind'),phase:'connect'},i/2)).some(pose=>Math.abs(pose.travel)>.1));
});
test('missing, future or offline evidence cannot authorize work, and phases produce distinct verified poses',()=>{
 const data=normalizeProcessState({at:'2026-11-01T12:00:00Z',processes:[{id:'experience',state:'running',phase:'apply',counters:{accepted:2}}]});
 for(const value of [normalizeProcessState({processes:data.processes}),{...data,connected:false}])assert.equal(processForRoom(value,'mind').workVerified,false);
 for(const ageMs of [-1,Infinity,76000])assert.equal(processForRoom(data,'mind',{ageMs}).workVerified,false);
 assert.equal(processMotion({state:'running'},1).working,false);
 const live=processForRoom(data,'mind',{ageMs:1000}),poses=['observe','understand','connect','apply','refute','retain'].map(phase=>processMotion({...live,phase},1));
 assert.equal(new Set(poses.map(pose=>JSON.stringify(pose))).size,6);assert.match(processCaption({...live,phase:'retain'}),/Conservar.*Cambios reportados 2/);
 assert.equal(measuredChanges(data,{now:Date.parse('2026-11-01T12:00:00Z')+1000}),2);assert.equal(measuredChanges(data,{now:Date.parse('2026-11-01T12:01:16Z')}),null);assert.equal(measuredChanges({processes:[{id:'tools',counters:{accepted:99}}]}),null);
 assert.equal(creatureArchetype({id:'experience'},'mind'),'human');assert.equal(creatureArchetype({id:'agents'},'constellation'),'bird');assert.equal(creatureArchetype({id:'research'},'mind'),'human');assert.equal(creatureArchetype({id:'external'},'constellation'),'bird');
 assert.equal(creatureArchetype({id:'lab',state:'waiting'},'lab'),'animal');assert.equal(creatureArchetype({id:'creative',state:'running'},'lab'),'animal');assert.equal(creatureArchetype({id:'tools'},'body'),'robot');
});
test('refuted and passed evidence have distinct labels while their creatures never walk as if still working',()=>{
 const data=normalizeProcessState({processes:[{id:'tools',state:'passed',counters:{trials:12,accepted:3}},{id:'review',state:'failed',phase:'refute',counters:{rejected:2}}]});
 const pass=processForRoom(data,'body'),fail=processForRoom(data,'refutation');assert.match(processCaption(pass),/Resultado reportado.*Aceptados reportados 3/);assert.match(processCaption(fail),/Refutar.*Fallo reportado.*Rechazados reportados 2/);
 for(const record of [pass,fail])for(let time=0;time<8;time+=.5){assert.equal(processMotion(record,time).limb,0);assert.equal(processMotion(record,time).travel,0);}
});
