import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateSceneDocument,acceptsEngineMessage,engineRequestId} from '../public/eras-engine/scene-document.js';
import {buildErasScene,disposeErasScene} from '../public/eras-engine/scene-adapter.js';

const root=path.resolve(fileURLToPath(new URL('../public/eras-engine/',import.meta.url)));
function scene(){return{brief:{title:'Taller del cuerpo de Lía',mode:'3d',lighting:'sunset',quality:'high',prompt:'private prompt omitted at renderer boundary'},materials:[{color:[.7,.4,.2],roughness:.25,metalness:.65,emission:0}],objects:['box','sphere','cylinder','cone'].map((type,i)=>({type,position:[i*3,2,0],size:[1,2,.5],material:0,yaw:.2,name:type})),camera:[12,8,14],target:[3,1,0],sky:[.6,.35,.2],sun:[-.8,.2,.3],fog:.002,exposure:1.1};}

test('Atlas scene data becomes real ERAS meshes and physical materials with unchanged semiaxes',()=>{
 const result=buildErasScene(scene());assert.equal(result.objects,4);assert.ok(result.triangles>400);assert.equal(result.content.children.length,4);assert.equal(result.camera.type,'PerspectiveCamera');
 const types=['BoxGeometry','SphereGeometry','CylinderGeometry','ConeGeometry'];
 for(const [i,mesh]of result.content.children.entries()){assert.equal(mesh.geometry.type,types[i]);assert.equal(mesh.material.type,'MeshStandardMaterial');assert.equal(mesh.material.roughness,.25);assert.equal(mesh.material.metalness,.65);assert.equal(mesh.castShadow,true);assert.equal(mesh.receiveShadow,true);assert.deepEqual(mesh.scale.toArray(),[1,2,.5]);assert.deepEqual(mesh.position.toArray(),[i*3,2,0]);mesh.geometry.computeBoundingBox();assert.equal(mesh.geometry.boundingBox.max.y,1);assert.equal(mesh.geometry.boundingBox.min.y,-1);}
 assert.deepEqual(result.camera.position.toArray(),scene().camera);assert.equal(result.document.lighting,'sunset');disposeErasScene(result.scene);
});
test('interchange keeps bounded scene data while discarding code, URLs and private brief text',()=>{
 const raw=scene();raw.code='window.parent.fetch(secret)';raw.objects[0].script='eval(secret)';raw.materials[0].map='https://example.invalid/private';
 const data=validateSceneDocument(raw);assert.equal(data.engine,'ERAS');assert.equal(data.title,raw.brief.title);assert.doesNotMatch(JSON.stringify(data),/secret|eval|https:|private prompt/);assert.deepEqual(validateSceneDocument(data),data);
 for(const mutate of [s=>s.objects[0].type='javascript',s=>s.objects[0].size[1]=NaN,s=>s.objects[0].material=9,s=>s.materials[0].color[0]=2,s=>s.camera=[...s.target],s=>s.sun=[0,0,0]]){const s=scene();mutate(s);assert.throws(()=>validateSceneDocument(s));}
 const max=scene();max.objects=Array.from({length:256},()=>({...max.objects[0]}));assert.equal(validateSceneDocument(max).objects.length,256);max.objects.push({...max.objects[0]});assert.throws(()=>validateSceneDocument(max),/256/);
});
test('invalid replacements fail before mutating or disposing the active scene',()=>{
 const before=buildErasScene(scene()),first=before.content.children[0],bad=scene();bad.objects[0].size[1]=Infinity;let disposed=false;first.geometry.addEventListener('dispose',()=>disposed=true);assert.throws(()=>buildErasScene(bad));assert.equal(before.content.children[0],first);assert.equal(disposed,false);const result=disposeErasScene(before.scene);assert.ok(result.geometries>=4);assert.equal(result.materials,2);assert.equal(disposed,true);assert.equal(before.scene.children.length,0);
});
test('only the same-origin parent can issue bounded renderer commands',()=>{
 const parent={};assert.equal(acceptsEngineMessage({source:parent,origin:'https://atlas.test',data:{type:'atlas:eras:load'}},parent,'https://atlas.test'),true);
 for(const event of [{source:{},origin:'https://atlas.test',data:{type:'atlas:eras:load'}},{source:parent,origin:'https://other.test',data:{type:'atlas:eras:load'}},{source:parent,origin:'https://atlas.test',data:{type:'eval'}}])assert.equal(acceptsEngineMessage(event,parent,'https://atlas.test'),false);
 assert.equal(engineRequestId('project-revision-42'),'project-revision-42');for(const value of ['',null,'x'.repeat(121),'bad\nrequest'])assert.throws(()=>engineRequestId(value));
});
test('ERAS renderer dependencies retain exact source provenance and local module imports resolve',async()=>{
 const provenance=JSON.parse(await readFile(path.join(root,'provenance.json'),'utf8'));assert.equal(provenance.engine,'ERAS');assert.match(provenance.commit,/^[a-f0-9]{40}$/);assert.ok(provenance.files.some(f=>f.path==='render-engine.js'));assert.ok(provenance.files.some(f=>f.path==='gpu-renderer.js'));assert.ok(provenance.files.some(f=>f.path==='vendor/THREE-LICENSE.txt'));
 for(const file of provenance.files){const bytes=await readFile(path.join(root,file.path));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);if(!file.path.endsWith('.js'))continue;const source=bytes.toString().replace(/\/\*[\s\S]*?\*\//g,'');for(const match of source.matchAll(/(?:from\s*|import\s*\()(['"])(\.[^'"]+)\1/g)){const dep=path.resolve(root,path.dirname(file.path),match[2].split('?')[0]);assert.ok(dep.startsWith(root+path.sep)||dep===root);await readFile(dep);}}
 const runtime=await readFile(path.join(root,'runtime.js'),'utf8'),html=await readFile(path.join(root,'index.html'),'utf8');assert.doesNotMatch(runtime,/\beval\s*\(|new\s+Function\s*\(/);assert.doesNotMatch(html,/unsafe-eval|https?:\/\//);assert.match(runtime,/Math\.min\(devicePixelRatio\|\|1,mobile\?1\.25:1\.5\)/);
});
