/**
 * Atlas repository context map: deterministic, bounded, dependency-aware.
 * Accepts trusted file snapshots; does not read disk or execute code.
 */
const MAX_FILES=2000, MAX_FILE_BYTES=200000, MAX_TOTAL_BYTES=4000000;
const PATH=/^[a-zA-Z0-9_.\/-]{1,240}$/;
const IMPORT=/(?:\bimport\s*(?:[^'"]*?\sfrom\s*)?|\bexport\s+[^'"]*?\sfrom\s*|\bimport\s*\()\s*['"]([^'"]+)['"]/g;
function cleanPath(p){
 if(typeof p!=='string'||!PATH.test(p)||p.startsWith('/')||
    p.split('/').some(x=>!x||x==='.'||x==='..')||p.includes('\\'))throw Error('Invalid repository path');
 return p;
}
function resolveRelative(from,spec){
 if(!spec.startsWith('./')&&!spec.startsWith('../'))return null;
 const stack=from.split('/').slice(0,-1);
 for(const part of spec.split('/')){
  if(part==='.'||part==='')continue;
  if(part==='..'){if(!stack.length)return null;stack.pop();}
  else stack.push(part);
 }
 return stack.join('/');
}
export function buildAtlasRepoMap(files=[]){
 if(!Array.isArray(files)||files.length>MAX_FILES)throw Error('Invalid repository file list');
 const map=new Map();let total=0;
 for(const file of files){
  const path=cleanPath(file?.path);
  if(map.has(path)||typeof file.content!=='string')throw Error('Duplicate or invalid file');
  const bytes=new TextEncoder().encode(file.content).length;
  total+=bytes;
  if(bytes>MAX_FILE_BYTES||total>MAX_TOTAL_BYTES)throw Error('Repository context budget exceeded');
  map.set(path,{path,content:file.content,bytes});
 }
 const result=[...map.values()].map(file=>{
  const imports=new Set();let match;IMPORT.lastIndex=0;
  while((match=IMPORT.exec(file.content))!==null){
   const candidate=resolveRelative(file.path,match[1]);
   if(candidate){
    const resolved=[candidate,candidate+'.mjs',candidate+'.js',candidate+'/index.mjs',candidate+'/index.js']
      .find(p=>map.has(p));
    if(resolved)imports.add(resolved);
   }
  }
  return {path:file.path,bytes:file.bytes,imports:[...imports].sort()};
 });
 return {schemaVersion:1,files:result.sort((a,b)=>a.path.localeCompare(b.path)),totalBytes:total};
}
export function selectAtlasRepoContext(repoMap,{targets=[],maxFiles=30,maxBytes=120000}={}){
 if(!repoMap||!Array.isArray(repoMap.files)||!Array.isArray(targets)||
    !Number.isSafeInteger(maxFiles)||maxFiles<1||maxFiles>200||
    !Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>1000000)
   throw Error('Invalid context request');
 const nodes=new Map(repoMap.files.map(f=>[f.path,f]));
 const selected=[];const seen=new Set();const queue=targets.map(cleanPath);
 let bytes=0;
 while(queue.length&&selected.length<maxFiles){
  const path=queue.shift();
  if(seen.has(path))continue;
  seen.add(path);const file=nodes.get(path);
  if(!file)continue;
  if(bytes+file.bytes>maxBytes)continue;
  selected.push(file);bytes+=file.bytes;
  for(const dep of file.imports)if(!seen.has(dep))queue.push(dep);
 }
 return {files:selected,totalBytes:bytes,missingTargets:targets.filter(t=>!nodes.has(t))};
}

/**
 * Select affected modules (reverse dependencies) to target regression tests.
 * Bounded breadth-first traversal; never executes source code.
 */
export function selectAtlasAffectedModules(repoMap,{targets=[],maxFiles=100}={}){
 if(!repoMap||!Array.isArray(repoMap.files)||!Array.isArray(targets)||
    !Number.isSafeInteger(maxFiles)||maxFiles<1||maxFiles>200)
  throw Error('Invalid affected-module request');
 const reverse=new Map(repoMap.files.map(f=>[f.path,[]]));
 for(const file of repoMap.files){
  if(!Array.isArray(file.imports))throw Error('Invalid repository map');
  for(const dependency of file.imports)if(reverse.has(dependency))reverse.get(dependency).push(file.path);
 }
 const missingTargets=targets.map(cleanPath).filter(p=>!reverse.has(p));
 const queue=targets.filter(p=>reverse.has(p)),seen=new Set(),affected=[];
 while(queue.length&&affected.length<maxFiles){
  const path=queue.shift();
  if(seen.has(path))continue;
  seen.add(path);affected.push(path);
  for(const dependent of (reverse.get(path)||[]).sort())if(!seen.has(dependent))queue.push(dependent);
 }
 return {affected,missingTargets,truncated:queue.length>0};
}
