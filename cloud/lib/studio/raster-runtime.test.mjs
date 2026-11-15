import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./runtime-source.js',import.meta.url),'utf8');
function fixture({fallback=false,width=390,height=844,game=false,objectTypes=['sphere'],camera=[6,4,8]}={}){
 const calls={contexts:[],draws:[],matrices:[],camera:[],shaders:[],deleted:0},events={},callbacks=[],messages=[];let bufferId=0;
 const gl=new Proxy({VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,LINK_STATUS:35714,NO_ERROR:0,
  createShader:type=>({type}),shaderSource:(shader,text)=>calls.shaders.push({type:shader.type,text}),createProgram:()=>({}),getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_,key)=>key,getAttribLocation:(_,key)=>key==='vertexPosition'?0:1,
  createBuffer:()=>({id:++bufferId}),bufferData:(_,data)=>assert.ok(data.every(Number.isFinite)),drawArrays:(_,first,count)=>calls.draws.push(count),getError:()=>0,
  uniform3fv:(key,value)=>{assert.ok(value.every(Number.isFinite));if(key==='camera')calls.camera.push([...value]);},uniformMatrix4fv:(_,transpose,value)=>{assert.equal(transpose,false);assert.ok([...value].every(Number.isFinite));calls.matrices.push([...value]);},
  createFramebuffer:()=>{throw Error('Raster must not allocate framebuffers');},createTexture:()=>{throw Error('Raster must not allocate accumulation textures');},deleteBuffer:()=>calls.deleted++,
 },{get:(target,key)=>key in target?target[key]:typeof key==='string'&&key.toUpperCase()===key?0:()=>{}});
 const target=(prefix,extras={})=>({addEventListener:(name,fn)=>events[prefix+name]=fn,removeEventListener:(name)=>delete events[prefix+name],...extras});
 const canvas=target('canvas:',{width:0,height:0,getContext:kind=>{calls.contexts.push(kind);return kind==='webgl2'&&fallback?null:gl;},getBoundingClientRect:()=>({width,height}),focus:()=>{},setPointerCapture:()=>{},toDataURL:()=> 'data:image/png;base64,verified-frame'});
 const status={textContent:'',classList:{add:()=>{},remove:()=>{}}},hud={textContent:'',hidden:false};
 const parent={postMessage:value=>messages.push(value)},window=target('window:'),document=target('document:',{hidden:false,querySelector:selector=>selector==='canvas'?canvas:selector==='[data-status]'?status:selector==='[data-hud]'?hud:null,querySelectorAll:()=>[]});
 const objects=[...objectTypes.map((type,i)=>({type,position:[i*3,1,0],size:[1,1,1],material:1,yaw:.4})),...(game?[{type:'sphere',position:[0,.7,-3],size:[.3,.3,.3],material:1,yaw:0,tag:'goal'}]:[])];
 const scene={brief:{mode:game?'game':'3d',variant:game?'exploration':'gallery'},objects,materials:[{color:[.5,.5,.5],roughness:.8,metalness:0,emission:0},{color:[.8,.55,.1],roughness:.2,metalness:.8,emission:0}],camera,target:[0,1,0],sky:[.7,.43,.25],sun:[-.85,.2,.35],fog:.005,exposure:1};
 const context=vm.createContext({document,window,parent,structuredClone,devicePixelRatio:3,requestAnimationFrame:callback=>{callbacks.push(callback);return callbacks.length;},cancelAnimationFrame:()=>{}});
 vm.runInContext(source+'\natlasRuntime('+JSON.stringify({scene})+');',context);
 let now=0;const frame=(dt=16)=>{const callback=callbacks.shift();assert.ok(callback,'one animation callback remains scheduled');now+=dt;callback(now);};
 return {calls,events,messages,canvas,status,hud,parent,window,document,context,frame};
}
test('all raster triangles have finite positions, outward normals and bounded geometry',()=>{
 const context=vm.createContext({});vm.runInContext(source,context);
 for(const type of ['box','sphere','cylinder','cone','disc']){
  const geometry=vm.runInContext('atlasRasterGeometry('+JSON.stringify(type)+')',context);
  assert.equal(geometry.position.length,geometry.normal.length);assert.ok(geometry.position.every(Number.isFinite));assert.ok(geometry.normal.every(Number.isFinite));assert.ok(geometry.count<=1296);
  for(let i=0;i<geometry.position.length;i+=9){const p=Array.from({length:3},(_,j)=>Array.from(geometry.position.slice(i+j*3,i+j*3+3))),n=Array.from(geometry.normal.slice(i,i+3)),a=p[1].map((v,j)=>v-p[0][j]),b=p[2].map((v,j)=>v-p[0][j]),cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];assert.ok(cross.reduce((sum,v,j)=>sum+v*n[j],0)>=-1e-6,type+' face points outward');}
 }
});
test('cylinder and cone scenes allocate and draw their curved mesh buffers',()=>{
 const value=fixture({objectTypes:['cylinder','cone']});value.frame();
 assert.ok(value.messages.some(m=>m.type==='ready'&&m.objects===2));assert.ok(!value.messages.some(m=>m.type==='error'));
 const cylinder=vm.runInContext("atlasRasterGeometry('cylinder').count",value.context),cone=vm.runInContext("atlasRasterGeometry('cone').count",value.context);
 assert.notEqual(cylinder,cone);assert.ok(cylinder>36&&cone>36);assert.ok(value.calls.draws.includes(cylinder));assert.ok(value.calls.draws.includes(cone));
});
test('perspective camera centres the target, clips the rear and handles vertical views',()=>{
 const context=vm.createContext({});vm.runInContext(source,context);
 const matrix=Array.from(vm.runInContext('atlasRasterCamera([0,0,5],[0,0,0],1)',context)),project=p=>Array.from({length:4},(_,r)=>p.reduce((sum,v,c)=>sum+v*matrix[c*4+r],0));
 const centre=project([0,0,0,1]),rear=project([0,0,6,1]);assert.ok(Math.abs(centre[0])+Math.abs(centre[1])<1e-6);assert.ok(centre[3]>0);assert.ok(centre[2]/centre[3]>-1&&centre[2]/centre[3]<1);assert.ok(rear[3]<0);
 assert.ok(vm.runInContext('Array.from(atlasRasterCamera([0,5,0],[0,0,0],.46)).every(Number.isFinite)',context));
});
test('WebGL1 fallback draws actual meshes without the former framebuffer/ray pipeline',()=>{
 const value=fixture({fallback:true});value.frame();assert.deepEqual(value.calls.contexts,['webgl2','webgl']);assert.ok(value.calls.draws.length>=3);assert.ok(value.messages.some(m=>m.type==='ready'&&m.renderer==='raster'&&/WebGL 1/.test(m.message)));assert.ok(value.canvas.width<=640);assert.ok(value.canvas.width*value.canvas.height<=902000);assert.ok(value.calls.shaders.every(s=>!s.text.includes('#version 300 es')));assert.ok(value.calls.shaders.find(s=>s.type===35632).text.includes('gl_FragColor'));
 const rendered=value.calls.draws.length;for(let i=0;i<30;i++)value.frame();assert.equal(value.calls.draws.length,rendered,'static scenes sleep after one valid frame');
});
test('WebGL2 shaders use the matching dialect and project game movement, pause and reset',()=>{
 const value=fixture({game:true});value.frame();assert.ok(value.calls.shaders.every(s=>s.text.startsWith('#version 300 es')));assert.ok(value.calls.shaders.find(s=>s.type===35632).text.includes('out vec4 rasterColor;'));assert.ok(!value.calls.shaders.find(s=>s.type===35632).text.includes('gl_FragColor'));
 const initial=value.calls.camera.at(-1)[2];value.events['document:keydown']({key:'w',preventDefault(){}});for(let i=0;i<60;i++)value.frame();assert.ok(value.calls.camera.at(-1)[2]<initial-2);
 value.events['window:message']({source:value.parent,data:{type:'atlas:pause',value:true}});const draws=value.calls.draws.length;for(let i=0;i<10;i++)value.frame();assert.equal(value.calls.draws.length,draws);
 value.events['window:message']({source:value.parent,data:{type:'atlas:pause',value:false}});value.events['document:keydown']({key:'r',preventDefault(){}});value.frame();assert.ok(Math.abs(value.calls.camera.at(-1)[2]-initial)<1e-8);
});
test('snapshot messages, hidden time and disposal preserve the embedding contract',()=>{
 const value=fixture({game:true});value.frame();value.events['window:message']({source:value.parent,data:{type:'atlas:snapshot'}});assert.ok(value.messages.some(m=>m.type==='snapshot'&&m.data.startsWith('data:image/png')));
 const camera=value.calls.camera.at(-1);value.document.hidden=true;value.events['document:visibilitychange']();value.events['document:keydown']({key:'w',preventDefault(){}});for(let i=0;i<100;i++)value.frame(1000);value.document.hidden=false;value.events['document:visibilitychange']();value.frame();assert.deepEqual(value.calls.camera.at(-1),camera,'hidden time never teleports the player or advances a hidden game');
 value.events['window:message']({source:value.parent,data:{type:'atlas:dispose'}});assert.equal(value.calls.deleted,10);const draws=value.calls.draws.length;value.frame();assert.equal(value.calls.draws.length,draws);
});
test('two-finger pinch changes the orbit distance and single-finger dragging changes the view',()=>{
 const value=fixture();value.frame();const first=value.calls.camera.at(-1),event=(pointerId,clientX,clientY)=>({pointerId,clientX,clientY,button:0,shiftKey:false});
 value.events['canvas:pointerdown'](event(1,100,100));value.events['canvas:pointerdown'](event(2,200,100));value.events['canvas:pointermove'](event(2,300,100));value.frame();const zoomed=value.calls.camera.at(-1);assert.ok(Math.hypot(...zoomed.map((n,i)=>n-[0,1,0][i]))<Math.hypot(...first.map((n,i)=>n-[0,1,0][i])));
 value.events['canvas:pointerup'](event(1,100,100));value.events['canvas:pointerup'](event(2,300,100));value.events['canvas:pointerdown'](event(3,100,100));value.events['canvas:pointermove'](event(3,140,100));value.frame();assert.notDeepEqual(value.calls.camera.at(-1),zoomed);assert.ok(value.calls.camera.at(-1).every(Number.isFinite));
});
test('zoom preserves the fitted distance of large authored scenes and stays bounded',()=>{
 const value=fixture({camera:[0,10,100]}),distance=()=>Math.hypot(...value.calls.camera.at(-1).map((n,i)=>n-[0,1,0][i]));value.frame();const initial=distance();
 value.events['canvas:wheel']({deltaY:1,preventDefault(){}});value.frame();assert.ok(distance()>initial,'the first zoom step must not snap a large fitted camera inward');
 for(let i=0;i<10;i++){value.events['canvas:wheel']({deltaY:100,preventDefault(){}});value.frame();}assert.ok(Math.abs(distance()-140)<1e-8);
 const event=(pointerId,clientX)=>({pointerId,clientX,clientY:100,button:0,shiftKey:false});value.events['canvas:pointerdown'](event(1,100));value.events['canvas:pointerdown'](event(2,300));value.events['canvas:pointermove'](event(1,150));value.events['canvas:pointermove'](event(2,250));value.frame();assert.ok(Math.abs(distance()-140)<1e-8);
});
