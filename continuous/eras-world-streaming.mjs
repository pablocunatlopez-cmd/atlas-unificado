/**
 * Browser-friendly chunk streaming planner. Computes visible chunk keys around
 * the player; host renderer owns asset loading, instancing and eviction.
 */
export function planErasVisibleChunks({x,z,chunkSize=64,radius=2,maxChunks=81}={}){
 if(!Number.isFinite(x)||!Number.isFinite(z)||
   !Number.isFinite(chunkSize)||chunkSize<8||chunkSize>256||
   !Number.isSafeInteger(radius)||radius<0||radius>8||
   !Number.isSafeInteger(maxChunks)||maxChunks<1||maxChunks>289)
   throw Error('Invalid streaming parameters');
 const centerX=Math.floor(x/chunkSize),centerZ=Math.floor(z/chunkSize);
 const result=[];
 for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
   const distance=dx*dx+dz*dz;
   result.push({x:centerX+dx,z:centerZ+dz,distance});
 }
 result.sort((a,b)=>a.distance-b.distance||a.x-b.x||a.z-b.z);
 return {center:[centerX,centerZ],visible:result.slice(0,maxChunks).map(({x,z})=>({x,z,key:`${x}:${z}`}))};
}
export function diffErasChunks(previousKeys,nextKeys){
 if(!Array.isArray(previousKeys)||!Array.isArray(nextKeys)||
   [...previousKeys,...nextKeys].some(x=>typeof x!=='string'))
   throw Error('Invalid chunk key lists');
 const old=new Set(previousKeys),next=new Set(nextKeys);
 return {load:[...next].filter(k=>!old.has(k)),unload:[...old].filter(k=>!next.has(k))};
}
