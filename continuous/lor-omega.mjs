// Executable JSON encoding of the user's existing LOR-ΩΣ record, not a new
// mathematical theory or a replacement for its original symbolic language.
export const LOR_SOURCE=Object.freeze({document:'Atlas_Unificado_LOR-OmegaSigma.md',version:105,date:'2026-09-12',sha256:'6f26f5a842d8088d02b4c0873e0e59c69ff5aae00490f46e6aafbd891be74609',chapters:[1,2,3,5]});
export const LOR_FIELDS=Object.freeze({O:'objetos',A:'ambiente',X:'estados',R:'relaciones',T:'transformaciones',I:'invariantes',C:'restricciones',E:'escala',M:'medida',P:'predicciones',F:'falsadores','Σ':'cadena semiótica'});
const text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=2000;
export function situatedFrame({object,environment,perspective,scale}){
 if(![object,environment,perspective,scale].every(text))throw Error('K necesita objeto, ambiente, perspectiva y escala declarados.');
 return {object,environment,perspective,scale};
}
export function elevateFrame(frame,outerEnvironment,{perspective=frame.perspective,scale=frame.scale}={}){
 const current=situatedFrame(frame);
 return {frame:situatedFrame({object:current.environment,environment:outerEnvironment,perspective,scale}),parent:current,operation:'Λ',scope:'El ambiente previo se trata como objeto; no se postula un último anillo.'};
}
export function validateLorRecord(record){
 if(!record||record.encoding!=='atlas-lor-record/v1'||record.language!=='LOR-ΩΣ'||!record.S||Object.keys(LOR_FIELDS).some(key=>record.S[key]===undefined))throw Error('El registro debe declarar los doce componentes S*.');
 situatedFrame(record.K);
 if(!Array.isArray(record.S.M)||!record.S.M.length||record.S.M.some(item=>!text(item.name)||!text(item.unit)||!Number.isFinite(item.value)))throw Error('M necesita medidas finitas, nombres y unidades.');
 if(!Array.isArray(record.S.P)||!record.S.P.length||!Array.isArray(record.S.F)||!record.S.F.length)throw Error('P y F necesitan predicciones y falsadores explícitos.');
 if(!Array.isArray(record.S['Σ'])||!record.S['Σ'].length||record.S['Σ'].some(item=>![item.object,item.sign,item.interpretant].every(text)))throw Error('Σ necesita objeto, signo e interpretante, sin convertir la interpretación en hecho.');
 if(!record.Gamma||!['Animal','Mente','Suceso','Realidad'].every(key=>record.Gamma[key]!==undefined))throw Error('Γ necesita los cuatro componentes declarados.');
 if(!record.L||typeof record.L.newEvidence!=='boolean'||typeof record.L.acceptedChange!=='boolean'||typeof record.L.invariantsPreserved!=='boolean'||typeof record.L.countsAsLearning!=='boolean')throw Error('La actualización L debe declarar su evidencia y alcance.');
 if(record.L.countsAsLearning&&!(record.L.newEvidence&&record.L.acceptedChange&&record.L.invariantsPreserved))throw Error('No se registra aprendizaje sin evidencia nueva, cambio aceptado e invariantes preservadas.');
 return structuredClone(record);
}
export function coreEvaluationLor(record){
 const evaluated=!!record.evaluation,accepted=record.accepted===true,e=record.evaluation;
 const contractsPassed=evaluated&&e.after?.cases>0&&e.after.passed===e.after.cases&&Array.isArray(e.regressions)&&e.regressions.length===0;
 return validateLorRecord({encoding:'atlas-lor-record/v1',language:'LOR-ΩΣ',source:LOR_SOURCE,at:record.at,
  K:situatedFrame({object:'Política ejecutable de Atlas',environment:'Coordinador local y contratos de enrutamiento',perspective:'Validador de software situado; no observador absoluto',scale:'Una propuesta de política, sin cambios de pesos Qwen'}),
  S:{
   O:['política vigente','política candidata','peticiones de evaluación'],A:'Contratos parametrizados y permisos del coordinador',
   X:{parentId:record.parentId,candidateHash:record.candidateHash||null,phase:record.phase},R:['La política determina estrategia y presupuesto del turno','La evaluación compara candidato y versión vigente sobre el mismo lote'],
   T:['Generar candidato como datos','Ejecutar contratos','Promover o refutar sin borrar la versión anterior'],
   I:['No ejecutar código del candidato','No ampliar permisos','JSON estructurado conserva transporte','Pesos Qwen sin cambios'],
   C:['Doce reglas como máximo','Presupuesto de razonamiento entre 0 y 1536 tokens','Todos los contratos deben pasar','Ninguna regresión permitida'],
   E:'Un ciclo discreto de propuesta y evaluación de política; no escala física',
   M:[{name:'casos de desarrollo observados',unit:'casos',value:record.observedDevelopment?.cases||0},{name:'casos reservados ejecutados',unit:'casos',value:e?.after?.cases||0},{name:'contratos reservados aprobados',unit:'casos',value:e?.after?.passed||0},{name:'presupuesto medio del candidato',unit:'tokens de razonamiento',value:e?.after?.meanThinkingTokens||0}],
   P:[{statement:'El candidato supera todos los contratos sin regresiones y mejora la puntuación o reduce al menos 15% el presupuesto con igual puntuación.',declaredBeforeEvaluation:true}],
   F:[{condition:'Un contrato falla o aparece una regresión.',observed:evaluated&&e.after.passed!==e.after.cases||!!e?.regressions?.length},{condition:'No hay mejora medida respecto a la política vigente.',observed:record.reason==='no_measured_improvement'},{condition:'El candidato o la evaluación son inválidos.',observed:record.reason==='invalid_candidate_or_evaluation'}],
   'Σ':[{object:'Comportamiento de selección de estrategia',sign:'Resultados de contratos y presupuesto de tokens',interpretant:accepted?'Mejora local medida de la política de enrutamiento.':'No se acredita una mejora de política en este ciclo.',scope:'No prueba inteligencia general, comprensión física, consciencia ni cambios de Qwen.'}],
  },
  Gamma:{Animal:{executor:'JavaScript local',gpuTraining:false,permissionsExpanded:false},Mente:{activeParent:record.parentId,candidate:record.candidateHash||null},Suceso:{evaluationHash:e?.hash||null,environment:'Lote externo al prompt del generador'},Realidad:{executedCases:e?.after?.cases||0,accepted}},
  L:{newEvidence:evaluated&&e.freshForThisCycle===true,acceptedChange:accepted,invariantsPreserved:contractsPassed,countsAsLearning:accepted&&contractsPassed&&e.freshForThisCycle===true,scope:'Solo aprendizaje operativo de una política de software bajo estos contratos. La crítica verbal no basta.'},
  unimplemented:['Transporte geométrico 𝒜 y curvatura 𝓕 no calculados por este registro','Holonomía H no medida en esta tarea','Entrenamiento o adaptadores de Qwen no ejecutados'],
 });
}
