/**
 * Sites-friendly task ledger. In-memory state only; host must persist and
 * authenticate task ownership. No tools are executed by this module.
 */
export function createSitesTaskLedger({maxTasks=200}={}){
 if(!Number.isSafeInteger(maxTasks)||maxTasks<1||maxTasks>1000)throw Error('Invalid task limit');
 const tasks=new Map();
 const copy=t=>({...t,history:t.history.map(x=>({...x}))});
 return Object.freeze({
   create({id,owner,goal}={}){
     if(typeof id!=='string'||!id.trim()||id.length>128||tasks.has(id)||
       typeof owner!=='string'||!owner.trim()||owner.length>128||
       typeof goal!=='string'||!goal.trim()||goal.length>4000||
       tasks.size>=maxTasks)throw Error('Invalid or duplicate task');
     const task={id,owner,goal,status:'proposed',history:[{status:'proposed'}]};
     tasks.set(id,task);
     return copy(task);
   },
   transition({id,owner,to}={}){
     const task=tasks.get(id);
     if(!task||task.owner!==owner)throw Error('Task not found in owner scope');
     const allowed={
       proposed:['awaiting_approval','cancelled'],
       awaiting_approval:['approved','cancelled'],
       approved:['running','cancelled'],
       running:['completed','failed','cancelled'],
       completed:[],failed:[],cancelled:[],
     };
     if(!allowed[task.status].includes(to))throw Error('Invalid task transition');
     task.status=to;
     task.history.push({status:to});
     return copy(task);
   },
   get({id,owner}={}){
     const task=tasks.get(id);
     return task&&task.owner===owner?copy(task):null;
   },
   list({owner}={}){
     if(typeof owner!=='string'||!owner.trim())throw Error('Owner required');
     return [...tasks.values()].filter(task=>task.owner===owner).map(copy);
   },
 });
}
