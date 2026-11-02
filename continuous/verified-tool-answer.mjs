import {isDeepStrictEqual} from 'node:util';
import {LEARNING_CATALOG} from './learning-status.mjs';

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
function jsonValue(value,max){
 try{const json=JSON.stringify(value);return typeof json==='string'&&json.length<=max&&isDeepStrictEqual(JSON.parse(json),value)?json:null;}catch{return null;}
}
const canonicalTask=value=>typeof value==='string'&&Object.hasOwn(LEARNING_CATALOG,value);
const runtimeId=value=>typeof value==='string'&&value.length>0&&value.length<=160;

function completedSteps(toolRun){
 if(!Object.hasOwn(toolRun,'steps'))return [];
 if(!Array.isArray(toolRun.steps)||!toolRun.steps.length||toolRun.steps.length>3)return null;
 const identities=new Map();
 for(const [index,step] of toolRun.steps.entries()){
  if(!object(step)||step.status!=='completed'||step.step!==index+1||Object.hasOwn(step,'error')||!runtimeId(step.toolId)||!canonicalTask(step.curriculumTaskId)||!Object.hasOwn(step,'input')||jsonValue(step.input,MAX_INPUT_CHARS)===null||!Object.hasOwn(step,'result')||jsonValue(step.result,64000)===null||!['literal','previous'].includes(step.inputSource))return null;
  if(identities.has(step.toolId)&&identities.get(step.toolId)!==step.curriculumTaskId)return null;
  identities.set(step.toolId,step.curriculumTaskId);
  if(step.inputSource==='previous'&&(index===0||!isDeepStrictEqual(step.input,toolRun.steps[index-1].result)))return null;
 }
 const last=toolRun.steps.at(-1);
 return toolRun.toolId===last.toolId&&toolRun.curriculumTaskId===last.curriculumTaskId&&isDeepStrictEqual(toolRun.input,last.input)&&isDeepStrictEqual(toolRun.result,last.result)?toolRun.steps:null;
}

/** Render the exact measured JSON, not a model paraphrase or a claim that any
 * arbitrary input has been proven correct. Names come from the public catalogue;
 * private runtime IDs, input data, timestamps and free-text names stay out.
 */
export function formatExecutedToolAnswer(toolRun){
 if(!object(toolRun)||toolRun.used!==true||Object.hasOwn(toolRun,'error')||toolRun.partial===true||Object.hasOwn(toolRun,'failedStep')||!canonicalTask(toolRun.curriculumTaskId)||!Object.hasOwn(toolRun,'result')||jsonValue(toolRun.result,MAX_ANSWER_CHARS)===null)return null;
 const steps=completedSteps(toolRun);if(steps===null)return null;
 if(toolRun.curriculumTaskId===TASK_ID&&steps.length<=1)return formatVerifiedToolAnswer(toolRun);
 if(!runtimeId(toolRun.toolId))return null;
 const json=JSON.stringify(toolRun.result,null,2),longest=(json.match(/`+/g)||[]).reduce((max,run)=>Math.max(max,run.length),0),fence='`'.repeat(Math.max(3,longest+1));
 const names=steps.length?steps.map(step=>LEARNING_CATALOG[step.curriculumTaskId].name):[LEARNING_CATALOG[toolRun.curriculumTaskId].name];
 const trace=names.length>1?'Pasos ejecutados:\n'+names.map((name,index)=>(index+1)+'. '+name).join('\n')+'\n\nResultado final:':names[0];
 const answer='Resultado de ejecución\n\n'+trace+'\n\n'+fence+'json\n'+json+'\n'+fence;
 return answer.length<=MAX_ANSWER_CHARS?answer:null;
}
