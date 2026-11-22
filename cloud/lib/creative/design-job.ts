import {validateCreativePlan} from './plan.mjs';
import {parseBrief,buildScene,type Brief} from '../studio/scene.ts';
export function validateDesignDraft(raw:unknown,question:string,mode:'3d'|'game'){
 const plan=validateCreativePlan(raw,mode);
 buildScene({...parseBrief(question,mode),variant:plan.variant as Brief['variant'],plan:plan as unknown as Brief['plan']});
 return plan;
}
type Options={question:string;mode:'3d'|'game';prompt:string;generate:(prompt:string,timeoutMs:number)=>Promise<unknown>;active:()=>Promise<boolean>;now?:()=>number;deadline?:number};
const MAX_PROMPT=14000,REPAIR_RESERVE=1000;
const designError=(message:string)=>Object.assign(Error(message),{code:'design'});
/** One repair of contract or navigation data, never a provider/network retry. */
export async function designWithRepair({question,mode,prompt,generate,active,now=Date.now,deadline=now()+65000}:Options){
 // The caller reserves room for feedback; do not cut a user request or an
 // attributed JSON memory record to accommodate the correction.
 if(typeof prompt!=='string'||prompt.length>MAX_PROMPT-REPAIR_RESERVE)throw designError('El contexto del diseño excede el presupuesto reservado para su corrección.');
 parseBrief(question,mode);
 const check=async()=>{if(!await active())throw Object.assign(Error('El encargo dejó de estar activo.'),{code:'cancelled'});if(now()>=deadline)throw designError('Se agotó el tiempo del encargo de diseño.');};
 const timeout=()=>{const remaining=Math.min(22000,deadline-now()-4000);if(remaining<5000)throw designError('No queda tiempo para corregir el diseño.');return remaining;};
 await check();let raw:unknown,error:unknown;
 try{raw=await generate(prompt,timeout());}catch(problem){
  // Groq's `output` code denotes malformed/truncated JSON. Quota, transport,
  // authentication and provider availability failures must propagate unchanged.
  if((problem as {code?:string})?.code!=='output')throw problem;
  error=Error('La salida JSON del modelo no se completó o no era válida.');
 }
 await check();
 if(!error)try{return{plan:validateDesignDraft(raw,question,mode),repairAttempted:false};}catch(problem){error=problem;}
 {
  await check();const timeoutMs=timeout();
  const feedback=(error instanceof Error?error.message:'El documento no cumple el contrato.').replace(/\bgsk_[A-Za-z0-9_-]+/g,'[redactado]').slice(0,700);
  const correction='\n\nCORRECCIÓN: el validador encontró este fallo: '+feedback+'. Devuelve el plan JSON completo corregido, preservando el encargo y todos los límites.';
  const repaired=await generate(prompt+correction,timeoutMs);await check();
  try{return{plan:validateDesignDraft(repaired,question,mode),repairAttempted:true};}catch{throw designError('El diseño no pasó el contrato y la navegación tras una corrección.');}
 }
}
