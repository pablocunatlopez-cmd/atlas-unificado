/**
 * ERAS renderer preflight validation. Validates declarative scene snapshots
 * and asset references before renderer reconciliation.
 */
const TYPES=new Set(['group','mesh','character','light','camera','terrain','audio']);
const ID=/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const vec=v=>Array.isArray(v)&&v.length===3&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e6);
export function validateErasRenderSnapshot(snapshot,registry,{maxNodes=1000}={}){
 if(!snapshot||snapshot.schemaVersion!==1||!Array.isArray(snapshot.nodes)||
   snapshot.nodes.length>maxNodes||!registry||typeof registry.validateReferences!=='function')
   throw Error('Invalid render snapshot');
 const byId=new Map();
 for(const n of snapshot.nodes){
   if(!n||typeof n.id!=='string'||!ID.test(n.id)||byId.has(n.id)||
      !TYPES.has(n.type)||!vec(n.position)||!vec(n.rotation)||!vec(n.scale)||
      n.scale.some(x=>x<=0)||typeof n.asset!=='string'||n.asset.length>256||
      (n.parent!=null&&(typeof n.parent!=='string'||!ID.test(n.parent))))
     throw Error('Invalid ERAS node');
   byId.set(n.id,n);
 }
 for(const n of snapshot.nodes){
   const seen=new Set([n.id]);let p=n.parent??null;
   while(p!==null){
     if(seen.has(p))throw Error('Scene cycle');
     seen.add(p);const parent=byId.get(p);
     if(!parent)throw Error('Missing scene parent');
     p=parent.parent??null;
   }
 }
 const assets=registry.validateReferences(snapshot.nodes);
 if(!assets.valid)throw Error('Unregistered scene assets: '+assets.missing.map(x=>x.assetId).join(','));
 return {valid:true,nodeCount:byId.size};
}
