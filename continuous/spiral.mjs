import {createHash} from 'node:crypto';
import {atlasFoundation} from './atlas-foundation.mjs';

export {atlasFoundation,discoverFoundationImages} from './atlas-foundation.mjs';

export const inherited={source:'Source-only distribution. Private historical observations are not imported.',foundationId:atlasFoundation.id,promptRefs:atlasFoundation.prompts.map(({id,status})=>({id,status})),visualSeed:{motifs:atlasFoundation.visualLanguage.motifs,organigram:atlasFoundation.visualLanguage.organigram,status:atlasFoundation.visualLanguage.originalImageStatus}};

function hashText(value){return createHash('sha256').update(value).digest('hex');}
export function spiralRecord({signature,documents,result,mandateHash,images=[]}){
 const m=result.metrics||{};
 const promptRefs=atlasFoundation.prompts.map(({id,text,status})=>({id,status,sha256:hashText(text)}));
 const visualAssets=[...atlasFoundation.visualLanguage.availableReferences,...images.map(({id,name,path,mime,bytes,sha256,role,modelInput})=>({id,name,path,mime,bytes,sha256,role,modelInput}))];
 const accepted=m.accepted===true;
 return {
  id:createHash('sha256').update(signature+':'+new Date().toISOString()).digest('hex').slice(0,20),
  at:new Date().toISOString(),foundationId:atlasFoundation.id,mandateHash,
  question:'¿Mejora un candidato la pérdida de validación local frente a los pesos vigentes?',
  promptRefs,visualAssets,visualInputsUsedByModel:false,
  signature,sourceHashes:documents.map(d=>({url:d.url,hash:d.hash,role:d.role})),
  stages:[
   {stage:'Observar',result:`${documents.length} documentos con procedencia y hash; ${promptRefs.length} prompts de la semilla enlazados; ${images.length} recursos visuales locales con hash. El organigrama Atlas permanece pendiente de mostrar y no se inventan nodos ni relaciones.`},
   {stage:'Comprender',result:'Hipótesis delimitada: el candidato puede reducir la pérdida de validación. Lectura, prompt o imagen no acreditan comprensión semántica.'},
   {stage:'Conectar',result:'Continuidad con la pregunta heredada de aprendizaje sin contaminación del test; se conserva el marco objeto/signo/interpretante sin tratar la metáfora como evidencia.'},
   {stage:'Aplicar',result:`${m.candidateCount||1} candidatos; ${m.attemptedStepsTotal||m.steps||0} actualizaciones en ${m.device||'CPU'}.${m.trainingExamplesTotal?' '+m.trainingExamplesTotal+' ejemplos en mini-lotes.':''} El experimento afecta solo al checkpoint del núcleo experimental, no a Qwen.`},
   {stage:'Refutar',result:`Pérdida de la base ${m.before??'no medida'}; candidato seleccionado ${m.after??'no disponible'}.`,candidates:m.candidates||[]},
   {stage:'Aprender',result:accepted?'Se conserva el checkpoint solo por superar la métrica local configurada; alcance limitado, sin afirmar competencia conversacional ni generalización.':'Se conservan pesos previos y el resultado negativo; no se cuenta repetición como aprendizaje.'}
  ],
  accepted,negativeLesson:!accepted?'Estos candidatos no superaron el criterio local con este corpus; no es una conclusión universal.':null,
  nextQuestion:'¿Se mantiene el resultado en familias de datos nuevas y un test sellado que no participe en selección ni entrenamiento?',
  Q594Resolved:false,protocol:'Bucle secuencial de Atlas; aprendizaje autónomo general no acreditado',appendOnly:true
 };
}
