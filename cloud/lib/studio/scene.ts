export type StudioMode='code'|'image'|'3d'|'game';
export type Vec3=[number,number,number];
export type Material={color:Vec3;roughness:number;metalness:number;emission:number};
export type SceneObject={type:'sphere'|'box'|'cylinder'|'cone';position:Vec3;size:Vec3;material:number;yaw:number;name?:string;collision?:boolean;tag?:'player'|'goal'|'obstacle'};
export type Brief={meshRows?:12|18|24;mode:StudioMode;title:string;prompt:string;variant:'gallery'|'product'|'architecture'|'forest'|'neon'|'driving'|'exploration'|'tasks'|'calculator'|'notes'|'landing';palette:string;lighting:'day'|'sunset'|'night';seed:number;quality:'balanced'|'high';accent:Vec3;unsupported:string[];plan?:{version?:1|2;objects:SceneObject[];design?:string;materials?:Material[];camera?:Vec3;target?:Vec3}};
export type Scene={brief:Brief;objects:SceneObject[];materials:Material[];camera:Vec3;target:Vec3;sky:Vec3;sun:Vec3;fog:number;exposure:number;scene:number};
export const plain=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function seededRandom(seed:number){let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function parseBrief(prompt:string,mode:StudioMode,seed?:number,quality:'balanced'|'high'='balanced'):Brief{
 if(!prompt.trim()||prompt.length>4000)throw new Error('Describe el proyecto en 1–4.000 caracteres.');
 const s=plain(prompt);let variant:Brief['variant']=mode==='code'?'landing':'gallery';
 if(mode==='code')variant=/tarea|pendiente|kanban|\blistas?\b/.test(s)?'tasks':/calcul/.test(s)?'calculator':/notas|bloc|diario/.test(s)?'notes':'landing';
 else if(mode==='game')variant=/carrer|coche|conduc|rally/.test(s)?'driving':'exploration';
 else variant=/bosque|naturaleza|arbol/.test(s)?'forest':/neon|futur|cyberpunk/.test(s)?'neon':/casa|arquitect|habitacion|salon|villa/.test(s)?'architecture':/galeria|museo|exposicion/.test(s)?'gallery':/esfera|producto|metal|oro|escultura/.test(s)?'product':'gallery';
 const palettes:{term:RegExp;name:string;color:Vec3}[]=[{term:/rojo|roja/,name:'Carmín',color:[.65,.055,.045]},{term:/azul/,name:'Azul cobalto',color:[.045,.18,.7]},{term:/verde/,name:'Verde pino',color:[.08,.3,.18]},{term:/rosa|magenta|lila/,name:'Magenta',color:[.65,.08,.42]},{term:/oro|dorado|dorada/,name:'Oro',color:[.83,.57,.22]},{term:/negro|negra/,name:'Grafito',color:[.055,.06,.065]},{term:/blanco|blanca/,name:'Porcelana',color:[.88,.87,.82]}];
 const palette=palettes.find(p=>p.term.test(s))||{name:'Titanio',color:[.56,.6,.64] as Vec3};
 let hash=2166136261;for(const char of prompt)hash=Math.imul(hash^char.charCodeAt(0),16777619);
 const unsupported:string[]=[];if(/persona|rostro|humano|personaje|animal|drag[oó]n/.test(s))unsupported.push('El motor actual construye geometría procedural; no modela personajes orgánicos a partir de texto.');if(/hiperreal|fotoreal|aaa/.test(s))unsupported.push('El render usa materiales PBR, sombras y reflejos; no garantiza calidad fotográfica o AAA.');
 const title=prompt.replace(/^(crea|crear|haz|genera|generar|quiero)\s+(un[ao]?\s+)?/i,'').trim().slice(0,90);
 return{mode,title:title.charAt(0).toUpperCase()+title.slice(1),prompt,variant,palette:palette.name,lighting:/noche|nocturn|oscuro/.test(s)?'night':/atardecer|amanecer|calid|dorado/.test(s)?'sunset':'day',seed:seed??(hash>>>0),quality,accent:palette.color,unsupported};
}
// These conservative footprints are shared with the runtime's player collision.
// Only low, solid objects get an obstacle tag during plan validation.
function blockedAt(objects:SceneObject[],x:number,z:number,padding=.5){
 return objects.some(object=>{
  if(object.tag!=='obstacle')return false;
  const dx=x-object.position[0],dz=z-object.position[2],c=Math.cos(object.yaw),s=Math.sin(object.yaw),lx=c*dx-s*dz,lz=s*dx+c*dz;
  if(object.type==='box')return Math.abs(lx)<object.size[0]+padding&&Math.abs(lz)<object.size[2]+padding;
  return (lx/(object.size[0]+padding))**2+(lz/(object.size[2]+padding))**2<1;
 });
}
function reachableGameGoals(objects:SceneObject[],driving:boolean){
 const boundX=driving?34:29,boundZ=driving?64:39,width=boundX*2+1,startZ=driving?13:8,start=(startZ+boundZ)*width+boundX;
 const cells=new Uint8Array(width*(boundZ*2+1)),queue=[start],points:Vec3[]=[];cells[start]=1;
 for(let index=0;index<queue.length;index++){
  const cell=queue[index],x=cell%width-boundX,z=Math.floor(cell/width)-boundZ;points.push([x,.7,z]);
  for(const [nx,nz]of [[x-1,z],[x+1,z],[x,z-1],[x,z+1]]){
   if(nx< -boundX||nx>boundX||nz< -boundZ||nz>boundZ)continue;
   const next=(nz+boundZ)*width+nx+boundX;if(cells[next])continue;cells[next]=2;
   if(!blockedAt(objects,nx,nz,.65)){cells[next]=1;queue.push(next);}
  }
 }
 if(points.length<40)throw Error('El diseño bloquea el inicio: deja caminos conectados más anchos para los ocho objetivos.');
 const selected:Vec3[]=[];
 for(const object of objects){
  if(object.tag!=='goal')continue;
  const desired=object.position;let best:Vec3|undefined,bestDistance=Infinity;
  for(const point of points){
   if(Math.hypot(point[0],point[2]-startZ)<3||selected.some(other=>Math.hypot(point[0]-other[0],point[2]-other[2])<2))continue;
   const distance=(point[0]-desired[0])**2+(point[2]-desired[2])**2;
   if(distance<bestDistance){best=point;bestDistance=distance;}
  }
  if(!best)throw Error('El diseño no deja espacio accesible para ocho objetivos separados.');
  object.position=[...best];selected.push(best);
 }
}
function authoredFraming(objects:SceneObject[]):{camera:Vec3;target:Vec3}{
 const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];
 for(const object of objects){
  const c=Math.abs(Math.cos(object.yaw)),s=Math.abs(Math.sin(object.yaw));
  const extent:Vec3=[c*object.size[0]+s*object.size[2],object.size[1],s*object.size[0]+c*object.size[2]];
  for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],object.position[axis]-extent[axis]);max[axis]=Math.max(max[axis],object.position[axis]+extent[axis]);}
 }
 const target=min.map((n,i)=>(n+max[i])*.5) as Vec3,radius=Math.max(1,Math.hypot(...max.map((n,i)=>(n-min[i])*.5))),distance=Math.max(5,radius*2.7);
 return{target,camera:[target[0]+distance*.61,target[1]+distance*.42,target[2]+distance*.67]};
}
export function buildScene(brief:Brief):Scene{
 const r=seededRandom(brief.seed),objects:SceneObject[]=[],materials:Material[]=[
 {color:[.63,.61,.56],roughness:.65,metalness:0,emission:0},{color:[.82,.8,.75],roughness:.7,metalness:0,emission:0},{color:brief.accent,roughness:.18,metalness:.92,emission:0},{color:[.15,.2,.15],roughness:.94,metalness:0,emission:0},{color:[.18,.105,.06],roughness:.9,metalness:0,emission:0},{color:[.85,.55,.12],roughness:.2,metalness:.9,emission:0},{color:[.93,.86,.66],roughness:.5,metalness:0,emission:6},{color:[.36,.05,.25],roughness:.25,metalness:.3,emission:4},{color:[.025,.03,.035],roughness:.4,metalness:.15,emission:0},{color:[.45,.48,.52],roughness:.22,metalness:.98,emission:0},{color:[.75,.31,.13],roughness:.5,metalness:0,emission:0},{color:[.15,.42,.59],roughness:.3,metalness:.6,emission:0}];
 const sphere=(p:Vec3,radius:number,m:number,tag?:SceneObject['tag'])=>objects.push({type:'sphere',position:p,size:[radius,radius,radius],material:m,yaw:0,tag});
 const box=(p:Vec3,size:Vec3,m:number,tag?:SceneObject['tag'],yaw=0)=>objects.push({type:'box',position:p,size,material:m,yaw,tag});
 let camera:Vec3=[7,4.1,8],target:Vec3=[0,1,0],scene=0,fog=0;
 if(['forest','exploration','driving'].includes(brief.variant)){
  scene=brief.variant==='driving'?3:2;materials[0].color=[.1,.17,.09];materials[0].roughness=.93;fog=.012;camera=brief.variant==='driving'?[0,4,18]:[0,1.65,8];target=[0,1,-3];
  for(let i=0;i<9;i++){const side=i%2?1:-1,x=side*(6+r()*11),z=-24+r()*52,height=2.5+r()*3;box([x,height*.5,z],[.18,height*.5,.18],4,'obstacle');sphere([x,height+.6,z],1.5+r()*.6,3);}
  for(let i=0;i<4;i++)sphere([(i%2?1:-1)*(5+r()*9),.35,-10+r()*30],.5+r()*.6,1,'obstacle');
  if(brief.mode==='game'){
   for(let i=0;i<8;i++){const z=brief.variant==='driving'?10-i*7:-20+r()*33;const x=brief.variant==='driving'?3.2*Math.sin(z*.045)+(r()-.5)*4:(r()-.5)*7;sphere([x,.7,z],.32,6,'goal');}
   if(brief.variant==='driving'){box([0,.55,13],[.85,.28,1.65],2,'player');box([0,.94,13.03],[.65,.25,.8],9,'player');for(const x of [-.87,.87])for(const z of [-1,1])sphere([x,.35,13+z],.31,8,'player');}
  }
 }else if(brief.variant==='architecture'){
  materials[0].color=[.72,.69,.61];box([-4,2,0],[.12,2,5],1);box([0,2,-4],[4,2,.12],1);box([0,4,0],[4,.12,4],1);box([.2,.5,-1],[1.9,.5,.8],1);box([.2,1.05,-1],[1.95,.05,.85],2);box([2,.45,1.8],[.8,.45,.8],4);sphere([-2,1,1],.85,2);for(let i=0;i<5;i++)box([-3+i*1.4,2.8,-3.7],[.035,1.15,.14],4);camera=[8,3.6,9];target=[-.2,1.5,-.6];
 }else if(brief.variant==='neon'){
  scene=1;materials[0]={color:[.025,.028,.035],roughness:.12,metalness:.6,emission:0};for(let i=0;i<8;i++)box([-4+i*1.1,2.8,-3.5],[.022,2.8,.04],i%2?6:7);sphere([0,1.6,0],1.2,2);box([0,.15,0],[1.6,.15,1.6],8);camera=[6,3,7];target=[0,1.4,0];
 }else{
  box([0,.15,0],[1.4,.15,1.4],1);sphere([0,1.5,0],1.18,2);
  if(brief.variant!=='product'){sphere([-2.6,.8,-1.3],.8,9);sphere([2.2,.58,1],.58,10);box([0,2.7,-4],[6,2.7,.12],1);for(let i=0;i<6;i++)box([-4.5+i*1.8,2.7,-3.65],[.09,2.7,.25],1);box([-5,2,0],[.12,2,4],1);}camera=brief.variant==='product'?[4.8,2.6,5.8]:[6.5,3.8,8];target=[0,1.2,0];
 }
 const night=brief.lighting==='night';const sky:Vec3=night?[.045,.065,.14]:brief.lighting==='sunset'?[.7,.43,.25]:[.35,.52,.78];const sun:Vec3=brief.lighting==='sunset'?[-.85,.2,.35]:[-.5,.8,.45];
 if(brief.plan?.version===2){
  // A model-authored composition is the scene, not eight decorations hidden
  // behind the same procedural gallery or house. Retain only game mechanics.
  const essentials=brief.mode==='game'?objects.filter(object=>object.tag==='goal'||object.tag==='player'):[];
  objects.splice(0,objects.length,...essentials,...structuredClone(brief.plan.objects));
  materials.push(...structuredClone(brief.plan.materials??[]));
  if(brief.mode==='game')reachableGameGoals(objects,brief.variant==='driving');
  else{const framing=authoredFraming(objects);camera=brief.plan.camera?[...brief.plan.camera]:framing.camera;target=brief.plan.target?[...brief.plan.target]:framing.target;}
 }else{
  if(brief.mode!=='game'){camera[0]+=(r()-.5)*.55;camera[2]+=(r()-.5)*.55;}
  if(brief.plan?.objects)objects.push(...brief.plan.objects);
 }
 return{brief,objects:objects.slice(0,40),materials,camera,target,sky,sun,fog,exposure:night?.55:1.0,scene};
}

export function creativeRequest(text:string):StudioMode|null{const s=plain(text);if(!/\b(crea|crear|genera|generar|haz|programa|disena|construye)\b/.test(s))return null;if(/videojuego|juego de|juego 3d/.test(s))return 'game';if(/imagen|render|fotografia/.test(s))return 'image';if(/3d|escena|modelo tridimensional/.test(s))return '3d';if(/codigo|aplicacion|pagina web|landing|calculadora|web de/.test(s))return 'code';return null;}
