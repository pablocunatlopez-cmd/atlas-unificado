/**
 * ERAS scene editor core, usable by Atlas in a browser.
 * Declarative scene data only: never evaluates scripts or fetches URLs.
 */
const ID=/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const TYPES=new Set(['group','mesh','character','light','camera','terrain','audio']);
const clone=x=>JSON.parse(JSON.stringify(x));
const vector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<=1e6);
function validNode(node){
 if(!node||typeof node!=='object'||Array.isArray(node)||
    typeof node.id!=='string'||!ID.test(node.id)||!TYPES.has(node.type)||
    (node.parent!==null&&node.parent!==undefined&&(!ID.test(node.parent)||node.parent===node.id))||
    !vector(node.position,3)||!vector(node.rotation,3)||!vector(node.scale,3)||
    node.scale.some(x=>x<=0)||typeof node.asset!=='string'||node.asset.length>256)
   throw Error('Invalid ERAS scene node');
 return {id:node.id,type:node.type,parent:node.parent??null,
   position:[...node.position],rotation:[...node.rotation],scale:[...node.scale],asset:node.asset};
}
export function createErasSceneEditor({maxNodes=1000,maxHistory=50}={}){
 if(!Number.isSafeInteger(maxNodes)||maxNodes<1||maxNodes>10000||
    !Number.isSafeInteger(maxHistory)||maxHistory<1||maxHistory>200)
   throw Error('Invalid editor limits');
 let nodes=[],undo=[],redo=[];
 const save=()=>{undo.push(clone(nodes));if(undo.length>maxHistory)undo.shift();redo=[];};
 const checkParent=(id,parent)=>{
   if(parent===null)return;
   const seen=new Set([id]);let current=parent;
   while(current!==null){
     if(seen.has(current))throw Error('Scene hierarchy cycle');
     seen.add(current);
     const p=nodes.find(n=>n.id===current);
     if(!p)throw Error('Parent does not exist');
     current=p.parent;
   }
 };
 return Object.freeze({
  add(node){
   const safe=validNode(node);
   if(nodes.length>=maxNodes||nodes.some(n=>n.id===safe.id))throw Error('Node limit or duplicate');
   checkParent(safe.id,safe.parent);save();nodes.push(safe);return clone(safe);
  },
  update(id,patch={}){
   const index=nodes.findIndex(n=>n.id===id);
   if(index<0||!patch||typeof patch!=='object'||Array.isArray(patch)||
     Object.keys(patch).some(k=>!['parent','position','rotation','scale','asset'].includes(k)))
     throw Error('Invalid update');
   const next=validNode({...nodes[index],...patch});
   checkParent(id,next.parent);save();nodes[index]=next;return clone(next);
  },
  remove(id){
   if(!nodes.some(n=>n.id===id))throw Error('Unknown node');
   const removed=new Set([id]);let changed=true;
   while(changed){changed=false;for(const n of nodes)if(n.parent!==null&&removed.has(n.parent)&&!removed.has(n.id)){removed.add(n.id);changed=true;}}
   save();nodes=nodes.filter(n=>!removed.has(n.id));return removed.size;
  },
  undo(){if(!undo.length)return false;redo.push(clone(nodes));nodes=undo.pop();return true;},
  redo(){if(!redo.length)return false;undo.push(clone(nodes));nodes=redo.pop();return true;},
  snapshot(){return {schemaVersion:1,nodes:clone(nodes)};},
 });
}
