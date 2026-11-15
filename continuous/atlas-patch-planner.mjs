/**
 * Atlas deterministic patch proposal planner.
 * Inspired by git-first coding agents: scope changes, reject traversal,
 * and require checks before any host executes a patch.
 * Does not write files, run shell commands or grant permissions.
 */
const PATH=/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[a-zA-Z0-9_.\/-]{1,240}$/;
const OPERATIONS=new Set(['create','update','delete']);
const MAX_FILES=50;
const MAX_BYTES=250_000;
export function planAtlasPatch({proposalId,files=[],checks=['syntax','unit','security']}={}){
 if(typeof proposalId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(proposalId)||
    !Array.isArray(files)||files.length===0||files.length>MAX_FILES||
    !Array.isArray(checks)||checks.length===0||checks.length>20)
   throw Error('Invalid patch proposal');
 const seen=new Set();let bytes=0;
 const changes=files.map(f=>{
   if(!f||!OPERATIONS.has(f.operation)||typeof f.path!=='string'||
      !PATH.test(f.path)||f.path.split('/').some(x=>x===''||x==='.'||x==='..')||
      seen.has(f.path)||f.path.startsWith('.git/')||
      f.path.startsWith('node_modules/')||
      (f.operation!=='delete'&&typeof f.content!=='string')||
      (f.operation==='delete'&&f.content!==undefined))
     throw Error('Invalid patch operation');
   seen.add(f.path);
   if(f.operation!=='delete'){
     bytes+=new TextEncoder().encode(f.content).length;
     if(bytes>MAX_BYTES)throw Error('Patch size exceeded');
   }
   return {operation:f.operation,path:f.path,bytes:f.operation==='delete'?0:new TextEncoder().encode(f.content).length};
 });
 const requestedChecks=[...new Set(checks)];
 if(requestedChecks.some(x=>!['syntax','unit','security','integration','lint','benchmark'].includes(x)))
   throw Error('Unknown check');
 return Object.freeze({
  proposalId,changes,requestedChecks,totalBytes:bytes,
  requiresReview:true,executionStatus:'not_executed',
 });
}
