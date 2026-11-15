import {createSitesTaskLedger} from './sites-task-ledger.mjs';
/**
 * Portable, versioned Sites ledger snapshots. Storage is host-managed.
 * Never use a caller-supplied owner as authentication: the Sites host must
 * supply a verified principal before importing or exporting snapshots.
 */
const statuses=new Set(['proposed','awaiting_approval','approved','running','completed','failed','cancelled']);
const transitions={
 proposed:['awaiting_approval','cancelled'],
 awaiting_approval:['approved','cancelled'],
 approved:['running','cancelled'],
 running:['completed','failed','cancelled'],
 completed:[],failed:[],cancelled:[],
};
export function validateSitesLedgerSnapshot(snapshot,{owner,maxTasks=200}={}){
 if(typeof owner!=='string'||!owner.trim())throw Error('Verified owner required');
 if(!snapshot||snapshot.version!==1||!Array.isArray(snapshot.tasks)||
   snapshot.tasks.length>maxTasks)throw Error('Invalid snapshot');
 const ids=new Set();
 const tasks=snapshot.tasks.map(task=>{
   if(!task||typeof task.id!=='string'||!task.id.trim()||task.id.length>128||
      ids.has(task.id)||task.owner!==owner||
      typeof task.goal!=='string'||!task.goal.trim()||task.goal.length>4000||
      !statuses.has(task.status)||!Array.isArray(task.history)||
      task.history.length<1||task.history.length>1000)throw Error('Invalid task in snapshot');
   ids.add(task.id);
   const history=task.history.map((event,i)=>{
     if(!event||!statuses.has(event.status)||
       (i===0?event.status!=='proposed':!transitions[task.history[i-1].status]?.includes(event.status)))
       throw Error('Invalid task history');
     return {status:event.status};
   });
   if(history.at(-1).status!==task.status)throw Error('Task status differs from history');
   return {id:task.id,owner,goal:task.goal,status:task.status,history};
 });
 return {version:1,tasks};
}
export function exportSitesLedgerSnapshot(ledger,{owner}={}){
 if(typeof owner!=='string'||!owner.trim())throw Error('Verified owner required');
 return validateSitesLedgerSnapshot({version:1,tasks:ledger.list({owner})},{owner});
}
export function restoreSitesLedgerSnapshot(snapshot,{owner,maxTasks=200}={}){
 const safe=validateSitesLedgerSnapshot(snapshot,{owner,maxTasks});
 const ledger=createSitesTaskLedger({maxTasks});
 for(const task of safe.tasks){
   ledger.create({id:task.id,owner:task.owner,goal:task.goal});
   for(const event of task.history.slice(1)){
     ledger.transition({id:task.id,owner,to:event.status});
   }
 }
 return ledger;
}
