import {publicTools} from './public-tools.mjs';
import {getAutonomousTask} from './autonomy-curriculum.mjs';
import {sanitizeLearningStatus} from './learning-status.mjs';

/** Build public learning telemetry from executed, canonical tool records.
 * Raw tool data stays on the PC; only fixed labels and counts leave it.
 */
export function sanitizeLearningTelemetry(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const records=Array.isArray(value.tools)?value.tools:[];
 const tools=publicTools(records).map(tool=>{
  // publicTools chooses a version by date, then input order. Match that same
  // approved version to recover its date without trusting a free-text field.
  let createdAt=null;
  for(const record of records){
   if(record?.id!==tool.id||record.curriculumTaskId!==tool.curriculumTaskId||record.source!==tool.source||!publicTools([record]).length)continue;
   if(createdAt===null||Date.parse(record.at)>=Date.parse(createdAt))createdAt=record.at;
  }
  const task=getAutonomousTask(tool.curriculumTaskId);
  return {taskId:task.id,name:task.name,cases:task.acceptanceTests.length,passed:task.acceptanceTests.length,createdAt};
 });
 const pending=getAutonomousTask(value.pendingTask?.taskId);
 return sanitizeLearningStatus({reviewEnabled:value.reviewEnabled,paused:value.paused,running:value.running,lastCycleAt:value.lastCycleAt,nextRun:value.nextRun,pendingTask:pending?{taskId:pending.id}:null,tools});
}
