/** Explicit, bounded transcript storage in the user's existing Atlas state.
 * Never silently merges unrelated histories or overwrites a conflicting revision.
 */
export function offlineThreadToState(state,turns,{threadId,title,now=new Date().toISOString()}={}){
 if(!state||!Array.isArray(state.threads)||!Array.isArray(turns)||!threadId||typeof threadId!=='string')throw Error('Invalid offline conversation');
 if(turns.length>150)throw Error('Conversation exceeds Atlas state limit');
 const messages=turns.map((turn,i)=>{
  if(!turn||!['user','assistant'].includes(turn.role)||typeof turn.text!=='string'||turn.text.length>20000)throw Error('Invalid conversation turn');
  return {id:threadId+'-'+i,role:turn.role,text:turn.text,date:now};
 });
 const thread={id:threadId.slice(0,100),title:String(title||turns.find(t=>t.role==='user')?.text||'Atlas Core').slice(0,150),domain:'general',date:now,messages};
 if(state.threads.some(item=>item.id===thread.id))throw Error('Thread ID already exists');
 if(state.threads.length>=100)throw Error('Atlas thread limit reached');
 return {...state,threads:[...state.threads,thread]};
}
