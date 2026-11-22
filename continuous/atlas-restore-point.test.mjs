import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasRestorePoint,verifyAtlasRestorePoint,planAtlasRestore} from './atlas-restore-point.mjs';
const revision='a'.repeat(40),currentRevision='b'.repeat(40);
test('creates and validates a non-executing restore manifest',()=>{
 const point=createAtlasRestorePoint({
  revision,config:{model:'local',temperature:0.2},
  historyHeadHash:'c'.repeat(64),createdAt:1000
 });
 assert.equal(verifyAtlasRestorePoint(point).valid,true);
 const plan=planAtlasRestore({point,currentRevision});
 assert.equal(plan.status,'approval_required');
 assert.equal(plan.executesRestore,false);
 assert.equal(plan.toRevision,revision);
 assert.equal(plan.requiresGitRevisionVerification,true);
});
test('detects changes to restore config and checksum',()=>{
 const point=createAtlasRestorePoint({
  revision,config:{model:'local'},createdAt:1000
 });
 assert.throws(()=>verifyAtlasRestorePoint({
  ...point,config:{model:'changed'}
 }),/checksum mismatch/);
});
test('approval does not execute restoration',()=>{
 const point=createAtlasRestorePoint({
  revision,config:{},createdAt:1000
 });
 const plan=planAtlasRestore({point,currentRevision,approved:true});
 assert.equal(plan.status,'ready_for_manual_execution');
 assert.equal(plan.executesRestore,false);
});
