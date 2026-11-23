// A finite expression language. Generated data never becomes JavaScript.
export const PROGRAM_LAB_VERSION='atlas-program-lab-1';
export const PROGRAM_SCOPE='Programas numéricos en un lenguaje acotado, ejecutados realmente sobre listas JSON. Sin JavaScript arbitrario, red, archivos ni cambios de pesos. Las pruebas no demuestran programación general.';
const arities={input:0,item:0,number:0,add:2,sub:2,mul:2,div:2,gt:2,lt:2,eq:2,if:3,map:2,filter:2,sum:1,length:1};
export function validateProgram(raw){
 if(!raw||typeof raw!=='object'||JSON.stringify(raw).length>6000)throw Error('Programa demasiado grande o ausente.');
 let nodes=0;
 function check(n,depth=0,item=false){
  if(++nodes>96||depth>12||!n||typeof n!=='object'||Array.isArray(n)||!Object.hasOwn(arities,n.op))throw Error('Instrucción no admitida o límite estructural.');
  if(Object.keys(n).some(k=>!['op','args','value'].includes(k)))throw Error('Campo no admitido.');
  const args=n.args??[];if(!Array.isArray(args)||args.length!==arities[n.op])throw Error('Número de argumentos incorrecto.');
  if(n.op==='number'){if(typeof n.value!=='number'||!Number.isFinite(n.value)||Math.abs(n.value)>1e12)throw Error('Constante no admitida.');}
  else if('value' in n)throw Error('Valor ajeno a una constante.');
  if(n.op==='item'&&!item)throw Error('item solo existe dentro de map/filter.');
  args.forEach((a,i)=>check(a,depth+1,item||(['map','filter'].includes(n.op)&&i===1)));
 }
 check(raw);return structuredClone(raw);
}
export function executeProgram(raw,input){
 const program=validateProgram(raw);
 if(!Array.isArray(input)||input.length>128||input.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e6))throw Error('Entrada: hasta 128 números finitos entre -1000000 y 1000000.');
 let steps=0;
 const finite=x=>{if(typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>1e18)throw Error('Resultado fuera de rango.');return x;};
 const array=x=>{if(!Array.isArray(x)||x.length>128)throw Error('Se esperaba una lista acotada.');return x;};
 function run(n,item){
  if(++steps>8192)throw Error('Presupuesto de ejecución agotado.');
  const a=n.args||[],arg=i=>run(a[i],item),num=i=>finite(arg(i));
  switch(n.op){
   case 'input':return input.slice();case 'item':return finite(item);case 'number':return n.value;
   case 'if':{const condition=arg(0);if(typeof condition!=='boolean')throw Error('Condición no booleana.');return run(a[condition?1:2],item);}
   case 'map':return array(arg(0)).map(x=>run(a[1],x));
   case 'filter':return array(arg(0)).filter(x=>{const yes=run(a[1],x);if(typeof yes!=='boolean')throw Error('Filtro no booleano.');return yes;});
   case 'sum':return finite(array(arg(0)).reduce((s,x)=>finite(s+finite(x)),0));
   case 'length':return array(arg(0)).length;
   case 'add':return finite(num(0)+num(1));case 'sub':return finite(num(0)-num(1));case 'mul':return finite(num(0)*num(1));
   case 'div':{const x=num(0),y=num(1);if(y===0)throw Error('División por cero.');return finite(x/y);}
   case 'gt':return num(0)>num(1);case 'lt':return num(0)<num(1);case 'eq':return num(0)===num(1);
  }
 }
 const result=run(program);if(JSON.stringify(result).length>8000)throw Error('Salida demasiado grande.');return{result,steps,version:PROGRAM_LAB_VERSION};
}
export const PROGRAM_TASKS=[
 {id:'positive-total',name:'Sumar valores positivos',spec:'Devuelve la suma de los números estrictamente positivos de input. Cero si la lista está vacía o no tiene positivos.'},
 {id:'signal-energy',name:'Energía de una señal',spec:'Devuelve la suma de los cuadrados de los números de input. Cero para la lista vacía. No es RMS.'},
 {id:'clip-unit',name:'Limitar una señal',spec:'Devuelve una lista del mismo tamaño que input con cada número limitado al intervalo [-1,1], preservando orden y valores dentro del intervalo.'}
];
function expected(task,input){
 if(task==='positive-total')return input.reduce((s,x)=>x>0?s+x:s,0);
 if(task==='signal-energy')return input.reduce((s,x)=>s+x*x,0);
 if(task==='clip-unit')return input.map(x=>Math.max(-1,Math.min(1,x)));
 throw Error('Proyecto desconocido.');
}
export function programCases(task,seed=1){
 if(!PROGRAM_TASKS.some(t=>t.id===task))throw Error('Proyecto desconocido.');
 const s=1+Math.abs(seed%19),inputs=[[],[0],[-4,-2],[2,-3,5],[.5,-.25,1],[-1,1,0],Array(32).fill(0),[s,-s,s+1,-s-2],[1e6,-1e6],[-1.001,-.999,.999,1.001],Array.from({length:128},(_,i)=>(i%7)-3),[0.125,-0.375,0.625,-0.875]];
 return inputs.map((input,i)=>({id:'case-'+i,split:i<6?'development':'heldout',input,expected:expected(task,input)}));
}
export function gradeProgram(program,cases){
 const checks=cases.map(c=>{try{const {result}=executeProgram(program,c.input);return{id:c.id,split:c.split,input:c.input,passed:JSON.stringify(result)===JSON.stringify(c.expected),observed:result,expected:c.expected};}catch(e){return{id:c.id,split:c.split,input:c.input,passed:false,error:e.message,expected:c.expected};}});
 return{passed:checks.filter(c=>c.passed).length,total:checks.length,checks};
}
export function programDecision(before,after){
 if(after.passed!==after.total)return 'rejected';
 if(!before)return 'installed';
 const regression=before.checks.some(c=>c.passed&&!after.checks.some(a=>a.id===c.id&&a.passed));
 return !regression&&after.passed>before.passed?'promoted':'retained';
}
