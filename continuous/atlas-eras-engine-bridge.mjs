import {generateErasWorldChunk} from './eras-procedural-world.mjs';
import {planErasVisibleChunks} from './eras-world-streaming.mjs';
import {selectErasProfile} from './eras-graphics-quality.mjs';

/**
 * Atlas -> ERAS engine bridge: deterministic, portable scene compilation.
 * Produces a declarative render manifest. No rendering, code evaluation,
 * asset downloads or privileged tool execution occurs here.
 */
export function compileAtlasErasScene(spec={}){
 const {id='scene',seed=1,player={x:0,z:0},graphics={},world={}}=spec;
 if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(id))throw Error('Invalid scene id');
 if(!player||!Number.isFinite(player.x)||!Number.isFinite(player.z))throw Error('Invalid player');
 const profile=selectErasProfile(graphics);
 const {chunkSize=64,radius=1,maxChunks=9,vegetation=24}=world;
 const plan=planErasVisibleChunks({x:player.x,z:player.z,chunkSize,radius,maxChunks});
 if(!Number.isSafeInteger(vegetation)||vegetation<0||vegetation>200)
   throw Error('Invalid per-chunk vegetation budget');
 if(plan.visible.length*vegetation>2000)throw Error('Scene object budget exceeded');
 const chunks=plan.visible.map(({x,z,key})=>({
   key,...generateErasWorldChunk({seed,chunkX:x,chunkZ:z,size:chunkSize,vegetation})
 }));
 return {schemaVersion:1,engine:'ERAS',sceneId:id,seed,
   graphics:profile,player:{x:player.x,z:player.z},
   chunks,requiresAssets:['tree','rock'],
   renderStatus:'manifest_only'};
}
