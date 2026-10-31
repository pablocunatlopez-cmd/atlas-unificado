export const bounds=24;
export const walls=[{x:-8,z:0,w:5,d:14},{x:8,z:-7,w:5,d:12},{x:0,z:12,w:10,d:3}];
export const targets=[{x:-17,z:14},{x:-16,z:-16},{x:0,z:-16},{x:17,z:1},{x:17,z:17}];
export function initial(){return {x:0,z:21,collected:[],won:false,time:0};}
export function free(x,z){return Math.abs(x)<bounds&&Math.abs(z)<bounds&&!walls.some(w=>Math.abs(x-w.x)<w.w/2+.6&&Math.abs(z-w.z)<w.d/2+.6);}
export function step(state,input,dt){
 if(state.won)return state;
 const s={...state,collected:[...state.collected],time:state.time+Math.max(0,Math.min(.05,dt))};
 let x=(input.right?1:0)-(input.left?1:0),z=(input.down?1:0)-(input.up?1:0);
 const length=Math.hypot(x,z)||1,speed=(input.sprint?11:6)*Math.max(0,Math.min(.05,dt));x=x/length*speed;z=z/length*speed;
 if(free(s.x+x,s.z))s.x+=x;if(free(s.x,s.z+z))s.z+=z;
 targets.forEach((p,i)=>{if(!s.collected.includes(i)&&Math.hypot(p.x-s.x,p.z-s.z)<1.5)s.collected.push(i);});
 s.won=s.collected.length===targets.length&&Math.hypot(s.x,s.z+22)<2;
 return s;
}
