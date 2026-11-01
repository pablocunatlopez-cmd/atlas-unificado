import {getQuickJS} from 'quickjs-emscripten';
import {isDeepStrictEqual} from 'node:util';
import {randomUUID} from 'node:crypto';
import {chat} from './chat.mjs';
export async function executePure(source,input){
 if(typeof source!=='string'||source.length>16000||JSON.stringify(input)?.length>30000)throw Error('Extensión o entrada demasiado grande');
 const Q=await getQuickJS();const runtime=Q.newRuntime();runtime.setMemoryLimit(16*1024*1024);runtime.setMaxStackSize(256*1024);const deadline=Date.now()+250;runtime.setInterruptHandler(()=>Date.now()>deadline);const vm=runtime.newContext();
 try{const result=vm.evalCode(`"use strict";\n${source}\n;JSON.stringify(transform(JSON.parse(${JSON.stringify(JSON.stringify(input??null))})))`);
  if(result.error){const error=vm.dump(result.error);result.error.dispose();throw Error('Ejecución aislada: '+(error.message||'fallo'));}
  try{const output=vm.getString(result.value);if(output.length>64000)throw Error('Salida demasiado larga');return JSON.parse(output);}finally{result.value.dispose();}
 }finally{vm.dispose();runtime.dispose();}
}
export async function evaluateExtension(spec){
 if(!spec||typeof spec.name!=='string'||typeof spec.source!=='string'||!Array.isArray(spec.tests)||spec.tests.length<1||spec.tests.length>6)throw Error('Se requiere nombre, código y entre 1 y 6 pruebas');
 const results=[];for(const t of spec.tests){try{const actual=await executePure(spec.source,t.input);results.push({input:t.input,expected:t.expected,actual,passed:isDeepStrictEqual(actual,t.expected)});}catch(e){results.push({passed:false,error:e.message});}}
 return {passed:results.every(r=>r.passed),results};
}
export function validateAcceptance(tests){
 if(!Array.isArray(tests)||tests.length>8||JSON.stringify(tests).length>12000||tests.some(t=>!t||!Object.hasOwn(t,'input')||!Object.hasOwn(t,'expected')))throw Error('Los casos de aceptación deben ser hasta 8 objetos con input y expected.');
 return structuredClone(tests);
}
export async function buildExtension(task,key,acceptance=[],generate=chat,{format='json',name='Herramienta local'}={}){
 if(typeof task!=='string'||!task.trim()||task.length>4000)throw Error('Describe la herramienta en hasta 4000 caracteres');
 const acceptanceTests=validateAcceptance(acceptance),attempts=[];
 if(format==='code'&&!acceptanceTests.length)throw Error('La programación directa requiere casos de aceptación externos.');
 const prompt='Crea una extensión de Atlas como función JavaScript pura transform(input). Escribe source en UNA SOLA LÍNEA, sin saltos de línea ni secuencias de escape para saltos. No imports, no exports, no fetch, no procesos, no archivos, no temporizadores. Solo cálculo, texto o JSON. Devuelve SOLO JSON válido con {"name":"nombre", "source":"function transform(input) { ... }", "tests":[{"input":...,"expected":...}]}. Añade 2 a 4 ejemplos concretos. No prometas acceso web ni modificar el servidor. Petición: '+task;
 const codePrompt='Crea function transform(input) en JavaScript como función pura de JSON. Devuelve SOLO el código JavaScript completo, legible, sin explicaciones, imports, exports, red, archivos ni procesos. No lo envuelvas en JSON. Revisa entradas vacías, validación de tipos y casos límite. Petición: '+task;
 let feedback='',record,lastSource='';
 for(let attempt=1;attempt<=3;attempt++){
  const messages=format==='code'&&lastSource?[{role:'user',content:codePrompt.slice(0,5000)},{role:'assistant',content:lastSource},{role:'user',content:'Corrige la implementación anterior. Mantén la interfaz y todos los requisitos originales. Estos son fallos de ejecución reales, no opiniones: '+feedback.slice(-3000)+'\nDevuelve solo el código completo.'}]:[{role:'user',content:(format==='code'?codePrompt:prompt).slice(0,5000)+feedback.slice(-1000)}];
  const answer=await generate({messages,json:format!=='code',...(format==='code'?{refute:true,toolRepair:true}:{})},[],fetch,key);
  try{
   const raw=answer.answer.trim().replace(format==='code'?/^```(?:javascript|js)?\s*/i:/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
   const spec=format==='code'?{name,source:raw,tests:acceptanceTests.slice(0,2)}:JSON.parse(raw);
   if(typeof spec.source!=='string'||spec.source.length>16000)throw Error('El código debe tener hasta 16.000 caracteres; devuelve una implementación más compacta.');
   lastSource=spec.source;const checks=await evaluateExtension(spec);
   const acceptanceResults=[];for(const test of acceptanceTests){try{const actual=await executePure(spec.source,test.input);acceptanceResults.push({...test,actual,passed:isDeepStrictEqual(actual,test.expected)});}catch(e){acceptanceResults.push({...test,passed:false,error:e.message});}}
   const passed=checks.passed&&acceptanceResults.every(t=>t.passed);
   attempts.push({attempt,source:spec.source,passed,modelResults:checks.results,acceptanceResults});
   record={id:randomUUID(),at:new Date().toISOString(),task,name:spec.name.slice(0,120),source:spec.source,tests:spec.tests,testOrigin:format==='code'?'external-contract':'model-examples',results:checks.results,acceptanceTests,acceptanceResults,passed,attempt,attempts:structuredClone(attempts),scope:acceptanceTests.length?'Casos definidos fuera del modelo. Los fallos se reutilizan para reparar: no son un test ciego final.':'Solo pruebas propuestas por el modelo; sin validación independiente.'};
   if(passed)return record;feedback='\nCorrige el código anterior: '+spec.source+'\nFallos observados: '+JSON.stringify([...checks.results,...acceptanceResults].filter(t=>!t.passed)).slice(0,2500);}
  catch(e){attempts.push({attempt,passed:false,error:e.message});record={id:randomUUID(),at:new Date().toISOString(),task,passed:false,attempt,attempts:structuredClone(attempts),error:e.message};feedback='\nEl intento anterior no era válido: '+e.message;}
 }return record;
}

// Repairs retain the previous version and evaluate its known examples as regressions.
export async function improveExtension(previous,task,key,acceptance=[],generate=chat){
 if(!previous?.passed||typeof previous.source!=='string')throw Error('La versión de partida debe haber superado sus comprobaciones.');
 const cases=validateAcceptance(acceptance);
 if(!cases.length)throw Error('Indica al menos un caso de aceptación para medir la mejora.');
 const baseline=[];
 for(const test of cases){try{const actual=await executePure(previous.source,test.input);baseline.push({...test,actual,passed:isDeepStrictEqual(actual,test.expected)});}catch(e){baseline.push({...test,passed:false,error:e.message});}}
 if(baseline.every(x=>x.passed))throw Error('La versión actual ya supera estos casos; no demuestran una mejora.');
 const candidate=await buildExtension(task,key,cases,generate);
 const regressions=[];
 if(candidate.passed){
  for(const test of [...(previous.tests||[]),...(previous.acceptanceTests||[])]){
   try{const actual=await executePure(candidate.source,test.input);regressions.push({...test,actual,passed:isDeepStrictEqual(actual,test.expected)});}catch(e){regressions.push({...test,passed:false,error:e.message});}
  }
 }
 const accepted=candidate.passed&&regressions.every(x=>x.passed);
 return {...candidate,passed:accepted,parentId:previous.id,improvement:{baseline,regressions,accepted,decision:accepted?'accepted':'rejected',scope:'Mejora medida en estos casos; no prueba general ni modificación de pesos. La versión anterior se conserva.'}};
}
