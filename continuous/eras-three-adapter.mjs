/**
 * ERAS Three.js adapter for Atlas. Inject the host's THREE namespace and scene.
 * Uses placeholder geometry until a trusted asset loader is wired.
 * This is a real renderer adapter, not an AAA art pipeline.
 */
export function createErasThreeAdapter({THREE,scene,resolveAsset}={}){
 if(!THREE||!scene||typeof scene.add!=='function'||typeof scene.remove!=='function')
   throw Error('Three.js namespace and scene required');
 const objects=new Map();
 const assets=new Map();
 const setTransform=(object,node)=>{
   object.position.set(...node.position);
   object.rotation.set(...node.rotation);
   object.scale.set(...node.scale);
 };
 const make=async node=>{
   if(node.type==='group'||node.type==='terrain')return new THREE.Group();
   if(node.type==='light')return new THREE.DirectionalLight(0xffffff,1);
   if(node.type==='camera')return new THREE.PerspectiveCamera(60,1,.1,1000);
   if(node.type==='audio')return new THREE.Group();
   if(node.asset){
     if(typeof resolveAsset!=='function')throw Error('Trusted asset loader missing');
     const model=await resolveAsset(node.asset);
     if(!model||typeof model.clone!=='function')throw Error('Invalid asset');
     const instance=model.clone(true);
     assets.set(node.id,instance);
     return instance;
   }
   const geometry=new THREE.BoxGeometry(1,1,1);
   const material=new THREE.MeshStandardMaterial({color:0x888888,roughness:.8});
   const mesh=new THREE.Mesh(geometry,material);
   mesh.userData.erasPlaceholder=true;
   return mesh;
 };
 const attach=(object,parent)=>{
   if(parent==null)scene.add(object);
   else {
     const parentObject=objects.get(parent);
     if(!parentObject)throw Error('Parent not created');
     parentObject.object.add(object);
   }
 };
 const disposeOwned=object=>{
   if(object.userData?.erasPlaceholder){
     object.geometry?.dispose?.();
     object.material?.dispose?.();
   }
 };
 return Object.freeze({
   async create(node){
     if(objects.has(node.id))throw Error('Duplicate renderer entity');
     const object=await make(node);
     try{setTransform(object,node);attach(object,node.parent);}
     catch(error){disposeOwned(object);assets.delete(node.id);throw error;}
     objects.set(node.id,{object,node:structuredClone(node)});
   },
   async update(node){
     const entry=objects.get(node.id);
     if(!entry)throw Error('Unknown renderer entity');
     if(node.type!==entry.node.type||node.asset!==entry.node.asset)
       throw Error('Changing entity type or asset requires recreation');
     if(node.parent!==entry.node.parent)attach(entry.object,node.parent);
     setTransform(entry.object,node);
     entry.node=structuredClone(node);
   },
   async destroy(id){
     const entry=objects.get(id);
     if(!entry)return;
     entry.object.parent?.remove(entry.object);
     disposeOwned(entry.object);
     assets.delete(id);
     objects.delete(id);
   },
   getObject(id){return objects.get(id)?.object??null;},
 });
}
