/** Deterministic procedural village/forest layout; no rendering or downloads. */
import {compileAtlasWorld} from './atlas-world-compiler.mjs';
const validId=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(s);
export function generateLiaProceduralWorld({id='lia-world',title='Mundo de Lía',seed=1,trees=24,buildings=8,extent=100}={}){
 if(!validId(id)||typeof title!=='string'||!title.trim()||title.length>120||
  !Number.isInteger(seed)||seed<0||seed>0xffffffff||
  !Number.isInteger(trees)||trees<0||trees>600||
  !Number.isInteger(buildings)||buildings<0||buildings>200||
  !Number.isFinite(extent)||extent<10||extent>10000)
  throw new TypeError('Invalid procedural world request');
 let state=seed>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 const objects=[{id:'ground',kind:'terrain',position:[0,-.5,0],scale:[extent,1,extent]}];
 const used=[];
 const place=(kind,index,size)=>{
  for(let attempt=0;attempt<50;attempt++){
   const x=(random()-.5)*extent*.9,z=(random()-.5)*extent*.9;
   if(used.some(p=>(p.x-x)**2+(p.z-z)**2<(p.size+size)**2))continue;
   used.push({x,z,size});
   const height=kind==='building'?3+Math.floor(random()*5):2+random()*3;
   objects.push({id:kind+'-'+index,kind,position:[x,height/2,z],scale:[size,height,size]});
   return true;
  }
  return false;
 };
 let placedBuildings=0,placedTrees=0;
 for(let i=0;i<buildings;i++)if(place('building',i,3))placedBuildings++;
 for(let i=0;i<trees;i++)if(place('tree',i,1))placedTrees++;
 const world=compileAtlasWorld({id,title,objects});
 return Object.freeze({world,seed,requested:Object.freeze({trees,buildings}),
  placed:Object.freeze({trees:placedTrees,buildings:placedBuildings}),
  procedural:true,rendered:false,assetsGenerated:false});
}
