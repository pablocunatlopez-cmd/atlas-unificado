import {roomById} from './layout.js';
export function validateFilmShots(raw){
 if(raw===undefined)return[];
 if(!Array.isArray(raw)||raw.length<2||raw.length>4)throw Error('El guion necesita de dos a cuatro planos.');
 const shots=raw.map(s=>{if(!s||!roomById(s.room)||!Number.isFinite(s.seconds)||s.seconds<1||s.seconds>8||!['wide','medium','detail'].includes(s.framing)||!['orbit','push','still'].includes(s.movement))throw Error('Un plano tiene cámara o duración no válida.');return{room:s.room,seconds:s.seconds,framing:s.framing,movement:s.movement};});
 const duration=shots.reduce((n,s)=>n+s.seconds,0);if(duration<4||duration>16)throw Error('El guion debe durar entre cuatro y dieciséis segundos.');return shots;
}
export function filmCameraAt(shots,elapsed){
 if(!shots.length)return null;let t=Math.max(0,Number.isFinite(elapsed)?elapsed:0),index=0;
 while(index<shots.length-1&&t>=shots[index].seconds){t-=shots[index].seconds;index++;}
 const shot=shots[index],phase=Math.min(1,t/shot.seconds),room=roomById(shot.room),x=(room.bounds[0]+room.bounds[2])/2,z=(room.bounds[1]+room.bounds[3])/2,base=shot.framing==='wide'?3.5:shot.framing==='detail'?1.35:2.5;
 const distance=shot.movement==='push'?base*(1-.28*phase):base,angle=shot.movement==='orbit'?(phase-.5)*.9:.18,height=shot.framing==='wide'?2.65:shot.framing==='detail'?2.1:2.35;
 return{index,phase,room:shot.room,position:[x+Math.sin(angle)*distance,height,z+Math.cos(angle)*distance],target:[x,2.1,z]};
}
