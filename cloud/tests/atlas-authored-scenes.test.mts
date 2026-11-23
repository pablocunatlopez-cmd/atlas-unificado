import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCreativePlan,creativePlanPrompt} from '../lib/creative/plan.mjs';
import {generateProject} from '../lib/studio/generator.ts';
import {buildScene,parseBrief} from '../lib/studio/scene.ts';
import {sceneToGltf} from '../lib/studio/gltf.ts';

const pavilion={version:2,title:'Pabellón abierto',variant:'architecture',lighting:'sunset',palette:'Blanco',materials:[{color:[.13,.35,.42],roughness:.3,metalness:.5,emission:0}],objects:[
 {name:'Pavimento',type:'cylinder',position:[0,.12,0],size:[5,.12,5],material:8,yaw:0},
 {name:'Columna izquierda',type:'cylinder',position:[-3,2,-3],size:[.2,2,.2],material:12,yaw:0},
 {name:'Columna derecha',type:'cylinder',position:[3,2,-3],size:[.2,2,.2],material:12,yaw:0},
 {name:'Cubierta cónica',type:'cone',position:[0,4.8,0],size:[5,.8,5],material:12,yaw:0},
]};
const object={type:'box',position:[0,1,0],size:[1,1,1],material:1,yaw:0};

test('authored plans replace the preset and different requests produce different exported geometry',()=>{
 const p=generateProject('Construye un pabellón circular','3d',{seed:11,plan:pavilion});
 const scene=buildScene(p.brief);
 assert.equal(scene.objects.length,pavilion.objects.length);
 assert.deepEqual(scene.objects.map(o=>o.name),pavilion.objects.map(o=>o.name));
 assert.deepEqual(scene.objects.map(o=>o.type),['cylinder','cylinder','cylinder','cone']);
 assert.equal(scene.materials.length,13);assert.deepEqual(scene.materials[12].color,[.13,.35,.42]);
 const bridge={...pavilion,title:'Puente recto',objects:[{...object,name:'Tablero',position:[0,3,0],size:[10,.2,2]},{...object,name:'Pilar',position:[-6,1.5,0],size:[.5,1.5,.5]}]};
 const alternate=buildScene(generateProject('Construye un puente horizontal','3d',{seed:11,plan:bridge}).brief);
 assert.equal(alternate.objects.length,2);
 assert.notDeepEqual(scene.objects,alternate.objects);
 const a=sceneToGltf(scene),b=sceneToGltf(alternate);
 assert.notDeepEqual(a.nodes.map(n=>[n.translation,n.scale]),b.nodes.map(n=>[n.translation,n.scale]));
 assert.equal(a.nodes[4].name,'Cubierta cónica');
 const conePosition=a.meshes[4].primitives[0].attributes.POSITION,boxPosition=b.meshes[1].primitives[0].attributes.POSITION;
 assert.notEqual(a.accessors[conePosition].count,b.accessors[boxPosition].count);
 assert.equal(a.meshes[4].primitives[0].material,12);
 // Both runtime and glTF receive the authored composition, not just plan metadata.
 assert.match(p.code,/"name":"Cubierta cónica","type":"cone"|"type":"cone","position":\[0,4.8,0\]/);
 assert.ok(scene.camera[2]>8);assert.deepEqual(scene.target,[0,2.8,0]);
});

test('32 part scenes and architectural dimensions survive compilation without truncation',()=>{
 const objects=Array.from({length:32},(_,i)=>({...object,name:'Pieza '+i,position:[(i%8-3.5)*2,1,Math.floor(i/8)*2-3],size:[.5,1,.5]}));
 const plan=validateCreativePlan({...pavilion,objects});
 assert.equal(buildScene(generateProject('Una instalación de 32 piezas','3d',{plan}).brief).objects.length,32);
 assert.throws(()=>validateCreativePlan({...pavilion,objects:[...objects,object]}),/32/);
 const large=validateCreativePlan({...pavilion,objects:[{...object,position:[0,8,0],size:[12,8,12]}]});
 assert.deepEqual(large.objects[0].size,[12,8,12]);
 const framing=buildScene(generateProject('Una estructura grande','3d',{plan:large}).brief);
 assert.ok(Math.hypot(...framing.camera.map((n,i)=>n-framing.target[i]))>40);
});

test('bounded nested assemblies flatten correctly and normalized plans are idempotent',()=>{
 const plan=validateCreativePlan({...pavilion,groups:[{id:'root',position:[4,0,0],scale:2,yaw:Math.PI/2},{id:'wing',parent:'root',position:[1,0,0],scale:.5,yaw:-Math.PI/2}],objects:[{...object,name:'Pieza ensamblada',group:'wing',position:[0,1,0]}]});
 assert.ok(Math.abs(plan.objects[0].position[0]-4)<1e-9);
 assert.deepEqual(plan.objects[0].position.slice(1),[1,-2]);
 assert.deepEqual(plan.objects[0].size,[1,1,1]);assert.equal(plan.objects[0].yaw,0);
 assert.equal('group' in plan.objects[0],false);
 assert.deepEqual(validateCreativePlan(plan),plan);
 for(const groups of [
  [{id:'a',parent:'b',position:[0,0,0]},{id:'b',parent:'a',position:[0,0,0]}],
  [{id:'a',parent:'missing',position:[0,0,0]}],
  Array.from({length:5},(_,i)=>({id:'g'+i,...(i?{parent:'g'+(i-1)}:{}),position:[0,0,0]})),
 ])assert.throws(()=>validateCreativePlan({...pavilion,groups}),/grupo|niveles|ciclos/);
});

test('materials, camera and geometry are bounded data and unknown executable fields are discarded',()=>{
 const value={...pavilion,objects:[{...object,code:'fetch(secret)',url:'https://invalid'}],camera:[8,6,10],target:[0,1,0],code:'eval(secret)'};
 const plan=validateCreativePlan(value);assert.equal('code' in plan,false);assert.equal('url' in plan.objects[0],false);
 assert.deepEqual(buildScene(generateProject('Escena acotada','3d',{plan}).brief).camera,[8,6,10]);
 const mutations=[{version:3},{objects:[]},{objects:[{...object,type:'torus'}]},{objects:[{...object,material:13}]},{objects:[{...object,size:[13,1,1]}]},{objects:[{...object,position:[24,1,0],size:[12,1,1]}]},{materials:[{color:[2,0,0],roughness:.3,metalness:0}]},{materials:Array.from({length:9},()=>pavilion.materials[0])},{camera:[0,1,0],target:[0,1,-3]},{camera:[8,-1,10],target:[0,1,0]},{camera:[8,5,10],target:undefined}];
 for(const mutation of mutations)assert.throws(()=>validateCreativePlan({...value,...mutation}),JSON.stringify(mutation));
});

test('authored games preserve all objectives and player parts, with goals outside obstacles',()=>{
 const original=buildScene(parseBrief('Un juego de conducción','game',19));
 const objects=Array.from({length:24},(_,i)=>({...object,position:[i%2?12:-12,1,Math.floor(i/2)*2-20],size:[.4,1,.4]}));
 const scene=buildScene(generateProject('Juego con columnas laterales','game',{seed:19,plan:{...pavilion,variant:'driving',objects}}).brief);
 assert.equal(scene.objects.length,38);assert.equal(scene.objects.filter(o=>o.tag==='goal').length,8);assert.equal(scene.objects.filter(o=>o.tag==='player').length,6);
 for(const goal of scene.objects.filter(o=>o.tag==='goal'))for(const obstacle of scene.objects.filter(o=>o.tag==='obstacle'))assert.ok(Math.hypot(goal.position[0]-obstacle.position[0],goal.position[2]-obstacle.position[2])>1);
 assert.equal(original.objects.filter(o=>o.tag==='goal').length,8);
 const floor={...object,position:[0,.1,8],size:[10,.1,10],collision:false};
 const walkable=validateCreativePlan({...pavilion,variant:'exploration',objects:[floor]},'game');
 assert.equal(walkable.objects[0].tag,undefined);assert.deepEqual(validateCreativePlan(walkable,'game'),walkable);
 assert.throws(()=>validateCreativePlan({...pavilion,variant:'driving',objects:[{...object,position:[0,1,13]}]},'game'),/inicio/);
 assert.throws(()=>validateCreativePlan({...pavilion,variant:'exploration',objects:[...objects,object]},'game'),/24/);
 // A goal covered by authored architecture is moved into the connected walkable area.
 const target=original.objects.find(o=>o.tag==='goal'&&Math.hypot(o.position[0],o.position[2]-13)>5)!;
 const blocking={...object,position:[target.position[0],1,target.position[2]],size:[2,1,2]};
 const repaired=buildScene(generateProject('Juego con edificio','game',{seed:19,plan:{...pavilion,variant:'driving',objects:[blocking]}}).brief);
 assert.ok(repaired.objects.filter(o=>o.tag==='goal').every(o=>Math.abs(o.position[0]-blocking.position[0])>2.6||Math.abs(o.position[2]-blocking.position[2])>2.6));
});

test('legacy plans preserve their preset and the prompt requests authored geometry',()=>{
 const legacy=validateCreativePlan({...pavilion,version:1,objects:[object]});
 assert.equal(legacy.version,1);assert.ok(buildScene(generateProject('Una casa','3d',{plan:legacy}).brief).objects.length>1);
 assert.throws(()=>validateCreativePlan({...pavilion,version:1,objects:[pavilion.objects[0]]}));
 const prompt=creativePlanPrompt('Un castillo con torres','3d');assert.match(prompt,/version:2/);assert.match(prompt,/SUSTITUYEN/);assert.match(prompt,/32/);assert.match(prompt,/cylinder/);assert.match(prompt,/cone/);
});
