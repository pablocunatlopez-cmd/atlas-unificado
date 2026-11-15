import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSitesCoordinator} from './sites-coordinator.mjs';

test('coordinates proposal and explicit approval without executing tools',()=>{
 const sites=createSitesCoordinator({capabilities:['research']});
 const {task,plan}=sites.propose({id:'t1',owner:'owner',goal:'Research changes'});
 assert.equal(task.status,'proposed');
 assert.deepEqual(plan.actions,['research']);
 assert.throws(()=>sites.approve({id:'t1',owner:'owner'}));
 sites.requestApproval({id:'t1',owner:'owner'});
 assert.throws(()=>sites.approve({id:'t1',owner:'owner'}));
 sites.approve({id:'t1',owner:'owner',confirmed:true});
 sites.begin({id:'t1',owner:'owner'});
 assert.equal(sites.finish({id:'t1',owner:'owner',success:true}).status,'completed');
});
test('cannot approve another owners task',()=>{
 const sites=createSitesCoordinator();
 sites.propose({id:'t1',owner:'alice',goal:'Private'});
 sites.requestApproval({id:'t1',owner:'alice'});
 assert.throws(()=>sites.approve({id:'t1',owner:'bob',confirmed:true}));
});
