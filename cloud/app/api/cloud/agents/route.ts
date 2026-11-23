import {getChatGPTUser} from '@/app/chatgpt-auth';
import {allowedOrigin} from '@/lib/server-state';
import {body,cloudJson,cloudError} from '@/lib/cloud/http';
import {agentCatalog,qualifyAgents} from '@/lib/cloud/agent-registry';
import {agentEvaluations} from '@/lib/cloud/agent-registry';
import {runSpecialists} from '@/lib/cloud/agents';
import {inferModel} from '@/lib/cloud/inference';
export const dynamic='force-dynamic';
export async function GET(){try{return cloudJson(await agentCatalog());}catch(error){return cloudError(error);}}
// Shared synthetic evaluation on the owner-private Site, behind Sites service access.
// Never broaden Site audience without replacing this authorization boundary.
export async function POST(request:Request){
 const user=await getChatGPTUser();
 if(user&&!allowedOrigin(request)||!user&&(request.headers.has('origin')||request.headers.has('sec-fetch-site')))return cloudJson({error:'Origen no autorizado.'},403);
 try{
  const input=await body(request,2000);if(!['qualify','verify'].includes(String(input.action))||Object.keys(input).length!==1)return cloudJson({error:'Solo se admite calificar o comprobar el catálogo autorizado.'},400);
  if(input.action==='verify'){
   const question='Implementa una función JavaScript suma(a,b) que acepte dos números finitos y rechace el resto. Incluye dos pruebas propuestas. No afirmes haber ejecutado el código.';
   const probe=await runSpecialists({question,messages:[{role:'user',content:question}],system:'Eres Atlas. Esta comprobación solo produce código propuesto, no lo ejecuta. No inventes herramientas usadas.',evaluations:await agentEvaluations(),generate:(model,messages,options)=>inferModel(model,messages,{...options,purpose:'coaching'})});
   return cloudJson({probe,scope:'Comprobación real de selección y colaboración. El código propuesto no se ejecutó.'});
  }
  await qualifyAgents();return cloudJson(await agentCatalog());
 }catch(error){return cloudError(error);}
}
