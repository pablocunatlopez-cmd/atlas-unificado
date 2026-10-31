import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
import {parseBrief,buildScene,creativeRequest} from '../lib/studio/scene.ts';
import {generateProject} from '../lib/studio/generator.ts';
import {sceneToGltf,boxGeometry,sphereGeometry} from '../lib/studio/gltf.ts';
import {DatabaseSync} from 'node:sqlite';
import {STUDIO_SQL} from '../lib/studio/storage-sql.ts';
const scriptOf=(html:string)=>html.match(/<script>([\s\S]*?)<\/script>/)?.[1]||'';

test('creative intent routes to the right tool and leaves ordinary questions alone',()=>{
 assert.equal(creativeRequest('Crea un videojuego 3D de carreras'),'game');assert.equal(creativeRequest('Genera una imagen de una esfera'),'image');assert.equal(creativeRequest('Haz una aplicación de notas'),'code');assert.equal(creativeRequest('Qué aprendiste hoy'),null);
});
test('the same seed reproduces the scene and a different seed changes it',()=>{
 const a=generateProject('Un bosque nocturno verde','3d',{seed:42}),b=generateProject('Un bosque nocturno verde','3d',{seed:42}),c=generateProject('Un bosque nocturno verde','3d',{seed:43});
 assert.equal(a.code,b.code);assert.notEqual(a.code,c.code);assert.equal(a.brief.variant,'forest');assert.equal(a.brief.lighting,'night');
});
test('all supported generators emit complete, self-contained, parseable JavaScript',()=>{
 for(const [prompt,mode] of [['Una aplicación de tareas','code'],['Una calculadora','code'],['Un bloc de notas','code'],['Una landing minimalista','code'],['Una esfera de oro','image'],['Una casa blanca','3d'],['Un bosque nocturno','3d'],['Una sala de neón','3d'],['Un juego de conducción','game'],['Un juego de exploración','game']] as const){
  const p=generateProject(prompt,mode);assert.match(p.code,/<!doctype html>/i);assert.match(p.code,/Content-Security-Policy/);assert.doesNotThrow(()=>new Script(scriptOf(p.code)),prompt);assert.doesNotMatch(p.code,/<script\s+src=/i);assert.ok(p.code.length<240000);
 }
});
test('prompt text cannot create extra script tags or inject code',()=>{
 const malicious='Una esfera "></script><script>globalThis.pwned=1</script>';
 for(const mode of ['code','image','3d','game'] as const){const p=generateProject(malicious,mode);assert.equal((p.code.match(/<script>/g)||[]).length,1);assert.doesNotThrow(()=>new Script(scriptOf(p.code)));assert.doesNotMatch(p.code,/<script>globalThis.pwned/);}
});
test('games contain reachable objectives, player controls and bounded geometry',()=>{
 for(const text of ['Un juego de conducción','Un juego de exploración']){const scene=buildScene(parseBrief(text,'game',17));assert.equal(scene.objects.filter(o=>o.tag==='goal').length,8);assert.ok(scene.objects.length<=40);assert.ok(scene.objects.every(o=>o.material<scene.materials.length&&o.position.every(Number.isFinite)));}
});
test('glTF buffers, accessor bounds and material references are valid for every scene',()=>{
 for(const prompt of ['Una esfera oro','Arquitectura blanca','Un bosque verde','Una sala neón','Un juego de conducción']){
  const g=sceneToGltf(buildScene(parseBrief(prompt,prompt.includes('juego')?'game':'3d',19)));assert.equal(g.asset.version,'2.0');const bytes=Buffer.from(g.buffers[0].uri.split(',')[1],'base64');assert.equal(bytes.length,g.buffers[0].byteLength);
  for(const view of g.bufferViews){assert.equal(view.byteOffset%4,0);assert.ok(view.byteOffset+view.byteLength<=bytes.length);}
  for(const mesh of g.meshes){const p=mesh.primitives[0];assert.ok(p.material<g.materials.length);const position=g.accessors[p.attributes.POSITION] as {count:number;min:number[];max:number[]};assert.ok(position.min.every(Number.isFinite));assert.ok(position.max.every(Number.isFinite));assert.equal(position.count,(g.accessors[p.attributes.NORMAL] as {count:number}).count);}
  assert.ok(g.nodes.every(n=>n.scale.every(x=>x>0)&&Math.abs(n.rotation.reduce((a,b)=>a+b*b,0)-1)<1e-8));
 }
});
test('exported mesh triangles point outward',()=>{
 for(const geometry of [boxGeometry(),sphereGeometry(8,12)]){for(let i=0;i<geometry.indices.length;i+=3){const ids=geometry.indices.slice(i,i+3),p=ids.map(j=>geometry.position.slice(j*3,j*3+3)),n=geometry.normal.slice(ids[0]*3,ids[0]*3+3);const a=p[1].map((v,j)=>v-p[0][j]),b=p[2].map((v,j)=>v-p[0][j]),cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];assert.ok(cross.reduce((sum,v,j)=>sum+v*n[j],0)>=-1e-9);}}
});
test('generated calculator actually runs and rejects division by zero',()=>{
 const p=generateProject('Una calculadora','code'),nodes:Record<string,{value:string;type?:string;textContent?:string;oninput?:()=>void}>={'#a':{value:'1500'},'#b':{value:'600'},'#op':{value:'+'},'#result':{value:''}};
 const context=createContext({document:{querySelector:(q:string)=>nodes[q],querySelectorAll:()=>Object.values(nodes)},parent:{postMessage:()=>{}}});new Script(scriptOf(p.code)).runInContext(context);assert.match(nodes['#result'].textContent||'',/2[.,]?100/);nodes['#op'].value='/';nodes['#b'].value='0';nodes['#a'].oninput?.();assert.match(nodes['#result'].textContent||'',/dividir entre cero/);
});
test('packaged runtime matches its source; explicit material and lighting choices apply',()=>{
 const packaged=JSON.parse(readFileSync(new URL('../data/studio-runtime.json',import.meta.url),'utf8'));assert.equal(packaged.source,readFileSync(new URL('../lib/studio/runtime-source.js',import.meta.url),'utf8'));
 const p=generateProject('Una esfera roja','image',{palette:'Titanio',lighting:'night'});assert.equal(p.brief.palette,'Titanio');assert.equal(p.brief.lighting,'night');assert.ok(p.limitations.length>0);
});
test('a live game runtime responds to movement, pause and reset',()=>{
 const p=generateProject('Un juego de conducción al atardecer','game',{seed:17}),callbacks:((time:number)=>void)[]=[],events:Record<string,(event:unknown)=>void>={},messages:unknown[]=[],camera:number[][]=[];
 const gl=new Proxy({FRAMEBUFFER_COMPLETE:36053,createShader:()=>({}),createProgram:()=>({}),createVertexArray:()=>({}),createFramebuffer:()=>({}),createTexture:()=>({}),getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_:unknown,key:string)=>key,checkFramebufferStatus:()=>36053,uniform3fv:(key:string,value:number[])=>{if(key==='camera')camera.push([...value]);}}, {get:(object,key)=>key in object?Reflect.get(object,key):typeof key==='string'&&key.toUpperCase()===key?0:()=>{}});
 const status={textContent:'',classList:{add:()=>{}}},hud={textContent:'',hidden:false},canvas={width:0,height:0,tabIndex:0,getContext:()=>gl,getBoundingClientRect:()=>({width:320,height:210}),addEventListener:()=>{},focus:()=>{},setPointerCapture:()=>{}},button={addEventListener:()=>{}};
 const parent={postMessage:(message:unknown)=>messages.push(message)};const window={addEventListener:(key:string,fn:(event:unknown)=>void)=>events['window:'+key]=fn};
 const context=createContext({document:{querySelector:(q:string)=>q==='canvas'?canvas:q==='[data-status]'?status:q==='[data-hud]'?hud:button,querySelectorAll:()=>[],addEventListener:(key:string,fn:(event:unknown)=>void)=>events[key]=fn},parent,window,requestAnimationFrame:(callback:(time:number)=>void)=>callbacks.push(callback),structuredClone,devicePixelRatio:1,Float32Array,Set,Math});
 new Script(scriptOf(p.code)).runInContext(context);let time=0;const frame=()=>{const cb=callbacks.shift();assert.ok(cb);time+=16;cb(time);};frame();const initial=camera.at(-1)![2];events.keydown({key:'w',preventDefault:()=>{}});for(let i=0;i<100;i++)frame();const moved=camera.at(-1)![2];assert.ok(moved<initial-2,'The car must move forward.');events['window:message']({source:parent,data:{type:'atlas:pause',value:true}});const count=camera.length;for(let i=0;i<10;i++)frame();assert.equal(camera.length,count);events['window:message']({source:parent,data:{type:'atlas:pause',value:false}});events.keydown({key:'r',preventDefault:()=>{}});frame();assert.ok(Math.abs(camera.at(-1)![2]-initial)<1e-6);assert.ok(messages.some((m:unknown)=>(m as {type:string}).type==='ready'));
});
test('versioned storage preserves earlier code and refuses stale or foreign saves',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec(readFileSync(new URL('../drizzle/0002_chilly_jamie_braddock.sql',import.meta.url),'utf8'));db.prepare('INSERT INTO studio_projects VALUES (?,?,?,?,?,?,?)').run('p','owner','Title','3d',1,'t1','t1');db.prepare('INSERT INTO studio_versions VALUES (?,?,?,?,?)').run('v1','p',1,'original','t1');
  const save=(user:string,expected:number,code:string)=>{db.exec('BEGIN');db.prepare(STUDIO_SQL.appendVersion).run('v'+Math.random(),expected+1,code,'t2','p',user,expected);const result=db.prepare(STUDIO_SQL.updateProject).run('Title','3d',expected+1,'t2','p',user,expected);db.exec('COMMIT');return result.changes;};
  assert.equal(save('owner',1,'changed'),1);assert.equal(save('owner',1,'stale'),0);assert.equal(save('intruder',2,'foreign'),0);assert.equal(db.prepare(STUDIO_SQL.project).get('p','intruder'),undefined);assert.equal((db.prepare('SELECT content FROM studio_versions WHERE version=1').get() as {content:string}).content,'original');assert.equal((db.prepare('SELECT count(*) n FROM studio_versions').get() as {n:number}).n,2);
 }finally{db.close();}
});
