/** Self-contained glTF 2.0 mesh generator for basic world primitives.
 * No external textures, network requests or GPU execution.
 */
import {exportLiaGltfScene} from './lia-gltf-scene-export.mjs';
const cube=()=>({positions:[-0.5,-0.5,0.5,0.5,-0.5,0.5,0.5,0.5,0.5,-0.5,0.5,0.5,-0.5,-0.5,-0.5,0.5,-0.5,-0.5,0.5,0.5,-0.5,-0.5,0.5,-0.5],indices:[0,1,2,0,2,3,1,5,6,1,6,2,5,4,7,5,7,6,4,0,3,4,3,7,3,2,6,3,6,7,4,5,1,4,1,0]});
export function exportLiaMeshGltf(world){
 const gltf=exportLiaGltfScene(world);
 const eligible=new Set(['terrain','building','prop']);
 const meshes=[],accessors=[],bufferViews=[],bytes=[];
 let offset=0;
 const append=(data,target)=>{
  const pad=(4-offset%4)%4;
  for(let i=0;i<pad;i++)bytes.push(0);
  offset+=pad;
  const at=offset;
  for(const b of data)bytes.push(b);
  offset+=data.length;
  const index=bufferViews.length;
  bufferViews.push({buffer:0,byteOffset:at,byteLength:data.length,target});
  return index;
 };
 for(let i=0;i<world.objects.length;i++){
  const obj=world.objects[i];
  if(!eligible.has(obj.kind))continue;
  const g=cube();
  const vertices=Buffer.alloc(g.positions.length*4);
  g.positions.forEach((v,j)=>vertices.writeFloatLE(v,j*4));
  const indices=Buffer.alloc(g.indices.length*2);
  g.indices.forEach((v,j)=>indices.writeUInt16LE(v,j*2));
  const positionView=append(vertices,34962),indexView=append(indices,34963);
  const positionAccessor=accessors.length;
  accessors.push({bufferView:positionView,componentType:5126,count:g.positions.length/3,type:'VEC3',min:[-.5,-.5,-.5],max:[.5,.5,.5]});
  const indexAccessor=accessors.length;
  accessors.push({bufferView:indexView,componentType:5123,count:g.indices.length,type:'SCALAR'});
  const mesh=meshes.length;
  meshes.push({name:obj.id,primitives:[{attributes:{POSITION:positionAccessor},indices:indexAccessor,mode:4}]});
  gltf.nodes[i].mesh=mesh;
  gltf.nodes[i].extras.geometryGenerated=true;
 }
 if(meshes.length){
  gltf.buffers=[{byteLength:offset,uri:'data:application/octet-stream;base64,'+Buffer.from(bytes).toString('base64')}];
  gltf.bufferViews=bufferViews;
  gltf.accessors=accessors;
  gltf.meshes=meshes;
 }
 gltf.extras.meshesGenerated=meshes.length>0;
 gltf.extras.meshCount=meshes.length;
 gltf.extras.primitiveGeometryOnly=true;
 return gltf;
}
