/**
 * Sites-compatible capability planner. Pure JS: no Node APIs, GPU, Ollama,
 * local filesystem or automatic tool invocation. Host grants capabilities.
 */
export function planSitesTask({goal,capabilities=[],maxActions=5}={}){
 if(typeof goal!=='string'||!goal.trim()||goal.length>4000)throw Error('Invalid goal');
 if(!Array.isArray(capabilities)||!Number.isSafeInteger(maxActions)||maxActions<1||maxActions>20)
   throw Error('Invalid capabilities or budget');
 const approved=new Set();
 for(const cap of capabilities){
   if(typeof cap!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/.test(cap))throw Error('Invalid capability');
   approved.add(cap);
 }
 const desired=['retrieve_memory','research','draft_change','evaluate_change','request_approval'];
 const actions=desired.filter(name=>approved.has(name)).slice(0,maxActions);
 return Object.freeze({
   goal,
   environment:'sites',
   actions,
   missingCapabilities:desired.filter(name=>!approved.has(name)),
   requiresApproval:true,
   autoDeploy:false,
   status:actions.length?'planned':'blocked',
 });
}
