import {evaluateAtlasRetrievalRouter} from './atlas-retrieval-router-audit.mjs';
/** Synthetic bilingual policy audit. Labels are authored expectations, not real-world truth. */
export function makeAtlasRouterFixture(){
 const exact=[
 'Busca RFC 9110','Find Q594','Abre ERR500','Locate HTTP 404','Consulta AB1234',
 'Show ZX-204','Revisa RFC 7231','Find ERROR123','Q594 y memoria','Explain why Q594 changed',
 '¿Qué significa RFC 9110?','Compare AB123 and CD456','Find XY_993','Busca R42',
 'Locate F00DCAFE12345678'
 ];
 const conceptual=[
 '¿Cómo funciona la memoria?','¿Por qué recordamos?','Explica la relación','¿Qué significa concepto?',
 'Compara los sistemas','¿Cuál es la diferencia?','How does memory work?','Why do we remember?',
 'Explain the relationship','Compare the methods','What is the difference?','Explain the concept',
 '¿Cómo se aprende?','¿Por qué cambia?','Explain memory','¿Qué significa relación?',
 'How does retrieval work?','Compara dos motores','Explain the meaning','¿Cómo mejorar la búsqueda?'
 ];
 const ambiguous=[
 'memoria','atlas','documentos','retrieval','Órbita','registro','estado','memoriaa',
 'comparativa','conceptualizar','reIacion','búsqueda','search','lookup','hola',
 'resumen','notas','historial','sistema','motor'
 ];
 const groups=[['exact-identifier',exact],['conceptual',conceptual],['ambiguous',ambiguous]];
 return Object.freeze(groups.flatMap(([expected,questions])=>questions.map((question,i)=>Object.freeze({
  id:expected.replace(/[^a-z]/g,'')+'-'+String(i).padStart(2,'0'),question,expected
 }))));
}
export function auditAtlasRouterFixture({minimumCases=30}={}){
 const fixture=makeAtlasRouterFixture();
 const report=evaluateAtlasRetrievalRouter(fixture,{minimumCases});
 return Object.freeze({...report,fixtureType:'synthetic-bilingual-v1',independentGroundTruth:false,
  eligibleForProductionRouting:false});
}
