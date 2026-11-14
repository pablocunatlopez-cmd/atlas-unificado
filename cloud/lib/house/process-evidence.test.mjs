import {test} from 'node:test';
import assert from 'node:assert/strict';
import {processEvidence} from '../../public/house/process-evidence.js';

const at='2026-11-14T12:00:00.000Z';
const now=Date.parse(at);
const packet=(state='running',changes={})=>({at,connected:true,processes:[{id:'experience',state,...changes}]});

test('fresh coordinator reports remain reported, never verified or integrated',()=>{
 for(const state of ['idle','running','passed','failed','waiting']){
  const evidence=processEvidence(packet(state),'experience',{now});
  assert.equal(evidence.status,'reported');
  assert.equal(evidence.state,state);
  assert.equal(evidence.source,'coordinator');
  assert.equal(evidence.verified,false);
  assert.equal(evidence.integrated,false);
 }
 assert.match(processEvidence(packet('passed'),'experience',{now}).label,/verificación independiente pendiente/);
});

test('missing, disconnected, expired and future telemetry fails closed',()=>{
 assert.equal(processEvidence({processes:[]},'experience',{now}).status,'unknown');
 assert.equal(processEvidence(packet('running',{at:'invalid'}),'experience',{now}).status,'unknown');
 assert.equal(processEvidence({...packet(),connected:false},'experience',{now}).status,'waiting');
 assert.equal(processEvidence(packet(), 'experience',{now:now+75001}).status,'stale');
 assert.equal(processEvidence(packet(), 'experience',{now:now-1}).status,'unknown');
});

test('reported counters are not converted into validation or learning claims',()=>{
 const evidence=processEvidence(packet('passed',{counters:{accepted:4}}),'experience',{now});
 assert.equal(evidence.status,'reported');
 assert.equal(evidence.verified,false);
 assert.equal(evidence.integrated,false);
 assert.equal(Object.hasOwn(evidence,'acceptedChanges'),false);
});
