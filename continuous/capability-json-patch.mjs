const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const own=(value,key)=>Object.hasOwn(value,key);
const clone=value=>JSON.parse(JSON.stringify(value));
const OPS=new Set(['add','remove','replace','test','copy','move']);

function jsonValue(value,ancestors=new Set(),depth=0){
 if(value===null||typeof value==='string'||typeof value==='boolean')return true;
 if(typeof value==='number')return Number.isFinite(value);
 if(typeof value!=='object'||depth>128||ancestors.has(value))return false;
 if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)return false;
 ancestors.add(value);let valid;
 if(Array.isArray(value))valid=Object.keys(value).length===value.length&&value.every((item,index)=>own(value,String(index))&&jsonValue(item,ancestors,depth+1));
 else valid=Object.keys(value).every(key=>jsonValue(value[key],ancestors,depth+1));
 ancestors.delete(value);return valid;
}
function pointer(value){
 if(typeof value!=='string'||value!==''&&!value.startsWith('/')||/~(?![01])/.test(value))return null;
 return value===''?[]:value.slice(1).split('/').map(token=>token.replace(/~[01]/g,pair=>pair==='~1'?'/':'~'));
}
function equal(left,right){
 if(left===right)return true;
 if(left===null||right===null||typeof left!=='object'||typeof right!=='object'||Array.isArray(left)!==Array.isArray(right))return false;
 const a=Object.keys(left),b=Object.keys(right);
 return a.length===b.length&&a.every(key=>own(right,key)&&equal(left[key],right[key]));
}
const fail=code=>{throw Object.assign(new Error(code),{code});};
function arrayIndex(token,length,insertion=false){
 if(insertion&&token==='-')return length;
 if(!/^(?:0|[1-9][0-9]*)$/.test(token))return fail('path_not_found');
 const index=Number(token);
 if(!Number.isSafeInteger(index)||index<0||index>(insertion?length:length-1))return fail('path_not_found');
 return index;
}
function locate(document,tokens){
 let value=document;
 for(const token of tokens){
  if(Array.isArray(value))value=value[arrayIndex(token,value.length)];
  else if(object(value)&&own(value,token))value=value[token];
  else return fail('path_not_found');
 }
 return value;
}
function add(document,tokens,value){
 if(!tokens.length)return clone(value);
 const parent=locate(document,tokens.slice(0,-1)),key=tokens.at(-1),copied=clone(value);
 if(Array.isArray(parent))parent.splice(arrayIndex(key,parent.length,true),0,copied);
 else if(object(parent))Object.defineProperty(parent,key,{value:copied,enumerable:true,writable:true,configurable:true});
 else return fail('path_not_found');
 return document;
}
function remove(document,tokens){
 if(!tokens.length)return fail('root_remove_unsupported');
 const parent=locate(document,tokens.slice(0,-1)),key=tokens.at(-1);
 if(Array.isArray(parent))parent.splice(arrayIndex(key,parent.length),1);
 else if(object(parent)&&own(parent,key))delete parent[key];
 else return fail('path_not_found');
 return document;
}

/** Fixed reference oracle, never supplied as generated code or a PC executor.
 * This application's bounded RFC 6902 profile always returns a JSON document;
 * removing the root is explicitly unsupported rather than silently using null.
 */
export function jsonPatchOracle(input){
 if(!object(input)||!own(input,'document')||!jsonValue(input.document)||!own(input,'patch')||!Array.isArray(input.patch)||input.patch.length>64)return {ok:false,error:'invalid_input'};
 try{if(JSON.stringify(input).length>30000)return {ok:false,error:'invalid_input'};}catch{return {ok:false,error:'invalid_input'};}
 const plans=[];
 for(let index=0;index<input.patch.length;index++){
  const operation=input.patch[index];
  if(!object(operation)||!own(operation,'op')||!OPS.has(operation.op)||!own(operation,'path')||typeof operation.path!=='string'||(['add','replace','test'].includes(operation.op)&&(!own(operation,'value')||!jsonValue(operation.value)))||(['copy','move'].includes(operation.op)&&(!own(operation,'from')||typeof operation.from!=='string')))return {ok:false,error:'invalid_patch',index};
  const path=pointer(operation.path),from=['copy','move'].includes(operation.op)?pointer(operation.from):undefined;
  if(path===null||from===null)return {ok:false,error:'invalid_pointer',index};
  plans.push({op:operation.op,path,from,value:operation.value});
 }
 let document=clone(input.document);
 for(let index=0;index<plans.length;index++){
  const plan=plans[index];
  try{
   if(plan.op==='add')document=add(document,plan.path,plan.value);
   else if(plan.op==='remove')document=remove(document,plan.path);
   else if(plan.op==='replace'){
    locate(document,plan.path);
    if(!plan.path.length)document=clone(plan.value);
    else{const parent=locate(document,plan.path.slice(0,-1)),key=plan.path.at(-1);if(Array.isArray(parent))parent[arrayIndex(key,parent.length)]=clone(plan.value);else Object.defineProperty(parent,key,{value:clone(plan.value),enumerable:true,writable:true,configurable:true});}
   }else if(plan.op==='test'){if(!equal(locate(document,plan.path),plan.value))fail('test_failed');}
   else{
    if(plan.op==='move'&&plan.from.length<plan.path.length&&plan.from.every((token,i)=>token===plan.path[i]))fail('invalid_move');
    const value=clone(locate(document,plan.from));
    if(plan.op==='move'){
     if(plan.from.length===plan.path.length&&plan.from.every((token,i)=>token===plan.path[i]))continue;
     document=remove(document,plan.from);
    }
    document=add(document,plan.path,value);
   }
   if(JSON.stringify(document).length>60000)fail('result_too_large');
  }catch(error){if(typeof error.code==='string')return {ok:false,error:error.code,index};throw error;}
 }
 return {ok:true,document};
}

export const jsonPatchTask={
 id:'json-patch-apply',
 name:'Aplicar cambios JSON Patch de forma atómica',
 task:'Implementa function transform(input) pura JSON: {document:valorJSON,patch:[operaciones]}. Devuelve exactamente {ok:true,document:resultado} o {ok:false,error:codigo,index:i} para error de operación, sin documento parcial. Perfil acotado de RFC6902/RFC6901: máximo64 operaciones; no modifica entrada ni archivos, programa, permisos o pesos. El input debe ser objeto no nulo/noarray con claves propias document y patch array <=64; valores JSON finitos (profundidad<=128), JSON.stringify(input).length<=30000. Si no: {ok:false,error:"invalid_input"} sin index. Antes de aplicar nada valida TODAS las operaciones por orden. Cada una es objeto con op propia en add,remove,replace,test,copy,move y path propia cadena; add/replace/test necesitan value propia JSON; copy/move necesitan from propia cadena. Error de forma: invalid_patch,index. Ignora campos extra. Pointer: vacía selecciona raíz; otra empieza /; solo escapes ~0 y ~1, decodificados una vez (~01 es ~1), tokens vacíos y claves propias exactas; sin URI/# ni decodificar %. Sintaxis inválida de path/from: invalid_pointer,index. Tras prevalidar ejecuta secuencialmente sobre copia. Padres y destinos de remove/replace/test y origen copy/move deben existir; si falta algo, se cruza primitivo/null, índice inválido o heredado: path_not_found,index. Arrays: índices 0 o enteros sin ceros iniciales, seguros y en rango; add permite índice==length y - para append, insertando sin reemplazar; los demás no admiten -. En objetos - es clave normal; add crea o sustituye una clave, incluidos __proto__/constructor como DATOS PROPIOS seguros, nunca alteres prototipos. replace exige que exista la clave. add y replace con path vacía sustituyen raíz. remove raíz NO está soportado en este perfil: root_remove_unsupported,index. test compara JSON estructural: tipos exactos, objetos sin importar orden de claves, arrays con orden; fallo test_failed,index. copy copia profundamente origen y lo agrega. move equivale a quitar origen y agregar al destino, evaluado DESPUÉS de quitar; destino dentro de un descendiente estricto del origen (por tokens) falla invalid_move,index antes de buscar origen. Mover la misma ruta existente es no-op; origen raíz a destino no vacío es invalid_move; mover/copiar a raíz permitido. Después de cada operación, si JSON.stringify(document).length>60000 falla result_too_large,index: evita crecimiento explosivo con copy. Cualquier error descarta todos los cambios. patch vacío devuelve copia del documento. Solo código completo; no imports, red, procesos, reloj ni eval. RFC referencia: https://www.rfc-editor.org/rfc/rfc6902; excepción root_remove y códigos son contrato de esta aplicación, no RFC completo.',
 learningPlan:{
  hypothesis:'Cambios de datos tipados con precondiciones pueden prepararse y refutarse de forma atómica antes de cualquier integración del programa.',
  refutations:['Un test fallido no debe conservar un cambio anterior.','Los índices de move se evalúan después de retirar el origen.','Claves especiales, escapes y copias profundas no autorizan acceso heredado ni contaminación de prototipos.'],
  evidence:'Ocho contratos independientes y escenarios generados contrastan las seis operaciones, raíz, índices, igualdad JSON, errores y conservación de entrada.',
  scope:'Transformación de documentos JSON ya aportados; no escribe archivos ni cambia por sí sola el núcleo, servidor, permisos o pesos. Perfil RFC6902 acotado: remove de raíz no soportado.'
 },
 acceptanceTests:[
  {input:{document:{name:'Atlas',temporary:true},patch:[{op:'add',path:'/version',value:2},{op:'replace',path:'/name',value:'Ion'},{op:'remove',path:'/temporary'}]},expected:{ok:true,document:{name:'Ion',version:2}}},
  {input:{document:{items:['a','c']},patch:[{op:'add',path:'/items/1',value:'b'},{op:'add',path:'/items/-',value:'d'},{op:'remove',path:'/items/0'},{op:'replace',path:'/items/1',value:'C'}]},expected:{ok:true,document:{items:['b','C','d']}}},
  {input:{document:{'~1':{'a/b':{'':null}},value:{a:1,b:[true,null]}},patch:[{op:'test',path:'/~01/a~1b/',value:null},{op:'test',path:'/value',value:{b:[true,null],a:1}}]},expected:{ok:true,document:{'~1':{'a/b':{'':null}},value:{a:1,b:[true,null]}}}},
  {input:{document:{source:{n:1},items:['a','b','c']},patch:[{op:'copy',from:'/source',path:'/copy'},{op:'replace',path:'/source/n',value:9},{op:'move',from:'/items/0',path:'/items/2'}]},expected:{ok:true,document:{source:{n:9},items:['b','c','a'],copy:{n:1}}}},
  {input:{document:null,patch:[{op:'add',path:'',value:{child:[7]}},{op:'copy',from:'/child',path:''},{op:'test',path:'',value:[7]},{op:'replace',path:'',value:false}]},expected:{ok:true,document:false}},
  {input:{document:{x:1},patch:[{op:'add',path:'/y',value:2},{op:'test',path:'/x',value:'1'}]},expected:{ok:false,error:'test_failed',index:1}},
  {input:{document:{a:{b:1}},patch:[{op:'move',from:'/a',path:'/a/child'}]},expected:{ok:false,error:'invalid_move',index:0}},
  {input:{document:JSON.parse('{"__proto__":{"value":1},"constructor":0}'),patch:[{op:'replace',path:'/__proto__/value',value:2},{op:'copy',from:'/__proto__',path:'/constructor'},{op:'add',path:'/__proto__',value:{safe:true}}]},expected:{ok:true,document:JSON.parse('{"__proto__":{"safe":true},"constructor":{"value":2}}')}}
 ]
};

export const jsonPatchCoverage=['object-edit-sequence','array-insert-append','escaped-and-special-keys','deep-copy-and-array-move','root-replace','atomic-test-failure','ancestor-move-rejected','invalid-pointer-or-array-index'];
/** New values inside eight declared patterns, not a claim of new coverage. */
export function generateJsonPatchInputs(seed){
 if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new TypeError('La semilla debe ser uint32.');
 const n=(seed%100003)+17,tag='item_'+seed.toString(36),key='a/b_'+tag,encoded=key.replaceAll('~','~0').replaceAll('/','~1');
 return [
  {document:{label:tag,remove:n},patch:[{op:'add',path:'/added',value:n+1},{op:'replace',path:'/label',value:tag+'_changed'},{op:'remove',path:'/remove'}]},
  {document:{items:[n,n+2]},patch:[{op:'add',path:'/items/1',value:n+1},{op:'add',path:'/items/-',value:n+3},{op:'move',from:'/items/0',path:'/items/3'}]},
  {document:JSON.parse('{"__proto__":{"value":'+n+'},"constructor":"'+tag+'"}'),patch:[{op:'copy',from:'/__proto__',path:'/'+encoded},{op:'replace',path:'/__proto__/value',value:n+1},{op:'test',path:'/'+encoded,value:{value:n}}]},
  {document:{source:{tag,values:[n]},items:[n,n+1,n+2]},patch:[{op:'copy',from:'/source',path:'/copied'},{op:'replace',path:'/source/values/0',value:n+5},{op:'move',from:'/items/2',path:'/items/0'}]},
  {document:{n},patch:[{op:'replace',path:'',value:{[key]:[n,tag]}},{op:'move',from:'/'+encoded,path:''},{op:'test',path:'',value:[n,tag]}]},
  {document:{n,tag},patch:[{op:'add',path:'/temporary',value:n+9},{op:'test',path:'/n',value:String(n)}]},
  {document:{[tag]:{child:n}},patch:[{op:'move',from:'/'+tag,path:'/'+tag+'/descendant'}]},
  seed%2?{document:{[tag]:n},patch:[{op:'add',path:'/added',value:tag},{op:'test',path:'/bad~2_'+tag,value:n}]}:{document:{items:[n]},patch:[{op:'remove',path:'/items/0'+(seed%3)}]}
 ];
}
