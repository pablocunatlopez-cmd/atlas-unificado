/**
 * ERAS scene renderer reconciliation. The host supplies a trusted adapter
 * with create/update/destroy functions for its Three.js/PlayCanvas renderer.
 * This module never evaluates model output or downloads assets.
 */
export function createErasRendererBridge(adapter,{maxNodes=1000}={}){
 if(!adapter||!['create','update','destroy'].every(k=>typeof adapter[k]==='function')||
   !Number.isSafeInteger(maxNodes)||maxNodes<1||maxNodes>10000)
   throw Error('Invalid renderer adapter');
 const live=new Map();
 const clone=x=>JSON.parse(JSON.stringify(x));
 let disposed=false;
 const assertOpen=()=>{if(disposed)throw Error('Renderer disposed');};
 return Object.freeze({
  async sync(snapshot){
   assertOpen();
   if(!snapshot||snapshot.schemaVersion!==1||!Array.isArray(snapshot.nodes)||
      snapshot.nodes.length>maxNodes)throw Error('Invalid scene snapshot');
   const incoming=new Map();
   for(const node of snapshot.nodes){
     if(!node||typeof node.id!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(node.id)||
       incoming.has(node.id))throw Error('Invalid or duplicate node');
     incoming.set(node.id,clone(node));
   }
   // Validate references before touching the renderer.
   for(const node of incoming.values()){
     if(node.parent!=null&&!incoming.has(node.parent))throw Error('Missing parent');
     const seen=new Set([node.id]);let p=node.parent;
     while(p!=null){
       if(seen.has(p))throw Error('Cyclic scene');
       seen.add(p);p=incoming.get(p).parent;
     }
   }
   // Create parents before children.
   const ordered=[];const visited=new Set();
   function visit(node){
     if(visited.has(node.id))return;
     if(node.parent!=null)visit(incoming.get(node.parent));
     visited.add(node.id);ordered.push(node);
   }
   for(const node of incoming.values())visit(node);
   // Delete children before parents.
   const removed=[...live.keys()].filter(id=>!incoming.has(id));
   removed.sort((a,b)=>depth(b,live)-depth(a,live));
   for(const id of removed){await adapter.destroy(id);live.delete(id);}
   let created=0,updated=0;
   for(const node of ordered){
     const previous=live.get(node.id);
     if(!previous){await adapter.create(clone(node));live.set(node.id,clone(node));created++;}
     else if(JSON.stringify(previous)!==JSON.stringify(node)){
       await adapter.update(clone(node));live.set(node.id,clone(node));updated++;
     }
   }
   return {created,updated,removed:removed.length,total:live.size};
  },
  async dispose(){
   if(disposed)return;
   const ids=[...live.keys()].sort((a,b)=>depth(b,live)-depth(a,live));
   for(const id of ids){await adapter.destroy(id);live.delete(id);}
   disposed=true;
  },
  ids(){return [...live.keys()];},
 });
}
function depth(id,nodes){
 let count=0,p=nodes.get(id)?.parent;
 while(p!=null&&count<=nodes.size){count++;p=nodes.get(p)?.parent;}
 return count;
}
