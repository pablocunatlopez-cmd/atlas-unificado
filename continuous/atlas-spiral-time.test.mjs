import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SPIRAL_VERTICES,spiralEvent,spiralTangent,spiralTimeline,spiralRevision} from './atlas-spiral-time.mjs';
import {atlasIdentityPrompt} from './atlas-identity.mjs';
test('Atlas spiral uses precisely mental physical and God/suceso vertices',()=>{
 assert.deepEqual(Object.keys(SPIRAL_VERTICES),['mental','physical','god']);
 assert.match(SPIRAL_VERTICES.god,/Suceso/);
 assert.match(atlasIdentityPrompt,/TRES VÉRTICES DE LA ESPIRAL/);
 assert.match(atlasIdentityPrompt,/tangente/);
});
test('time tangent is a local difference, not a physical claim',()=>{
 const a=spiralEvent({id:'a',time:100,mental:'hipótesis',physical:'sin prueba'});
 const b=spiralEvent({id:'b',time:120,mental:'hipótesis revisada',physical:'observado'});
 const t=spiralTangent(a,b);
 assert.equal(t.dt,20);
 assert.deepEqual(t.changedVertices,['mental','physical']);
 assert.throws(()=>spiralTangent(b,a));
 assert.equal(spiralTimeline([a,b]).tangents.length,1);
});
test('unexpected events append a revision without rewriting original',()=>{
 const first=spiralEvent({id:'a',time:10,mental:'modelo inicial',unknown:'sin datos'});
 const next=spiralRevision(first,{id:'b',time:11,unknown:'acontecimiento nuevo'});
 assert.equal(next.revisionOf,'a');
 assert.equal(first.vertices.god,'sin datos');
 assert.equal(next.vertices.god,'acontecimiento nuevo');
 assert.throws(()=>spiralTimeline([first,first]));
 assert.throws(()=>spiralEvent({id:'x',time:NaN}));
});
