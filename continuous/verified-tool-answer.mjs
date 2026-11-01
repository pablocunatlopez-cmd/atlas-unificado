const TASK_ID='dag-dependency-plan';
const MAX_TASKS=256,MAX_ID_LENGTH=256,MAX_INPUT_CHARS=30000,MAX_ANSWER_CHARS=16000;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const id=value=>typeof value==='string'&&value.length>0&&value.length<=MAX_ID_LENGTH;
const exactKeys=(value,expected)=>Object.keys(value).length===expected.length&&expected.every(key=>Object.hasOwn(value,key));

/** Preserve the measured DAG result as data. This formatter neither executes
 * tasks nor asks a model to invent dependencies, priorities or optimality.
 */
export function formatVerifiedToolAnswer(toolRun){
 if(!object(toolRun)||toolRun.used!==true||toolRun.curriculumTaskId!==TASK_ID||toolRun.error||!Object.hasOwn(toolRun,'input')||toolRun.input===undefined||!object(toolRun.result))return null;
 let inputJson;try{inputJson=JSON.stringify(toolRun.input);}catch{return null;}
 if(typeof inputJson!=='string'||inputJson.length>MAX_INPUT_CHARS)return null;
 const result=toolRun.result;
 if(Object.hasOwn(result,'error'))return exactKeys(result,['error'])&&result.error==='invalid_tasks'?'Datos de tareas no válidos. Revisa los ID únicos y las dependencias.':null;
 if(!exactKeys(result,['order','blocked'])||!Array.isArray(result.order)||!Array.isArray(result.blocked))return null;
 if(result.order.length+result.blocked.length>MAX_TASKS)return null;
 const input=toolRun.input;if(!object(input)||!Array.isArray(input.tasks)||input.tasks.length>MAX_TASKS)return null;
 const dependencies=new Map();
 for(const task of input.tasks){
  if(!object(task)||!id(task.id)||dependencies.has(task.id)||!Array.isArray(task.dependsOn)||!task.dependsOn.every(id))return null;
  dependencies.set(task.id,new Set(task.dependsOn));
 }
 for(const deps of dependencies.values())for(const dependency of deps)if(!dependencies.has(dependency))return null;
 const returned=[...result.order,...result.blocked];
 if(returned.length!==dependencies.size||!returned.every(id)||new Set(returned).size!==returned.length||returned.some(name=>!dependencies.has(name)))return null;
 const earlier=new Set();
 for(const name of result.order){if([...dependencies.get(name)].some(dependency=>!earlier.has(dependency)))return null;earlier.add(name);}
 const blocked=new Set(result.blocked);
 for(const name of blocked)if(![...dependencies.get(name)].some(dependency=>blocked.has(dependency)))return null;
 const json=JSON.stringify({order:result.order,blocked:result.blocked},null,2);
 // IDs remain JSON strings, including any newlines, links or Markdown syntax.
 // A fence longer than every backtick run in the payload cannot be closed by it.
 const longest=(json.match(/`+/g)||[]).reduce((max,run)=>Math.max(max,run.length),0),fence='`'.repeat(Math.max(3,longest+1));
 const answer='Orden y tareas bloqueadas:\n\n'+fence+'json\n'+json+'\n'+fence;
 return answer.length<=MAX_ANSWER_CHARS?answer:null;
}
