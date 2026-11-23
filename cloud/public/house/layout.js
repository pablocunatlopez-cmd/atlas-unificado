// Atlas house, deterministic plan. Coordinates are metres in the X/Z plane.
export const ROOMS=Object.freeze([
 {id:'salon',title:'Lía · Entorno compartido',short:'Lía',kind:'Conversar con Lía',accent:'#91dac5',bounds:[-4,0,4,8],spawn:[-1.8,5.7],yaw:.25,hotspot:[0,2.5]},
 {id:'music',title:'Estudio de música',short:'Música',kind:'Componer',accent:'#eac586',bounds:[-12,0,-4,8],spawn:[-6.8,4],yaw:-Math.PI/2,hotspot:[-9.8,4]},
 {id:'lab',title:'Laboratorio',short:'Laboratorio',kind:'Experimentar',accent:'#89c9e2',bounds:[-12,-8,-4,0],spawn:[-6.8,-4],yaw:-Math.PI/2,hotspot:[-9.6,-4]},
 {id:'games',title:'Taller de mundos',short:'Mundos',kind:'Crear en 3D',accent:'#c3a6ec',bounds:[4,0,12,8],spawn:[6.8,4],yaw:Math.PI/2,hotspot:[9.4,4]},
 {id:'cinema',title:'Sala de cine',short:'Cine',kind:'Crear vídeo',accent:'#ecaa91',bounds:[4,-8,12,0],spawn:[6.8,-4],yaw:Math.PI/2,hotspot:[10,-4]},
 {id:'constellation',title:'Cielo · Constelación',short:'Constelación',kind:'Suceso · mundo exterior',accent:'#c1cdee',bounds:[-4,-8,4,0],spawn:[0,-3.3],yaw:0,hotspot:[0,-6.3]},
 {id:'mind',title:'Mente · Archivo vivo',short:'Mente',kind:'Distinguir y recordar',accent:'#9acfe8',bounds:[-16,-16,-8,-8],spawn:[-10,-10],yaw:0,hotspot:[-12,-13.8]},
 {id:'body',title:'Animal · Cuerpo de Ion',short:'Ion',kind:'Recursos y consecuencias',accent:'#e5ba85',bounds:[-8,-16,0,-8],spawn:[-3,-10],yaw:0,hotspot:[-4,-13.8]},
 {id:'refutation',title:'Cámara de refutación',short:'Refutación',kind:'Probar y corregir',accent:'#e9a69f',bounds:[0,-16,8,-8],spawn:[3,-10],yaw:0,hotspot:[4,-13.8]},
 {id:'language',title:'LOR-ΩΣ · Lenguaje',short:'LOR-ΩΣ',kind:'Símbolos con evidencia',accent:'#c1b4ec',bounds:[8,-16,16,-8],spawn:[10,-10],yaw:0,hotspot:[12,-13.8]},
]);
export const ROOM_IDS=Object.freeze(ROOMS.map(room=>room.id));
export const WALLS=Object.freeze([
 // Windows are solid. The main entrance is the opening in the south wall.
 [-12.15,-8.15,-11.85,8.15],[11.85,-8.15,12.15,8.15],
 // The north wing is connected through four genuine doors, not teleport-only rooms.
 ...[[-16,-11.3],[-8.7,-3.3],[-.7,.7],[3.3,8.7],[11.3,16]].map(([a,b])=>[a,-8.1,b,-7.9]),
 [-12.15,7.85,-1.45,8.15],[1.45,7.85,12.15,8.15],
 // Central spine with doorways at z=-4 and z=4.
 ...[-4,4].flatMap(x=>[[-8,-5.35],[-2.65,2.65],[5.35,8]].map(([a,b])=>[x-.10,a,x+.10,b])),
 // Cross passages connect the studio/lab and the worlds/cinema rooms.
 [-12,-.1,-9.35,.1],[-6.65,-.1,-4,.1],[4,-.1,6.65,.1],[9.35,-.1,12,.1],
 [-4,-.1,-1.75,.1],[1.75,-.1,4,.1],
 [-16.15,-16.15,16.15,-15.85],[-16.15,-16.15,-15.85,-7.85],[15.85,-16.15,16.15,-7.85],
 ...[-8,0,8].flatMap(x=>[[-16,-13.3],[-10.7,-8]].map(([a,b])=>[x-.1,a,x+.1,b])),
]);
export const WORLD_BOUNDS=Object.freeze([-18,-18,18,12.8]);
export function roomById(id){return ROOMS.find(room=>room.id===id)||null;}
export function roomAt(x,z){return ROOMS.find(room=>x>=room.bounds[0]&&x<room.bounds[2]&&z>=room.bounds[1]&&z<room.bounds[3])?.id||null;}
export function blocked(x,z,radius=.25,walls=WALLS){
 if(!Number.isFinite(x)||!Number.isFinite(z))return true;
 if(x<WORLD_BOUNDS[0]+radius||x>WORLD_BOUNDS[2]-radius||z<WORLD_BOUNDS[1]+radius||z>WORLD_BOUNDS[3]-radius)return true;
 return walls.some(([left,top,right,bottom])=>x>left-radius&&x<right+radius&&z>top-radius&&z<bottom+radius);
}
// Substeps prevent a slow mobile frame from crossing a thin wall; separate axes
// allow sliding along walls rather than trapping the player at a corner.
export function movePlayer(position,dx,dz,{radius=.25,walls=WALLS}={}){
 if(![position?.x,position?.z,dx,dz].every(Number.isFinite))return {...position};
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));let {x,z}=position;
 for(let i=0;i<steps;i++){
  const nx=x+dx/steps,nz=z+dz/steps;
  if(!blocked(nx,z,radius,walls))x=nx;
  if(!blocked(x,nz,radius,walls))z=nz;
 }
 return {x,z};
}
export function navigationVector(yaw,forward,side,speed=1){
 const magnitude=Math.max(1,Math.hypot(forward,side));forward/=magnitude;side/=magnitude;
 return {dx:(Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed,dz:(-Math.cos(yaw)*forward+Math.sin(yaw)*side)*speed};
}
export function nearestRoom(x,z){return [...ROOMS].sort((a,b)=>Math.hypot(x-a.hotspot[0],z-a.hotspot[1])-Math.hypot(x-b.hotspot[0],z-b.hotspot[1]))[0];}
