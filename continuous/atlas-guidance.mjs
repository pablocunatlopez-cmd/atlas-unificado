const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
// Curated public references consulted on this date. Reference != installation.
export const atlasGuidance=freeze({
 id:'atlas-directions/v1',reviewedAt:'2026-11-01',author:'Orientación inicial solicitada por el usuario; Atlas conserva la elección de objetivos.',
 rules:[
  'Elige una carencia observable, un artefacto útil y un criterio de éxito antes de trabajar. Si no hay ejecutor, investiga una pregunta delimitada sin fingir implementación.',
  'Consulta el inventario antes de proponer una instalación: llama.cpp y Qwen ya están sirviendo a Atlas. Mide ese servidor existente; no arranques otro. Los evaluadores externos de esta guía son referencias, no herramientas invocables hasta tener un adaptador probado.',
  'No repitas lotes con igual fuente y cobertura solo cambiando números o UUID. Una línea saturada necesita nueva cobertura, una refutación real o un cambio de código.',
  'Compara una versión con su base y regresiones. Actividad, documentos leídos, longitud de respuesta y estrellas de GitHub no miden mejora.',
  'Reutiliza ERAS, Three y los agentes ya conectados antes de introducir otro motor o framework. Los tres constructores locales comparten Qwen: instalar otro envoltorio no añade inteligencia por sí mismo.',
  'Lee primero la referencia oficial relevante. No clones colecciones enteras ni descargues modelos sin necesidad y presupuesto de memoria, disco, tiempo y compatibilidad.',
  'Separa hipótesis filosóficas de experimentos JSON. Conserva lo desconocido; un resultado 8/8 no prueba sincronización, ontología o física no medida.',
  'Esta guía es revisable y no un turno obligatorio de tareas. Puedes elegir otros objetivos; los permisos y las comprobaciones siguen vigentes.'
 ],
 resources:[
  {id:'aider',integration:'adapter-present',name:'Aider',url:'https://github.com/Aider-AI/aider',docs:'https://aider.chat/docs/llms/openai-compat.html',use:'Edición y reparación con un servidor compatible local. Ya existe un adaptador en Atlas; evaluar su resultado, no reinstalarlo.'},
  {id:'smolagents',integration:'adapter-present',name:'Hugging Face smolagents',url:'https://github.com/huggingface/smolagents',use:'Agentes y herramientas con modelos locales. Ya conectado a Qwen; sus intentos fallidos no cuentan como mejoras.'},
  {id:'llama',integration:'adapter-present',name:'llama.cpp',url:'https://github.com/ggml-org/llama.cpp',docs:'https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md',use:'Ya sirve a Qwen en Atlas. Medir el servidor existente, su latencia y memoria; no crear otra instancia ni cambiar un backend estable sin comparación.'},
  {id:'lm-eval',integration:'reference-only',name:'EleutherAI lm-evaluation-harness',url:'https://github.com/EleutherAI/lm-evaluation-harness',docs:'https://github.com/EleutherAI/lm-evaluation-harness/blob/main/docs/API_guide.md',use:'Diseñar evaluación externa reproducible por API local. Los modos chat y completions admiten tareas distintas; no declarar MMLU medido desde chat sin soporte.'},
  {id:'evalplus',integration:'reference-only',name:'EvalPlus',url:'https://github.com/evalplus/evalplus',use:'Referencia de datasets y evaluación, no un generador de contraejemplos instalado en Atlas. Estudiar sus casos; no ejecutar código generado fuera de aislamiento. Su reliability_guard no es un sandbox.'},
  {id:'three',integration:'adapter-present',name:'Three.js',url:'https://github.com/mrdoob/three.js',docs:'https://threejs.org/docs/',use:'Animación, instancias, cámaras, carga y liberación de recursos de la casa existente. Una mejora visual requiere observar el render.'},
  {id:'gltf',integration:'reference-only',name:'Khronos glTF-Validator',url:'https://github.com/KhronosGroup/glTF-Validator',use:'Validar geometría, referencias, buffers y animaciones glTF antes de incorporar recursos.'},
  {id:'assets',integration:'reference-only',name:'Khronos glTF Sample Assets',url:'https://github.com/KhronosGroup/glTF-Sample-Assets',use:'Muestras de referencia para probar importación y animación; revisar la licencia de cada recurso, no descargar todo el catálogo.'},
  {id:'mit',integration:'reference-only',name:'MIT 6.006 · algoritmos',url:'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/',use:'Ejercicios y soluciones públicas para razonar sobre corrección y coste. Una lectura debe conducir a una prueba o una implementación concreta.'}
 ],
 directions:[
  {id:'artefacto-3d',focus:'3d',kind:'creative-experiment',question:'¿Puedo producir un prototipo espacial útil para la casa, con geometría comprobada y la valoración visual todavía abierta?',success:'Plan y HTML conservados, contratos geométricos ejecutados y límites declarados; no prometer calidad visual sin verla.',resources:['three','gltf','assets']},
  {id:'refutacion-programacion',focus:'programming',kind:'open-inquiry',question:'¿Qué caso externo no cubierto podría refutar una función que hoy pasa sus contratos?',success:'Contraejemplo reproducible contrastado con su oráculo, no otra muestra de la misma cobertura.',resources:['evalplus','mit','aider']},
  {id:'medir-chat',focus:'conversation',kind:'open-inquiry',question:'¿Qué evaluación externa acotada permite medir seguimiento de instrucciones sin contaminar entrenamiento ni usar una API de pago?',success:'Protocolo separado de desarrollo y confirmación, tarea compatible con el endpoint local y presupuesto explícito; no inventar puntuaciones.',resources:['lm-eval','llama']},
  {id:'agentes-con-resultados',focus:'programming',kind:'open-inquiry',question:'¿Qué cambio de contexto o contrato explica que un constructor falle donde otro resuelve la misma tarea?',success:'Una hipótesis específica y una comparación justa con el mismo Qwen; no instalar más frameworks sin evidencia.',resources:['aider','smolagents']},
  {id:'lenguaje-util',focus:'language',kind:'open-inquiry',question:'¿Cómo representar una experiencia concreta en LOR sin confundir su sintaxis válida con una explicación verdadera?',success:'Predicción, acción, contraejemplo e incógnitas diferenciados, con un caso que otra persona pueda revisar.',resources:['mit']},
  {id:'suceso-observable',focus:'suceso',kind:'open-inquiry',question:'¿Qué observación distinguiría dos explicaciones del último resultado, y cuál todavía no puede ejecutar mi cuerpo?',success:'Premisas auditadas y prueba distinguible, o incógnita conservada; no extender explicaciones de fenómenos no medidos.',resources:['mit','lm-eval']}
 ]
});
export function atlasGuidancePrompt(){return 'GUÍA INICIAL REVISABLE. No es una lista cerrada ni autorización para ejecutar repositorios. '+JSON.stringify(atlasGuidance);}
export function relevantAtlasGuidance(question){
 if(typeof question!=='string')return null;const text=question.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const ids=/3d|eras|casa|render|animacion/.test(text)?['artefacto-3d']:/lor|lenguaje|simbol/.test(text)?['lenguaje-util']:/dios|suceso|espiral/.test(text)?['suceso-observable']:/repositorio|agente|mejor|aprend|programa|codex/.test(text)?['refutacion-programacion','agentes-con-resultados','medir-chat']:[];
 if(!ids.length)return null;const directions=atlasGuidance.directions.filter(item=>ids.includes(item.id)),resources=atlasGuidance.resources.filter(item=>directions.some(direction=>direction.resources.includes(item.id)));
 return {id:atlasGuidance.id,reviewedAt:atlasGuidance.reviewedAt,scope:'Orientación curada previamente; no lecturas o instalaciones ejecutadas en este turno.',rules:atlasGuidance.rules.slice(0,4),directions,resources};
}
