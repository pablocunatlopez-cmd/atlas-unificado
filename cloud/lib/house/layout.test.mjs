import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ROOMS,ROOM_IDS,roomAt,roomById,blocked,movePlayer,navigationVector} from '../../public/house/layout.js';
test('all facilities have a unique reachable spawn in their room',()=>{
 assert.equal(new Set(ROOM_IDS).size,10);
 for(const room of ROOMS){assert.equal(roomAt(...room.spawn),room.id);assert.equal(blocked(...room.spawn),false);assert.equal(roomById(room.id),room);}
});
test('doorways join every room to the central house',()=>{
 for(const z of [-4,4])for(const sign of [-1,1]){
  const from={x:sign*2.5,z},to=movePlayer(from,sign*4.3,0);
  assert.ok(Math.abs(to.x-sign*6.8)<.01);assert.equal(to.z,z);
 }
 const north=movePlayer({x:0,z:5.7},0,-9);assert.ok(north.z<-3);
 for(const x of [-10,-2,2,10]){const doorway=movePlayer({x,z:-6.8},0,-3.2);assert.ok(doorway.z<-9.9,'north wing doorway '+x+' is reachable');assert.ok(['mind','body','refutation','language'].includes(roomAt(doorway.x,doorway.z)));}
 for(const x of [-8,0,8]){const doorway=movePlayer({x:x-1,z:-12},2,0);assert.ok(doorway.x>x+.9,'north wing rooms join at x='+x);}
});

test('the entire ten-room plan is connected through walkable floor rather than teleport alone',()=>{
 const step=.5,key=(x,z)=>x+','+z,inside=(x,z)=>ROOMS.some(room=>x>room.bounds[0]+.27&&x<room.bounds[2]-.27&&z>room.bounds[1]+.27&&z<room.bounds[3]-.27);
 const pending=[[0,4]],seen=new Set([key(0,4)]);let index=0;
 while(index<pending.length){const[x,z]=pending[index++];for(const[dx,dz]of[[step,0],[-step,0],[0,step],[0,-step]]){const xx=x+dx,zz=z+dz,k=key(xx,zz);if(seen.has(k)||blocked(xx,zz)||xx<-15.5||xx>15.5||zz<-15.5||zz>7.5)continue;const traversed=movePlayer({x,z},dx,dz);if(Math.hypot(traversed.x-xx,traversed.z-zz)>.01)continue;seen.add(k);pending.push([xx,zz]);}}
 for(const room of ROOMS){const reachable=pending.some(([x,z])=>inside(x,z)&&roomAt(x,z)===room.id&&Math.hypot(x-room.spawn[0],z-room.spawn[1])<1);assert.ok(reachable,'walkable route to '+room.id);}
});
test('thin walls stop high-speed travel but allow a player to slide along them',()=>{
 const hit=movePlayer({x:2,z:1},8,0);assert.ok(hit.x<3.66);assert.ok(hit.x>3.5);
 const slide=movePlayer({x:3.6,z:1},2,.8);assert.ok(slide.x<3.66);assert.ok(slide.z>1.7);
 assert.equal(blocked(0,-8),true);assert.equal(blocked(NaN,0),true);
});
test('movement respects camera direction and diagonal speed budget',()=>{
 const north=navigationVector(0,1,0,2);assert.deepEqual(north,{dx:0,dz:-2});
 const diagonal=navigationVector(Math.PI/3,1,1,2);assert.ok(Math.abs(Math.hypot(diagonal.dx,diagonal.dz)-2)<1e-9);
});
