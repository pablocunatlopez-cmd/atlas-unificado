import {boxGeometry,sphereGeometry,cylinderGeometry,coneGeometry} from './gltf.ts';
import type {Scene,SceneObject,Vec3} from './scene.ts';

export type StlBounds={min:Vec3;max:Vec3};
export type StlOptions={millimetersPerUnit?:number;minWallMm?:number};
export type MeshIssueCode='open'|'nonmanifold'|'degenerate'|'thin'|'overlap'|'shells'|'empty'|'geometry'|'thickness';
export type MeshIssue={code:MeshIssueCode;message:string;object?:number};
export type MeshReport={
 ok:boolean;
 objects:number;
 triangles:number;
 closedObjects:number;
 boundsMm:StlBounds;
 dimensionsMm:Vec3;
 millimetersPerUnit:number;
 minWallMm:number;
 minThicknessMm:number|null;
 errors:MeshIssue[];
 warnings:MeshIssue[];
 summary:string;
};
export type StlExport={stl:string;triangles:number;objects:number;bounds:StlBounds;report:MeshReport};

export const DEFAULT_MM_PER_UNIT=1;
export const DEFAULT_MIN_WALL_MM=1.2;

type Triangle={a:Vec3;b:Vec3;c:Vec3;normal:Vec3};
type ObjectMesh={index:number;type:SceneObject['type'];triangles:Triangle[];bounds:StlBounds;degenerate:number;boundary:number;nonmanifold:number;thickness:number|null};

const number=(value:number)=>Math.abs(value)<1e-9?0:value;
const format=(value:number)=>number(value).toFixed(6);
const vector=(values:number[],index:number):Vec3=>[values[index],values[index+1],values[index+2]];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const subtract=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const length=(v:Vec3)=>Math.hypot(v[0],v[1],v[2]);
function normal(a:Vec3,b:Vec3,c:Vec3):Vec3{
 const value=cross(subtract(b,a),subtract(c,a)),size=length(value);
 return size<1e-9?[0,0,0]:[value[0]/size,value[1]/size,value[2]/size];
}
function transform(object:SceneObject,point:Vec3,millimetersPerUnit:number):Vec3{
 const x=point[0]*object.size[0]*millimetersPerUnit,y=point[1]*object.size[1]*millimetersPerUnit,z=point[2]*object.size[2]*millimetersPerUnit;
 const cosine=Math.cos(object.yaw),sine=Math.sin(object.yaw);
 return [x*cosine+z*sine+object.position[0]*millimetersPerUnit,y+object.position[1]*millimetersPerUnit,-x*sine+z*cosine+object.position[2]*millimetersPerUnit];
}
const pointKey=(point:Vec3)=>point.map(value=>Math.round(value*1e6)/1e6).join(',');
function edgeKey(a:Vec3,b:Vec3){const first=pointKey(a),second=pointKey(b);return first<second?first+'|'+second:second+'|'+first;}
function rayHit(origin:Vec3,direction:Vec3,a:Vec3,b:Vec3,c:Vec3):number|null{
 const edge1=subtract(b,a),edge2=subtract(c,a),p=cross(direction,edge2),det=dot(edge1,p);
 if(Math.abs(det)<1e-12)return null;
 const inverse=1/det,t=subtract(origin,a),u=dot(t,p)*inverse;
 if(u<0||u>1)return null;
 const q=cross(t,edge1),v=dot(direction,q)*inverse;
 if(v<0||u+v>1)return null;
 const distance=dot(edge2,q)*inverse;
 return distance>1e-7?distance:null;
}
function thicknessOf(triangles:Triangle[]):number|null{
 if(!triangles.length)return null;
 const samples=Math.min(24,triangles.length);let minimum:number|null=null;
 for(let sample=0;sample<samples;sample++){
  const triangle=triangles[Math.floor(sample*triangles.length/samples)];
  if(length(triangle.normal)<1e-9)continue;
  const centroid:Vec3=[(triangle.a[0]+triangle.b[0]+triangle.c[0])/3,(triangle.a[1]+triangle.b[1]+triangle.c[1])/3,(triangle.a[2]+triangle.b[2]+triangle.c[2])/3];
  const offset=1e-5;
  const origin:Vec3=[centroid[0]-triangle.normal[0]*offset,centroid[1]-triangle.normal[1]*offset,centroid[2]-triangle.normal[2]*offset];
  const direction:Vec3=[-triangle.normal[0],-triangle.normal[1],-triangle.normal[2]];
  let nearest:number|null=null;
  for(const other of triangles){const hit=rayHit(origin,direction,other.a,other.b,other.c);if(hit!==null&&(nearest===null||hit<nearest))nearest=hit;}
  if(nearest!==null){const measured=nearest+offset;if(minimum===null||measured<minimum)minimum=measured;}
 }
 return minimum;
}
function buildMesh(object:SceneObject,index:number,type:SceneObject['type'],geometry:{position:number[];indices:number[]},millimetersPerUnit:number):ObjectMesh{
 const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity],triangles:Triangle[]=[];let degenerate=0;
 for(let offset=0;offset<geometry.indices.length;offset+=3){
  const a=transform(object,vector(geometry.position,geometry.indices[offset]*3),millimetersPerUnit);
  const b=transform(object,vector(geometry.position,geometry.indices[offset+1]*3),millimetersPerUnit);
  const c=transform(object,vector(geometry.position,geometry.indices[offset+2]*3),millimetersPerUnit);
  const n=normal(a,b,c);if(length(n)<1e-9)degenerate++;
  for(const point of [a,b,c])for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],point[axis]);max[axis]=Math.max(max[axis],point[axis]);}
  triangles.push({a,b,c,normal:n});
 }
 const edges=new Map<string,number>();
 for(const triangle of triangles)for(const [a,b] of [[triangle.a,triangle.b],[triangle.b,triangle.c],[triangle.c,triangle.a]] as [Vec3,Vec3][]){const key=edgeKey(a,b);edges.set(key,(edges.get(key)||0)+1);}
 let boundary=0,nonmanifold=0;
 for(const count of edges.values()){if(count===1)boundary++;else if(count>2)nonmanifold++;}
 return {index,type,triangles,bounds:{min,max},degenerate,boundary,nonmanifold,thickness:thicknessOf(triangles)};
}
function resolve(options:StlOptions){
 const millimetersPerUnit=options.millimetersPerUnit??DEFAULT_MM_PER_UNIT,minWallMm=options.minWallMm??DEFAULT_MIN_WALL_MM;
 if(!Number.isFinite(millimetersPerUnit)||millimetersPerUnit<=0||millimetersPerUnit>1e6)throw new Error('La escala debe ser un número positivo de milímetros por unidad.');
 if(!Number.isFinite(minWallMm)||minWallMm<=0||minWallMm>1e6)throw new Error('El grosor mínimo debe ser un número positivo en milímetros.');
 return {millimetersPerUnit,minWallMm};
}
function analyze(scene:Scene,options:StlOptions){
 const {millimetersPerUnit,minWallMm}=resolve(options);
 const geometries={box:boxGeometry(),sphere:sphereGeometry(),cylinder:cylinderGeometry(),cone:coneGeometry()},meshes:ObjectMesh[]=[],errors:MeshIssue[]=[],warnings:MeshIssue[]=[];
 for(let index=0;index<scene.objects.length;index++){
  const object=scene.objects[index];
  if(!object||!['box','sphere','cylinder','cone'].includes(object.type)){errors.push({code:'geometry',message:`Objeto ${index+1}: tipo de geometría no reconocido.`,object:index+1});continue;}
  if(![...object.position,...object.size,object.yaw].every(Number.isFinite)||object.size.some(value=>value<=0)){errors.push({code:'geometry',message:`Objeto ${index+1}: posición, tamaño o giro no finitos, o tamaño no positivo.`,object:index+1});continue;}
  const mesh=buildMesh(object,index+1,object.type,geometries[object.type],millimetersPerUnit);meshes.push(mesh);
  if(mesh.degenerate)errors.push({code:'degenerate',message:`Objeto ${mesh.index}: ${mesh.degenerate} triángulo(s) degenerado(s).`,object:mesh.index});
  if(mesh.boundary)errors.push({code:'open',message:`Objeto ${mesh.index}: malla abierta, ${mesh.boundary} arista(s) sin vecino.`,object:mesh.index});
  if(mesh.nonmanifold)errors.push({code:'nonmanifold',message:`Objeto ${mesh.index}: ${mesh.nonmanifold} arista(s) con más de dos caras.`,object:mesh.index});
  if(mesh.thickness===null)warnings.push({code:'thickness',message:`Objeto ${mesh.index}: no se pudo medir el grosor local; revisa la malla y su orientación.`,object:mesh.index});
  else if(mesh.thickness<minWallMm)warnings.push({code:'thin',message:`Objeto ${mesh.index}: grosor local mínimo ${mesh.thickness.toFixed(2)} mm, por debajo del mínimo orientativo ${minWallMm.toFixed(2)} mm.`,object:mesh.index});
 }
 if(!meshes.length)errors.push({code:'empty',message:'La escena no contiene geometría exportable.'});
 if(meshes.length>1)warnings.push({code:'shells',message:`La escena contiene ${meshes.length} cuerpos separados; no es una pieza única. Sepáralos o únelos en CAD antes de imprimir como un solo objeto.`});
 let overlaps=0;
 for(let first=0;first<meshes.length;first++)for(let second=first+1;second<meshes.length;second++){
  const a=meshes[first].bounds,b=meshes[second].bounds;
  if([0,1,2].every(axis=>a.min[axis]<b.max[axis]-1e-6&&a.max[axis]>b.min[axis]+1e-6))overlaps++;
 }
 if(overlaps)warnings.push({code:'overlap',message:`${overlaps} par(es) de objetos se solapan; cada malla está cerrada, pero la unión no es un sólido único.`});
 const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];
 for(const mesh of meshes)for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],mesh.bounds.min[axis]);max[axis]=Math.max(max[axis],mesh.bounds.max[axis]);}
 const empty=!meshes.length;
 const boundsMm:StlBounds=empty?{min:[0,0,0],max:[0,0,0]}:{min,max};
 const dimensionsMm:Vec3=[boundsMm.max[0]-boundsMm.min[0],boundsMm.max[1]-boundsMm.min[1],boundsMm.max[2]-boundsMm.min[2]];
 const thicknesses=meshes.map(mesh=>mesh.thickness).filter((value):value is number=>value!==null);
 const minThicknessMm=thicknesses.length?Math.min(...thicknesses):null;
 const closedObjects=meshes.filter(mesh=>!mesh.degenerate&&!mesh.boundary&&!mesh.nonmanifold).length;
 const ok=errors.length===0;
 const summary=ok
  ?`${warnings.length?`Malla cerrada con ${warnings.length} aviso(s) de fabricación.`:'Malla cerrada sin errores topológicos.'} Revisión orientativa: no certifica materiales, resistencia ni el laminador.`
  :`No exportar todavía: ${errors.length} error(es) de malla. Revisión orientativa: no certifica materiales, resistencia ni el laminador.`;
 return {millimetersPerUnit,minWallMm,meshes,boundsMm,report:{ok,objects:meshes.length,triangles:meshes.reduce((total,mesh)=>total+mesh.triangles.length,0),closedObjects,boundsMm,dimensionsMm,millimetersPerUnit,minWallMm,minThicknessMm,errors,warnings,summary} as MeshReport};
}

export function validateScene(scene:Scene,options:StlOptions={}):MeshReport{return analyze(scene,options).report;}

// This is a scene mesh, not a certified printable solid. The report checks
// topology and local solid thickness; it does not replace a slicer or material
// safety review.
export function sceneToStl(scene:Scene,options:StlOptions={}):StlExport{
 const prepared=analyze(scene,options);
 if(!prepared.meshes.length)throw new Error('La escena no contiene geometría exportable.');
 const facets:string[]=[];let triangles=0;
 for(const mesh of prepared.meshes)for(const triangle of mesh.triangles){
  facets.push(` facet normal ${format(triangle.normal[0])} ${format(triangle.normal[1])} ${format(triangle.normal[2])}\n  outer loop\n   vertex ${format(triangle.a[0])} ${format(triangle.a[1])} ${format(triangle.a[2])}\n   vertex ${format(triangle.b[0])} ${format(triangle.b[1])} ${format(triangle.b[2])}\n   vertex ${format(triangle.c[0])} ${format(triangle.c[1])} ${format(triangle.c[2])}\n  endloop\n endfacet`);
  triangles++;
 }
 // STL has no unit metadata. Coordinates are explicitly scaled to millimetres.
 return {stl:`solid atlas_scene_mm\n${facets.join('\n')}\nendsolid atlas_scene_mm\n`,triangles,objects:prepared.meshes.length,bounds:prepared.boundsMm,report:prepared.report};
}
