import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {Script} from 'node:vm';import ts from 'typescript';
import * as THREE from '../public/house/vendor/three.module.js';
import {canUseHouseFunction} from '../public/house/interaction-policy.js';
import {houseFunction} from '../public/house/functional-world.js';
import {createHouseQuest,advanceHouseQuest} from '../public/house/house-quest.js';
import {roomById} from '../public/house/layout.js';

const source=ts.createSourceFile('runtime.js',readFileSync(new URL('../public/house/runtime.js',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let pointer,interact,allowed;
function find(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='interact')interact=n.getText(source);if(ts.isFunctionDeclaration(n)&&n.name?.text==='functionHitAllowed')allowed=n.getText(source);if(ts.isCallExpression(n)&&n.expression.getText(source)==='listen'&&n.arguments[0]?.getText(source)==='canvas'&&n.arguments[1]?.text==='pointerup')pointer=n.arguments[2].getText(source);ts.forEachChild(n,find);}find(source);assert.ok(pointer&&interact&&allowed,'Tests exercise the production runtime pointer/keyboard handlers.');
function fixture(prototype=true){
 const fn=houseFunction('mind-cabinet'),events=[],ui={textContent:''},c={atlasMode:null,portrait:null,prototype,overview:true,paused:false,transition:null,player:{x:0,z:0},drag:null,camera:{},innerWidth:1000,innerHeight:800,currentRoom:'mind',THREE,canUseHouseFunction,houseFunction,house:{interactive:[{visible:true}]},hit:{distance:50,point:new THREE.Vector3(...fn.position),object:{userData:{functionId:fn.id,room:fn.room}}},quest:createHouseQuest('Construye una casa'),teleports:0};
 c.raycaster={setFromCamera(){},intersectObjects(){return[c.hit];}};c.$=()=>ui;c.send=(type,value)=>{events.push({type,...value});if(type==='function')c.quest=advanceHouseQuest(c.quest,value.id).state;};c.resize=()=>{};c.teleport=room=>{c.teleports++;c.overview=false;const [x,z]=roomById(room).spawn;c.player={x,z};c.transition={active:true};};new Script(allowed+'\n'+interact+'\nglobalThis.pointerHandler='+pointer+';').runInNewContext(c);
 const click=()=>{c.drag={id:1,moved:false};c.pointerHandler({pointerId:1,clientX:500,clientY:400});};return{c,events,click,fn,ui};
}
test('playable interaction requires proximity from the camera and the actual player, outside a map or transition',()=>{
 assert.equal(canUseHouseFunction({prototype:true,overview:false,distance:1,playerDistance:1}),true);
 for(const value of [{overview:true},{transitioning:true},{distance:3.5},{playerDistance:3.5},{distance:NaN},{playerDistance:Infinity}])assert.equal(canUseHouseFunction({prototype:true,distance:1,playerDistance:1,...value}),false);
 assert.equal(canUseHouseFunction({prototype:true}),false);assert.equal(canUseHouseFunction({overview:true,distance:Infinity,playerDistance:Infinity,transitioning:true}),true);
});
test('overview selection and repeated distant clicks cannot advance inventory or teleport a walking player closer',()=>{
 const f=fixture();f.click();assert.equal(f.c.teleports,1,'The map may navigate to the selected room.');assert.equal(f.c.quest.step,0);assert.equal(f.events.length,0);
 f.c.hit.distance=.7;f.click();assert.equal(f.c.quest.step,0,'The camera transition cannot activate a mission.');assert.equal(f.c.teleports,1,'A second denied click must not move the walking player.');
 f.c.transition=null;f.click();assert.equal(f.c.quest.step,0,'A close camera hit cannot stand in for a distant player.');assert.match(f.ui.textContent,/Acércate/);assert.equal(f.c.teleports,1);
 f.c.player={x:f.fn.position[0],z:f.fn.position[2]+1};f.c.hit.distance=1;f.click();assert.equal(f.c.quest.step,1);assert.equal(f.events.filter(e=>e.type==='function').length,1);
});
test('keyboard interaction uses the same actual proximity and transition checks',()=>{
 const f=fixture();f.c.overview=false;f.c.hit.distance=1;f.c.interact();assert.equal(f.c.quest.step,0);f.c.player={x:f.fn.position[0],z:f.fn.position[2]+1};f.c.transition={active:true};f.c.interact();assert.equal(f.c.quest.step,0);f.c.transition=null;f.c.interact();assert.equal(f.c.quest.step,1);
});
test('normal house map selection opens its functional tool directly',()=>{const f=fixture(false);f.click();assert.equal(f.c.teleports,0);assert.equal(f.events.length,1);assert.equal(f.events[0].id,f.fn.id);});
