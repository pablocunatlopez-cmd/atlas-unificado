import {planSitesTask} from './sites-capability-planner.mjs';
import {createSitesTaskLedger} from './sites-task-ledger.mjs';

/**
 * Minimal Sites coordinator: plans capabilities and tracks approval.
 * It deliberately never invokes tools or interprets ledger approval as
 * permission to publish changes in an external service.
 */
export function createSitesCoordinator({capabilities=[],maxTasks=200}={}){
 const ledger=createSitesTaskLedger({maxTasks});
 return Object.freeze({
   propose({id,owner,goal}={}){
     const plan=planSitesTask({goal,capabilities});
     const task=ledger.create({id,owner,goal});
     return {task,plan};
   },
   requestApproval({id,owner}={}){
     return ledger.transition({id,owner,to:'awaiting_approval'});
   },
   approve({id,owner,confirmed=false}={}){
     if(confirmed!==true)throw Error('Explicit confirmation required');
     return ledger.transition({id,owner,to:'approved'});
   },
   begin({id,owner}={}){
     return ledger.transition({id,owner,to:'running'});
   },
   finish({id,owner,success}={}){
     if(typeof success!=='boolean')throw Error('Explicit outcome required');
     return ledger.transition({id,owner,to:success?'completed':'failed'});
   },
   cancel({id,owner}={}){
     return ledger.transition({id,owner,to:'cancelled'});
   },
   get:ledger.get,
   list:ledger.list,
 });
}
