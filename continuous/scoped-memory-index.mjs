/**
 * Letta-inspired memory scoping without a database dependency.
 * The index is immutable and only returns entries from the requested scope.
 * Persistence and encryption must be supplied by a trusted storage layer.
 */
export function createScopedMemoryIndex(entries=[]){
 if(!Array.isArray(entries)||entries.length>10000)throw Error('Invalid memory collection');
 const seen=new Set();
 const stored=entries.map(item=>{
   if(!item||typeof item.id!=='string'||!item.id.trim()||seen.has(item.id)||
     typeof item.owner!=='string'||!item.owner.trim()||
     typeof item.project!=='string'||!item.project.trim()||
     typeof item.text!=='string'||item.text.length>16000||
     !['episodic','semantic','negative'].includes(item.kind))
     throw Error('Invalid memory entry');
   seen.add(item.id);
   return Object.freeze({id:item.id,owner:item.owner,project:item.project,kind:item.kind,text:item.text});
 });
 return Object.freeze({
   search({owner,project,query='',limit=10}={}){
     if(typeof owner!=='string'||!owner.trim()||typeof project!=='string'||!project.trim()||
       typeof query!=='string'||!Number.isSafeInteger(limit)||limit<1||limit>100)
       throw Error('Explicit memory scope required');
     const q=query.toLocaleLowerCase();
     return stored.filter(item=>item.owner===owner&&item.project===project&&
       item.text.toLocaleLowerCase().includes(q)).slice(0,limit).map(item=>({...item}));
   },
 });
}
