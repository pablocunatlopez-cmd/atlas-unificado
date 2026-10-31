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
export function sceneToGltf(scene:Scene){
 const binary:number[]=[],bufferViews:{buffer:number;byteOffset:number;byteLength:number;target:number}[]=[],accessors:Record<string,unknown>[]=[];
 const add=(values:number[],components:number,index=false)=>{while(binary.length%4)binary.push(0);const offset=binary.length,array=index?new Uint16Array(values):new Float32Array(values),bytes=new Uint8Array(array.buffer);for(const b of bytes)binary.push(b);const view=bufferViews.length;bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target:index?34963:34962});const accessor:Record<string,unknown>={bufferView:view,componentType:index?5123:5126,count:values.length/components,type:components===1?'SCALAR':'VEC3'};if(!index){accessor.min=Array.from({length:components},(_,i)=>Math.min(...values.filter((_,n)=>n%components===i)));accessor.max=Array.from({length:components},(_,i)=>Math.max(...values.filter((_,n)=>n%components===i)));}const id=accessors.length;accessors.push(accessor);return id;};
 const geometries={sphere:sphereGeometry(),box:boxGeometry()},attributes:Record<string,{POSITION:number;NORMAL:number;indices:number}>={};
 for(const [key,g]of Object.entries(geometries))attributes[key]={POSITION:add(g.position,3),NORMAL:add(g.normal,3),indices:add(g.indices,1,true)};
 const mats=scene.materials.map((m,i)=>({name:'Atlas material '+i,pbrMetallicRoughness:{baseColorFactor:[...m.color,1],metallicFactor:m.metalness,roughnessFactor:m.roughness},...(m.emission?{emissiveFactor:m.color}:{}),extras:{atlasEmission:m.emission}}));
 const objects=[{type:'box' as const,position:[0,-.02,0] as Vec3,size:[50,.02,50] as Vec3,material:0,yaw:0},...scene.objects];
 const meshes=objects.map((o,i)=>({name:'Atlas mesh '+i,primitives:[{attributes:{POSITION:attributes[o.type].POSITION,NORMAL:attributes[o.type].NORMAL},indices:attributes[o.type].indices,material:o.material,mode:4}]}));
 const nodes=objects.map((o,i)=>({name:o.tag||'Atlas object '+i,mesh:i,translation:o.position,scale:o.size,rotation:[0,Math.sin(o.yaw/2),0,Math.cos(o.yaw/2)]}));
 let raw='';for(const b of binary)raw+=String.fromCharCode(b);const encoded=btoa(raw);
 return{asset:{version:'2.0',generator:'Atlas Studio procedural 1.0'},scene:0,scenes:[{name:scene.brief.title,nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials:mats,buffers:[{uri:'data:application/octet-stream;base64,'+encoded,byteLength:binary.length}],bufferViews,accessors,extras:{prompt:scene.brief.prompt,seed:scene.brief.seed,note:'Base geometric scene. Procedural floor patterns and the interactive game logic are in the HTML export, not baked into glTF.'}};
}
