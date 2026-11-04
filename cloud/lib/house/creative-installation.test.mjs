import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../public/house/vendor/three.module.js';
import {createCreativeInstallation,describeCreativeInstallation} from '../../public/house/creative-installation.js';

const at='2026-11-02T09:00:00.000Z';
function state(changes={}){
 return {artifactId:'creative-'+'a'.repeat(24),at,cases:6,passed:6,executed:true,invariantsPreserved:true,renderVerified:false,evidenceHash:'b'.repeat(64),plan:{version:1,title:'Private title must never be copied',design:'Private reasoning must never be copied',variant:'gallery',lighting:'day',palette:'Oro',objects:[{type:'box',position:[-2,1,0],size:[.6,1,.5],material:5,yaw:Math.PI/4},{type:'sphere',position:[2,1.2,.6],size:[.4,.7,.6],material:2,yaw:-.2}]},...changes};
}
function fixture(t){const scene=new THREE.Scene(),installation=createCreativeInstallation(scene);t.after(()=>installation.dispose());return {scene,installation,root:scene.getObjectByName('atlas-house-evolution')};}
function sourceMeshes(root){const meshes=[];root.traverse(object=>{if(object.isMesh&&object.userData.sourceKind==='qwen-plan')meshes.push(object);});return meshes;}
function trackResources(root){const resources=new Set(),counts=new Map();root.traverse(object=>{if(object.geometry)resources.add(object.geometry);if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])resources.add(material);});for(const resource of resources){counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));}return counts;}
function fittedBounds(description){
 for(const installation of description.installations){
  const [x,y,z]=installation.anchor,[w,h,d]=installation.volume,min=[x-w/2,y,z-d/2],max=[x+w/2,y+h,z+d/2];
  let floor=Infinity;
  for(const object of installation.objects){const c=Math.abs(Math.cos(object.yaw)),s=Math.abs(Math.sin(object.yaw)),half=[c*object.size[0]+s*object.size[2],object.size[1],s*object.size[0]+c*object.size[2]];
   for(let axis=0;axis<3;axis++){assert.ok(object.position[axis]-half[axis]>=min[axis]-1e-8);assert.ok(object.position[axis]+half[axis]<=max[axis]+1e-8);}floor=Math.min(floor,object.position[1]-half[1]);
  }
  assert.ok(Math.abs(floor-y)<1e-8,'lowest source extent reaches the installation floor');
 }
}

test('a real public plan becomes two geometry installations inside the same house scene',t=>{
 const {scene,installation,root}=fixture(t),source=state(),before=structuredClone(source);
 const result=installation.setState(source);assert.equal(result.accepted,true);assert.equal(result.updated,true);assert.equal(result.applied,true);assert.equal(result.instances,2);assert.equal(result.objects,2);assert.equal(result.cases,6);assert.equal(result.passed,6);assert.equal(result.renderVerified,false);assert.equal(result.learningChange,false);
 const meshes=sourceMeshes(root);assert.equal(meshes.length,4);assert.ok(scene.getObjectByName('atlas-house-evolution-maquette'));assert.ok(scene.getObjectByName('atlas-house-evolution-terrace'));assert.ok(scene.getObjectByName('atlas-house-evolution-terrace-base'));assert.ok(scene.getObjectByName('atlas-house-evolution-terrace-header'));
 assert.deepEqual(source,before);assert.equal(root.userData.artifactId,source.artifactId);assert.equal(root.userData.evidenceHash,source.evidenceHash);assert.match(result.scope,/no demuestra mejora visual/);
});

test('both representations share primitive geometry and material resources from one source',t=>{
 const {installation,root}=fixture(t);installation.setState(state());
 const a=root.getObjectByName('atlas-house-evolution-maquette-object-0'),b=root.getObjectByName('atlas-house-evolution-terrace-object-0'),sphereA=root.getObjectByName('atlas-house-evolution-maquette-object-1'),sphereB=root.getObjectByName('atlas-house-evolution-terrace-object-1');
 assert.equal(a.geometry,b.geometry);assert.equal(a.material,b.material);assert.equal(sphereA.geometry,sphereB.geometry);assert.equal(sphereA.material,sphereB.material);assert.notEqual(a.geometry,sphereA.geometry);
 assert.ok(a.material.metalness>.7);assert.ok(a.material.roughness<=.3);assert.equal(a.userData.sourceIndex,b.userData.sourceIndex);
});

test('rotated conservative AABBs are uniformly fitted with the lowest point at each fixed floor',()=>{
 const data=state();data.plan.objects=[{type:'box',position:[-20,2.6,-20],size:[3,2.6,.1],material:9,yaw:Math.PI/3},{type:'sphere',position:[23,6.5,23],size:[.4,1.2,.7],material:1,yaw:-Math.PI/4}];
 const description=describeCreativeInstallation(data);assert.ok(description);fittedBounds(description);
 assert.deepEqual(description.installations.map(item=>item.anchor),[[7.5,.94,6.5],[7.8,.2,10.35]]);assert.deepEqual(description.installations.map(item=>item.volume),[[2.05,1.15,1.3],[6,2.4,2.3]]);
 for(const installation of description.installations)for(let index=0;index<data.plan.objects.length;index++){const original=data.plan.objects[index],fitted=installation.objects[index];assert.equal(fitted.yaw,original.yaw);for(let axis=0;axis<3;axis++)assert.ok(Math.abs(fitted.size[axis]/original.size[axis]-installation.scale)<1e-10);}
});

test('actual Three.js bounds remain inside the fitting volume and the terrace leaves the entry corridor clear',t=>{
 const {scene,installation,root}=fixture(t);installation.setState(state());scene.updateMatrixWorld(true);
 const description=describeCreativeInstallation(state());
 for(const placement of description.installations){for(let index=0;index<placement.objects.length;index++){const mesh=root.getObjectByName('atlas-house-evolution-'+placement.id+'-object-'+index),box=new THREE.Box3().setFromObject(mesh),[x,y,z]=placement.anchor,[w,h,d]=placement.volume;assert.ok(box.min.x>=x-w/2-1e-7);assert.ok(box.max.x<=x+w/2+1e-7);assert.ok(box.min.y>=y-1e-7);assert.ok(box.max.y<=y+h+1e-7);assert.ok(box.min.z>=z-d/2-1e-7);assert.ok(box.max.z<=z+d/2+1e-7);}}
 const terrace=new THREE.Box3().setFromObject(root.getObjectByName('atlas-house-evolution-terrace'));assert.ok(terrace.min.x>1.5);assert.ok(terrace.max.z<=12.8);assert.ok(terrace.min.z>8.15);
});

test('same content with a new artifact receipt updates provenance without reallocating geometry',t=>{
 const {installation,root}=fixture(t);installation.setState(state());const content=root.children[0],resources=trackResources(root),matrices=sourceMeshes(root).map(mesh=>mesh.matrix.clone());
 const next=state({artifactId:'creative-'+'c'.repeat(24),at:'2026-11-02T10:00:00Z',evidenceHash:'d'.repeat(64)}),result=installation.setState(next);
 assert.equal(result.accepted,true);assert.equal(result.updated,false);assert.equal(root.children[0],content);assert.equal(result.at,'2026-11-02T10:00:00.000Z');assert.equal(result.artifactId,next.artifactId);assert.equal(root.userData.artifactId,next.artifactId);assert.ok([...resources.values()].every(count=>count===0));
 assert.deepEqual(sourceMeshes(root).map(mesh=>mesh.matrix.elements),matrices.map(matrix=>matrix.elements));
});

test('an older bootstrap or heartbeat cannot roll back the installed revision; timestamp ties accept incoming content',t=>{
 const {installation,root}=fixture(t);installation.setState(state());const content=root.children[0],before=installation.status(),resources=trackResources(root);
 const older=state({artifactId:'creative-'+'e'.repeat(24),at:'2026-11-02T08:59:59.999Z'});older.plan.palette='Azul';
 const rejected=installation.setState(older);assert.equal(rejected.accepted,false);assert.equal(rejected.updated,false);assert.equal(root.children[0],content);assert.deepEqual(installation.status(),before);assert.ok([...resources.values()].every(count=>count===0));
 const tie=state({artifactId:'creative-'+'f'.repeat(24)});tie.plan.palette='Verde';const accepted=installation.setState(tie);
 assert.equal(accepted.accepted,true);assert.equal(accepted.updated,true);assert.equal(accepted.artifactId,tie.artifactId);assert.notEqual(root.children[0],content);assert.ok([...resources.values()].every(count=>count===1));
});

test('a reused external hash cannot hide changed geometry, and the old revision is completely disposed',t=>{
 const {installation,root}=fixture(t);installation.setState(state());const content=root.children[0],resources=trackResources(root),before=sourceMeshes(root).map(mesh=>mesh.matrix.elements.slice()),next=state();next.plan.objects[0].size[0]=1.5;
 const result=installation.setState(next);assert.equal(result.updated,true);assert.notEqual(root.children[0],content);assert.equal(root.children.length,1);assert.ok([...resources.values()].every(count=>count===1));assert.notDeepEqual(sourceMeshes(root).map(mesh=>mesh.matrix.elements),before);
});

test('invalid, empty or disconnected snapshots preserve the last accepted installation',t=>{
 const {installation,root}=fixture(t);installation.setState(state());const content=root.children[0],before=installation.status();
 for(const value of [null,undefined,false,{}, {connected:false,creative:null},state({executed:false}),state({artifactId:'../../private'}),state({at:null})]){const result=installation.setState(value);assert.equal(result.accepted,false);assert.equal(result.updated,false);assert.deepEqual(installation.status(),before);assert.equal(root.children[0],content);}
});

test('a resource-construction failure leaves the accepted revision intact and releases the partial replacement',t=>{
 const {installation,root}=fixture(t);installation.setState(state());const content=root.children[0],before=installation.status(),oldResources=trackResources(root);
 const add=THREE.Object3D.prototype.add,disposeGeometry=THREE.BufferGeometry.prototype.dispose,disposeMaterial=THREE.Material.prototype.dispose;let releasedGeometry=0,releasedMaterial=0;
 try{
  THREE.Object3D.prototype.add=function(...objects){if(objects.some(object=>object.name.endsWith('-object-1')))throw Error('simulated construction failure');return add.apply(this,objects);};
  THREE.BufferGeometry.prototype.dispose=function(){releasedGeometry++;return disposeGeometry.call(this);};THREE.Material.prototype.dispose=function(){releasedMaterial++;return disposeMaterial.call(this);};
  const next=state();next.plan.palette='Azul';const result=installation.setState(next);
  assert.equal(result.accepted,false);assert.equal(root.children[0],content);assert.deepEqual(installation.status(),before);assert.ok(releasedGeometry>0);assert.ok(releasedMaterial>0);assert.ok([...oldResources.values()].every(count=>count===0));
 }finally{THREE.Object3D.prototype.add=add;THREE.BufferGeometry.prototype.dispose=disposeGeometry;THREE.Material.prototype.dispose=disposeMaterial;}
});

test('only complete bounded geometric receipts and valid public timestamps can be installed',()=>{
 const bad=[state({cases:5}),state({passed:7}),state({invariantsPreserved:false}),state({renderVerified:true}),state({artifactId:'creative-'+'A'.repeat(24)}),state({artifactId:'creative-'+'a'.repeat(25)}),state({at:'2026-02-30T10:00:00Z'}),state({at:'2026-11-02T25:00:00Z'}),state({at:'3'}),state({evidenceHash:'not-a-content-hash'})];
 for(const value of bad)assert.equal(describeCreativeInstallation(value),null);
 const valid=state({at:'2026-11-02T10:00:00+01:00'});assert.equal(describeCreativeInstallation(valid).at,at);delete valid.evidenceHash;assert.equal(describeCreativeInstallation(valid).evidenceHash,null);
});

test('malformed shapes, nonfinite vectors, sparse vectors and unsafe geometry are rejected before scene allocation',t=>{
 const {installation,root}=fixture(t);const source=state(),shape=source.plan.objects[0];
 const invalid=[{...shape,type:'gltf',url:'https://example.org/asset.glb'},{...shape,position:[NaN,1,0]},{...shape,position:new Array(3)},{...shape,position:[25,1,0]},{...shape,position:[0,9,0]},{...shape,position:[0,.5,0],size:[1,1,1]},{...shape,size:[.01,1,1]},{...shape,material:12},{...shape,material:'1'},{...shape,yaw:Infinity},{...shape,yaw:Math.PI+.1}];
 for(const object of invalid){const value=state();value.plan.objects=[object];assert.equal(describeCreativeInstallation(value),null);assert.equal(installation.setState(value).accepted,false);assert.equal(root.children.length,0);}
 for(const objects of [[],Array.from({length:9},()=>shape)]){const value=state();value.plan.objects=objects;assert.equal(describeCreativeInstallation(value),null);}
});

test('plan names, palettes and lighting are closed sets with no executable or private text propagation',t=>{
 const {installation,root}=fixture(t);
 for(const changes of [{version:2},{variant:'script'},{lighting:'custom'},{palette:'constructor'},{palette:'url(javascript:alert(1))'}]){const value=state();Object.assign(value.plan,changes);assert.equal(describeCreativeInstallation(value),null);}
 const value=state();value.program='globalThis.atlasHouseCodeWasExecuted=true';value.path='private/source/plan.json';value.plan.title='<img src=x onerror=alert(1)>';value.plan.design='private-personal-prompt';
 const result=installation.setState(value);assert.equal(result.accepted,true);assert.equal(globalThis.atlasHouseCodeWasExecuted,undefined);assert.doesNotMatch(JSON.stringify(result),/private|onerror|program/);assert.doesNotMatch(JSON.stringify(root.userData),/private|onerror/);
 const description=describeCreativeInstallation(value);assert.equal(Object.hasOwn(description,'title'),false);assert.equal(Object.hasOwn(description,'design'),false);assert.equal(Object.hasOwn(description,'path'),false);
});

test('all canonical material indices are supported without loading textures or adding global lighting',t=>{
 const {scene,installation,root}=fixture(t),ambient=new THREE.AmbientLight();scene.add(ambient);
 for(let material=0;material<12;material++){const value=state();value.plan.objects=[{...value.plan.objects[0],material}];const result=installation.setState(value);assert.equal(result.accepted,true);const mesh=sourceMeshes(root)[0];assert.equal(mesh.material.isMeshStandardMaterial,true);assert.equal(mesh.material.map,null);assert.equal(mesh.material.envMap,null);assert.ok(mesh.material.roughness>=0&&mesh.material.roughness<=1);assert.ok(mesh.material.metalness>=0&&mesh.material.metalness<=1);}
 let lights=0;scene.traverse(object=>{if(object.isLight)lights++;});assert.equal(lights,1);assert.equal(scene.children.includes(ambient),true);
});

test('eight spheres stay within a small shared geometry and draw-call budget',t=>{
 const {installation,root}=fixture(t),value=state();value.plan.objects=Array.from({length:8},(_,index)=>({type:'sphere',position:[index-4,.6+(index%2)*.5,index%3-1],size:[.3,.6,.3],material:index,yaw:index*.1}));
 assert.equal(installation.setState(value).accepted,true);let meshes=0,lines=0,triangles=0;const geometries=new Set();root.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.isMesh){meshes++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;}if(object.isLineSegments)lines++;});
 assert.equal(sourceMeshes(root).length,16);assert.ok(meshes<=21);assert.equal(lines,1);assert.ok(geometries.size<=3);assert.ok(triangles<5000);
});

test('disposing releases every shared resource exactly once and keeps unrelated scene objects intact',()=>{
 const scene=new THREE.Scene(),outside=new THREE.Group();scene.add(outside);const installation=createCreativeInstallation(scene);installation.setState(state());const root=scene.getObjectByName('atlas-house-evolution'),resources=trackResources(root);
 installation.dispose();assert.deepEqual(scene.children,[outside]);assert.ok([...resources.values()].every(count=>count===1));assert.equal(installation.status().applied,false);assert.equal(installation.status().disposed,true);
 installation.dispose();assert.ok([...resources.values()].every(count=>count===1));assert.equal(installation.setState(state()).accepted,false);assert.deepEqual(scene.children,[outside]);
});

test('reconstruction from the persisted public plan produces the same fitted house geometry',t=>{
 const first=fixture(t),second=fixture(t),publicPlan=JSON.parse(JSON.stringify(state()));first.installation.setState(publicPlan);second.installation.setState(JSON.parse(JSON.stringify(publicPlan)));
 assert.deepEqual(first.installation.status(),second.installation.status());assert.deepEqual(sourceMeshes(first.root).map(mesh=>({name:mesh.name,matrix:mesh.matrix.elements})),sourceMeshes(second.root).map(mesh=>({name:mesh.name,matrix:mesh.matrix.elements})));
});
