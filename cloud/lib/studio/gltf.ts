import type {Scene,Vec3} from './scene.ts';
type Geometry={position:number[];normal:number[];indices:number[]};
export function sphereGeometry(rows=24,columns=36):Geometry{
 const position:number[]=[],normal:number[]=[],indices:number[]=[];
 for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){const theta=y/rows*Math.PI,phi=x/columns*Math.PI*2;const p=[Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi)];position.push(...p);normal.push(...p);}
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const a=y*(columns+1)+x,b=a+columns+1;indices.push(a,a+1,b,a+1,b+1,b);}
 return{position,normal,indices};
}
export function boxGeometry():Geometry{
 const faces=[{n:[0,0,1],p:[-1,-1,1,1,-1,1,1,1,1,-1,1,1]},{n:[0,0,-1],p:[1,-1,-1,-1,-1,-1,-1,1,-1,1,1,-1]},{n:[1,0,0],p:[1,-1,1,1,-1,-1,1,1,-1,1,1,1]},{n:[-1,0,0],p:[-1,-1,-1,-1,-1,1,-1,1,1,-1,1,-1]},{n:[0,1,0],p:[-1,1,1,1,1,1,1,1,-1,-1,1,-1]},{n:[0,-1,0],p:[-1,-1,-1,1,-1,-1,1,-1,1,-1,-1,1]}];
 const position:number[]=[],normal:number[]=[],indices:number[]=[];faces.forEach((f,i)=>{position.push(...f.p);for(let n=0;n<4;n++)normal.push(...f.n);const a=i*4;indices.push(a,a+1,a+2,a,a+2,a+3);});return{position,normal,indices};
}
// Separate side/cap vertices retain smooth radial sides and genuinely flat caps.
// All primitives use the same local bounds: radius 1, Y from -1 to +1.
function radialGeometry(segments:number,topRadius:0|1):Geometry{
 segments=Number.isFinite(segments)?Math.max(3,Math.min(96,Math.floor(segments))):36;
 const position:number[]=[],normal:number[]=[],indices:number[]=[];
 const tri=(a:number[],b:number[],c:number[],na:number[],nb=na,nc=na)=>{const index=position.length/3;position.push(...a,...b,...c);normal.push(...na,...nb,...nc);indices.push(index,index+1,index+2);};
 const slope=(1-topRadius)/2,length=Math.hypot(1,slope),n=(angle:number)=>[Math.cos(angle)/length,slope/length,Math.sin(angle)/length];
 for(let i=0;i<segments;i++){
  const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments,bottomA=[Math.cos(a),-1,Math.sin(a)],bottomB=[Math.cos(b),-1,Math.sin(b)],topA=[Math.cos(a)*topRadius,1,Math.sin(a)*topRadius],topB=[Math.cos(b)*topRadius,1,Math.sin(b)*topRadius];
  tri(bottomA,topA,bottomB,n(a),n(topRadius?a:(a+b)/2),n(b));
  if(topRadius){tri(topA,topB,bottomB,n(a),n(b),n(b));tri([0,1,0],topB,topA,[0,1,0]);}
  tri([0,-1,0],bottomA,bottomB,[0,-1,0]);
 }
 return{position,normal,indices};
}
export function cylinderGeometry(segments=36):Geometry{return radialGeometry(segments,1);}
export function coneGeometry(segments=36):Geometry{return radialGeometry(segments,0);}
export function sceneToGltf(scene:Scene){
 const binary:number[]=[],bufferViews:{buffer:number;byteOffset:number;byteLength:number;target:number}[]=[],accessors:Record<string,unknown>[]=[];
 const add=(values:number[],components:number,index=false)=>{while(binary.length%4)binary.push(0);const offset=binary.length,array=index?new Uint16Array(values):new Float32Array(values),bytes=new Uint8Array(array.buffer);for(const b of bytes)binary.push(b);const view=bufferViews.length;bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target:index?34963:34962});const accessor:Record<string,unknown>={bufferView:view,componentType:index?5123:5126,count:values.length/components,type:components===1?'SCALAR':'VEC3'};if(!index){accessor.min=Array.from({length:components},(_,i)=>Math.min(...values.filter((_,n)=>n%components===i)));accessor.max=Array.from({length:components},(_,i)=>Math.max(...values.filter((_,n)=>n%components===i)));}const id=accessors.length;accessors.push(accessor);return id;};
 const rows=scene.brief.meshRows||24;
 const geometries={sphere:sphereGeometry(rows,rows*1.5),box:boxGeometry(),cylinder:cylinderGeometry(rows*1.5),cone:coneGeometry(rows*1.5)},attributes:Record<string,{POSITION:number;NORMAL:number;indices:number}>={};
 for(const [key,g]of Object.entries(geometries))attributes[key]={POSITION:add(g.position,3),NORMAL:add(g.normal,3),indices:add(g.indices,1,true)};
 const mats=scene.materials.map((m,i)=>({name:'Atlas material '+i,pbrMetallicRoughness:{baseColorFactor:[...m.color,1],metallicFactor:m.metalness,roughnessFactor:m.roughness},...(m.emission?{emissiveFactor:m.color}:{}),extras:{atlasEmission:m.emission}}));
 const objects=[{type:'box' as const,position:[0,-.02,0] as Vec3,size:[50,.02,50] as Vec3,material:0,yaw:0},...scene.objects];
 const meshes=objects.map((o,i)=>({name:'Atlas mesh '+i,primitives:[{attributes:{POSITION:attributes[o.type].POSITION,NORMAL:attributes[o.type].NORMAL},indices:attributes[o.type].indices,material:o.material,mode:4}]}));
 const nodes=objects.map((o,i)=>({name:('name' in o&&o.name)||o.tag||'Atlas object '+i,mesh:i,translation:o.position,scale:o.size,rotation:[0,Math.sin(o.yaw/2),0,Math.cos(o.yaw/2)]}));
 let raw='';for(const b of binary)raw+=String.fromCharCode(b);const encoded=btoa(raw);
 return{asset:{version:'2.0',generator:'Atlas Studio procedural 1.0'},scene:0,scenes:[{name:scene.brief.title,nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials:mats,buffers:[{uri:'data:application/octet-stream;base64,'+encoded,byteLength:binary.length}],bufferViews,accessors,extras:{prompt:scene.brief.prompt,seed:scene.brief.seed,note:'Base geometric scene. Procedural floor patterns and the interactive game logic are in the HTML export, not baked into glTF.'}};
}
