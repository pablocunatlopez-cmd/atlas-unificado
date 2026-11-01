import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {planCreativeWorld,validateCreativePlan} from './creative-plan.mjs';

const RUNTIME_HASH='7e047a9e84984e83659bf457a99156ad672d019fc593303d89ef425f30fadc9e';
const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const finite=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const vector=(value,min=-100,max=100)=>Array.isArray(value)&&value.length===3&&value.every(n=>finite(n,min,max));
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scriptJSON=value=>JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
const PALETTES={Titanio:[.56,.6,.64],Oro:[.83,.57,.22],Azul:[.045,.18,.7],Rojo:[.65,.055,.045],Verde:[.08,.3,.18],Rosa:[.65,.08,.42],Blanco:[.88,.87,.82],Negro:[.055,.06,.065]};
const MATERIALS=[[[.63,.61,.56],.65,0,0],[[.82,.8,.75],.7,0,0],[null,.18,.92,0],[[.15,.2,.15],.94,0,0],[[.18,.105,.06],.9,0,0],[[.85,.55,.12],.2,.9,0],[[.93,.86,.66],.5,0,6],[[.36,.05,.25],.25,.3,4],[[.025,.03,.035],.4,.15,0],[[.45,.48,.52],.22,.98,0],[[.75,.31,.13],.5,0,0],[[.15,.42,.59],.3,.6,0]];
const CONTRACTS=['finite_geometry','ground_and_endpoints','materials','mesh_budget','camera_clear','spawn_clear'];

// This is coordinator code, independent of the model's judgement of its scene.
// The renderer shares three fixed meshes; no model-supplied shader/code is used.
export function evaluateCreativeScene(scene,{maxObjects=8,maxTriangles=6000}={}){
 const objects=Array.isArray(scene?.objects)?scene.objects:[],materials=Array.isArray(scene?.materials)?scene.materials:[];
 const shapeValid=o=>o&&['box','sphere'].includes(o.type)&&vector(o.position,-24,24)&&vector(o.size,.1,3)&&finite(o.yaw,-Math.PI,Math.PI);
 const geometry=objects.length>0&&objects.length<=maxObjects&&objects.every(shapeValid);
 const bounds=o=>{const c=Math.abs(Math.cos(o.yaw)),s=Math.abs(Math.sin(o.yaw));return [c*o.size[0]+s*o.size[2],o.size[1],s*o.size[0]+c*o.size[2]];};
 const endpoints=geometry&&objects.every(o=>{const half=bounds(o);return half.every((r,i)=>Number.isFinite(o.position[i]-r)&&Number.isFinite(o.position[i]+r)&&Math.abs(o.position[i])+r<=32)&&o.position[1]-half[1]>=-1e-7;})&&vector(scene?.camera)&&vector(scene?.target)&&vector(scene?.sun,-1,1)&&Math.hypot(...scene.sun)>1e-5&&Math.hypot(...scene.camera.map((v,i)=>v-scene.target[i]))>.1&&finite(scene?.fog,0,.1)&&finite(scene?.exposure,.1,2)&&vector(scene?.sky,0,1);
 const materialOK=materials.length===12&&materials.every(m=>m&&vector(m.color,0,1)&&finite(m.roughness,0,1)&&finite(m.metalness,0,1)&&finite(m.emission,0,6))&&objects.every(o=>Number.isInteger(o?.material)&&o.material>=0&&o.material<materials.length);
 const triangles=geometry?12+objects.reduce((sum,o)=>sum+(o.type==='sphere'?432:12)+24,0):null;
 // Conservative rotated AABBs deliberately reserve both orbit-camera space
 // and the established exploration spawn, rather than claiming path finding.
 const clear=point=>geometry&&vector(point)&&objects.every(o=>{const half=bounds(o);return point.some((v,i)=>Math.abs(v-o.position[i])>half[i]+.35);});
 const values=[geometry,endpoints,materialOK,triangles!==null&&triangles<=maxTriangles,clear(scene?.camera),clear([0,1.65,8])];
 const checks=CONTRACTS.map((id,i)=>({id,passed:values[i]===true}));
 return {checks,cases:checks.length,passed:checks.filter(item=>item.passed).length,invariantsPreserved:values.every(Boolean),metrics:{objects:objects.length,triangles,triangleBudget:maxTriangles,objectBudget:maxObjects,renderer:'raster',renderVerified:false}};
}

function sceneFromPlan(plan,seed){
 const sky=plan.lighting==='night'?[.045,.065,.14]:plan.lighting==='sunset'?[.7,.43,.25]:[.35,.52,.78];
 return {brief:{mode:'3d',title:plan.title,variant:plan.variant,lighting:plan.lighting,palette:plan.palette,quality:'balanced',seed},objects:structuredClone(plan.objects),materials:MATERIALS.map(([color,roughness,metalness,emission])=>({color:[...(color||PALETTES[plan.palette])],roughness,metalness,emission})),camera:[7,4.1,8],target:[0,1,0],sky,sun:plan.lighting==='sunset'?[-.85,.2,.35]:[-.5,.8,.45],fog:.002,exposure:plan.lighting==='night'?.55:1,scene:0};
}

function artifactHTML(plan,scene,runtime){
 const policy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'";
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}"><title>${escapeHTML(plan.title)} · Atlas</title><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#14171c;color:#fff;font:12px system-ui}canvas{display:block;width:100%;height:100%;touch-action:none;outline:none}header,footer{position:absolute;left:18px;right:18px;display:flex;justify-content:space-between;gap:12px;pointer-events:none;text-shadow:0 1px 8px #000}header{top:18px}footer{bottom:18px;font-size:11px}button{pointer-events:auto;background:#171717aa;color:#fff;border:1px solid #ffffff55;border-radius:8px;padding:8px 12px}footer .error{background:#441b18;padding:12px}h1{font-size:14px;margin:0;max-width:75%}</style></head><body><canvas aria-label="Escenario 3D interactivo"></canvas><header><h1>${escapeHTML(plan.title)}</h1><button data-png>PNG</button></header><div data-hud hidden></div><footer><span data-status>Preparando vista 3D…</span><span>Arrastra · zoom con rueda o dos dedos</span></footer><script>${runtime}\natlasRuntime(${scriptJSON({scene})});</script></body></html>`;
}

function question(goal){
 const value=typeof goal==='string'?goal:goal?.question??goal?.objective??goal?.description??goal?.title;
 if(typeof value!=='string'||!value.trim()||value.length>4000)throw Error('La experiencia requiere una pregunta de 1 a 4000 caracteres.');
 return value.trim();
}

/** Artifacts are data + a reviewed fixed raster runtime, never model code.
 * This experiment records structural evidence, not image quality or a model
 * improvement. The caller decides whether and where to show the saved HTML.
 */
export function createCreativeExperience({directory,generate,now=Date.now}={}){
 if(typeof directory!=='string'||!path.isAbsolute(directory))throw Error('Se requiere un directorio absoluto para las experiencias creativas.');
 if(typeof generate!=='function')throw Error('Se requiere el generador local de planes.');
 const root=path.resolve(directory),stateFile=path.join(root,'experience-creative.json');
 let state={version:1,jobs:[],evidenceHashes:[],requests:0,artifacts:0},loaded=false,running=false;
 async function load(){if(loaded)return;try{const saved=JSON.parse(await fs.readFile(stateFile,'utf8'));if(saved?.version===1&&Array.isArray(saved.jobs)&&Array.isArray(saved.evidenceHashes))state={version:1,jobs:saved.jobs.slice(-100),evidenceHashes:saved.evidenceHashes.filter(value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)).slice(-1000),requests:Number.isSafeInteger(saved.requests)?saved.requests:0,artifacts:Number.isSafeInteger(saved.artifacts)?saved.artifacts:0};}catch(error){if(error.code!=='ENOENT')throw error;}loaded=true;}
 async function save(result){state.requests++;state.jobs.push({at:new Date(now()).toISOString(),artifactId:result.artifactId,evidenceHash:result.evidenceHash,executed:result.executed,cases:result.cases,passed:result.passed,reason:result.reason,metrics:result.metrics,checks:result.checks||[],plan:result.plan});state.jobs=state.jobs.slice(-100);if(result.executed){state.artifacts++;if(!state.evidenceHashes.includes(result.evidenceHash))state.evidenceHashes.push(result.evidenceHash);state.evidenceHashes=state.evidenceHashes.slice(-1000);}await fs.mkdir(root,{recursive:true});await fs.writeFile(stateFile+'.tmp',JSON.stringify(state,null,2));await fs.rename(stateFile+'.tmp',stateFile);}
 async function experiment({goal,seed=0,signal}={}){
  const prompt=question(goal);if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw Error('La semilla debe ser uint32.');
  signal?.throwIfAborted();if(running)throw Error('Ya existe una experiencia creativa en curso.');running=true;
  try{
   await load();signal?.throwIfAborted();
   const base={executed:false,cases:0,passed:0,acceptedChange:false,invariantsPreserved:true,plan:null,title:null,artifactId:null,evidenceHash:null,newEvidence:false,metrics:{renderer:'raster',renderVerified:false}};
   let planned;
   try{planned=await planCreativeWorld(prompt,'3d',async(text,options)=>{const raw=await generate(text+'\nContrato adicional del experimento: incluye de uno a ocho objetos, completamente por encima de y=0. Reserva sin geometría la cámara [7,4.1,8] y el inicio [0,1.65,8], con margen de 0.35. No afirmes haber visto el render.',options);signal?.throwIfAborted();const output=typeof raw?.answer==='string'?raw.answer:raw;if((typeof output==='string'?output:JSON.stringify(output)||'').length>32000)throw Error('La respuesta supera el presupuesto de datos.');return output;},{signal});}
   catch(error){signal?.throwIfAborted();const result={...base,reason:'plan_unavailable',summary:'No se obtuvo un plan válido; no se creó un escenario ni se cambió el núcleo.'};await save(result);return result;}
   signal?.throwIfAborted();const plan=validateCreativePlan(planned.plan,'3d'),scene=sceneFromPlan(plan,seed),assessment=evaluateCreativeScene(scene);
   if(!assessment.invariantsPreserved){const result={...base,...assessment,plan,title:plan.title,reason:'scene_contract_refuted',summary:'El plan fue refutado por contratos geométricos externos; no se creó un HTML ejecutable.'};await save(result);return result;}
   const runtime=(await fs.readFile(new URL('./creative-raster-runtime.js',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
   if(digest(runtime)!==RUNTIME_HASH)throw Error('El runtime raster no coincide con el asset revisado.');
   const html=artifactHTML(plan,scene,runtime),evidenceHash=digest({objects:scene.objects,materials:scene.materials,camera:scene.camera,target:scene.target,sky:scene.sky,sun:scene.sun,fog:scene.fog,exposure:scene.exposure,runtimeHash:RUNTIME_HASH});
   const artifactId='creative-'+digest({plan,scene,runtimeHash:RUNTIME_HASH}).slice(0,24),folder=path.join(root,artifactId);
   const artifactFiles={html:path.join(folder,'index.html'),plan:path.join(folder,'plan.json'),manifest:path.join(folder,'manifest.json')};
   const manifest={version:1,artifactId,title:plan.title,evidenceHash,runtimeHash:RUNTIME_HASH,checks:assessment.checks,metrics:assessment.metrics,modelCodeExecuted:false,coreChanged:false,renderVerified:false,scope:'Plan JSON y geometría comprobados en CPU. La imagen y la interacción todavía no se han observado en un navegador.'};
   await fs.mkdir(folder,{recursive:true});signal?.throwIfAborted();
   await fs.writeFile(artifactFiles.plan+'.tmp',JSON.stringify(plan,null,2));await fs.rename(artifactFiles.plan+'.tmp',artifactFiles.plan);
   await fs.writeFile(artifactFiles.manifest+'.tmp',JSON.stringify(manifest,null,2));await fs.rename(artifactFiles.manifest+'.tmp',artifactFiles.manifest);
   signal?.throwIfAborted();await fs.writeFile(artifactFiles.html+'.tmp',html);signal?.throwIfAborted();await fs.rename(artifactFiles.html+'.tmp',artifactFiles.html);
   const result={...base,...assessment,executed:true,plan,title:plan.title,artifactId,artifactFiles,evidenceHash,newEvidence:!state.evidenceHashes.includes(evidenceHash),reason:'artifact_created',summary:`Artefacto 3D raster creado: ${assessment.passed}/${assessment.cases} contratos estructurales, ${assessment.metrics.objects} objetos y ${assessment.metrics.triangles} triángulos estimados. Su imagen y calidad visual no se han verificado; no se cambió el núcleo.`};
   await save(result);return result;
  }finally{running=false;}
 }
 return {experiment,status:()=>({running,...structuredClone(state),scope:'Experimentos de planes 3D con contratos estructurales; sin modificación del núcleo ni prueba visual automática.'})};
}
