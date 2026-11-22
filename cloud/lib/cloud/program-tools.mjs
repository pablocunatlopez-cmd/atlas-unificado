export const PROGRAM_VERSION='atlas-program-tools-3';
// Every function is self-contained, so its exact implementation can be exported.
function sortNumbers(input){
 if(!Array.isArray(input)||input.length>128||input.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('Se requiere una lista de hasta 128 números finitos.');
 return [...input].sort((a,b)=>a-b);
}
function deduplicate(input){
 if(!Array.isArray(input)||input.length>128||input.some(v=>v!==null&&!['string','number','boolean'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v)))throw Error('Se requiere una lista de hasta 128 valores simples.');
 return [...new Set(input)];
}
function statistics(input){
 if(!Array.isArray(input)||input.length>128||input.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('Se requiere una lista de hasta 128 números finitos.');
 const count=input.length;let sum=0,correction=0;
 // Neumaier compensation preserves small terms lost when opposite large values cancel.
 // Intermediate overflow is still rejected: this is bounded floating-point arithmetic.
 for(const value of input){const next=sum+value;if(!Number.isFinite(next))throw Error('El total supera el rango numérico.');correction+=Math.abs(sum)>=Math.abs(value)?(sum-next)+value:(value-next)+sum;sum=next;}
 const total=sum+correction;if(!Number.isFinite(total))throw Error('El total supera el rango numérico.');
 const sorted=[...input].sort((a,b)=>a-b);let median=null;
 if(count){const middle=Math.floor(count/2);if(count%2)median=sorted[middle];else{const lower=sorted[middle-1],upper=sorted[middle],pair=lower+upper;median=Number.isFinite(pair)?pair/2:lower/2+upper/2;}}
 return{count,total,mean:count?total/count:null,min:count?sorted[0]:null,max:count?sorted[count-1]:null,median};
}
function countValues(input){
 if(!Array.isArray(input)||input.length>128||input.some(v=>v!==null&&!['string','number','boolean'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v)))throw Error('Se requiere una lista de hasta 128 valores simples.');
 const counts=new Map();for(const value of input)counts.set(value,(counts.get(value)||0)+1);return [...counts].map(([value,count])=>({value,count}));
}
function mergeIntervals(input){
 if(!Array.isArray(input)||input.length>128||input.some(v=>!Array.isArray(v)||v.length!==2||v.some(n=>typeof n!=='number'||!Number.isFinite(n))||v[0]>v[1]))throw Error('Se requieren hasta 128 intervalos [inicio, fin] ordenados internamente.');
 const sorted=input.map(v=>[...v]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),result=[];
 for(const interval of sorted){const previous=result.at(-1);if(previous&&interval[0]<=previous[1])previous[1]=Math.max(previous[1],interval[1]);else result.push(interval);}return result;
}
const definitions={
 sort:{name:'Ordenar números',run:sortNumbers,cases:[{input:[10,-2,3,3],expected:[-2,3,3,10]},{input:[],expected:[]},{input:[0,-1],expected:[-1,0]}]},
 dedupe:{name:'Eliminar duplicados',run:deduplicate,cases:[{input:[1,'1',1,null,false,null],expected:[1,'1',null,false]},{input:[],expected:[]},{input:['__proto__','__proto__'],expected:['__proto__']}]},
 stats:{name:'Estadísticas',run:statistics,cases:[{input:[1,2,3,4],expected:{count:4,total:10,mean:2.5,min:1,max:4,median:2.5}},{input:[],expected:{count:0,total:0,mean:null,min:null,max:null,median:null}},{input:[-4,2,9],expected:{count:3,total:7,mean:7/3,min:-4,max:9,median:2}}]},
 counts:{name:'Contar frecuencias',run:countValues,cases:[{input:[1,'1',1],expected:[{value:1,count:2},{value:'1',count:1}]},{input:[],expected:[]},{input:[null,false,null],expected:[{value:null,count:2},{value:false,count:1}]}]},
 intervals:{name:'Fusionar intervalos',run:mergeIntervals,cases:[{input:[[5,8],[1,3],[2,6]],expected:[[1,8]]},{input:[],expected:[]},{input:[[1,2],[2,3],[8,9]],expected:[[1,3],[8,9]]}]}
};
export function programCatalog(){return Object.entries(definitions).map(([id,d])=>({id,name:d.name,checks:d.cases.length,version:PROGRAM_VERSION}));}
export function verifyProgramLibrary(){
 const checks=Object.entries(definitions).flatMap(([operation,d])=>d.cases.map((c,i)=>({operation,name:'Contrato '+(i+1),passed:JSON.stringify(d.run(structuredClone(c.input)))===JSON.stringify(c.expected)})));
 return{version:PROGRAM_VERSION,passed:checks.filter(c=>c.passed).length,total:checks.length,checks,scope:'Contratos fijos de cinco funciones de biblioteca; repetirlos no demuestra una mejora nueva ni programación general.'};
}
export function runProgramTool(operation,input){
 if(!Object.hasOwn(definitions,operation))throw Error('Herramienta de datos no admitida.');
 const serialized=JSON.stringify(input);if(typeof serialized!=='string'||serialized.length>8000)throw Error('Los datos superan el límite admitido.');
 const tool=definitions[operation],checks=tool.cases.map((c,i)=>({name:'Contrato '+(i+1),passed:JSON.stringify(tool.run(structuredClone(c.input)))===JSON.stringify(c.expected)}));
 if(checks.some(c=>!c.passed))throw Error('La herramienta no superó sus contratos; no se ejecutó el encargo.');
 const result=tool.run(input);if(JSON.stringify(result).length>8000)throw Error('El resultado supera el límite admitido.');
 return{tool:PROGRAM_VERSION,operation,name:tool.name,result,checks,source:`export const ${operation} = ${tool.run.toString()};`,scope:'Se ejecutó una función de la biblioteca de Atlas sobre estos datos. Los contratos no prueban corrección para cualquier entrada. Precisión numérica limitada; no se ejecuta código generado por modelos.'};
}
export function programRequest(question){
 const match=/^(ordena|deduplica|elimina duplicados|estad[ií]sticas(?: de)?|calcula estad[ií]sticas(?: de)?|cuenta frecuencias|cuenta repeticiones|fusiona intervalos|une intervalos)\s*:?\s*(\[[\s\S]*\])\s*[?.]?$/i.exec(question.trim());
 if(!match)return null;
 const verb=match[1].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),operation=verb==='ordena'?'sort':/duplic/.test(verb)?'dedupe':/estadisticas/.test(verb)?'stats':/cuenta/.test(verb)?'counts':'intervals';
 try{return runProgramTool(operation,JSON.parse(match[2]));}catch(error){return{error:error instanceof Error?error.message:'No se pudieron procesar los datos.'};}
}
export function programAnswer(result){
 if(result.error)return 'No pude ejecutar esa operación: '+result.error;
 return `${result.name}:\n\n\`\`\`json\n${JSON.stringify(result.result,null,2)}\n\`\`\`\n\nEjecución real en Sites · ${result.checks.filter(c=>c.passed).length}/${result.checks.length} contratos de la herramienta comprobados · sin consumir inferencia.\n\nImplementación ejecutada:\n\`\`\`javascript\n${result.source}\n\`\`\`\n\n${result.scope}`;
}
