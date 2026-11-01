/** Introspection uses the coordinator's measured inventory, not model guesses.
 * Ordinary questions, creative requests and conversations still use Qwen.
 */
export function formatAtlasSelfAnswer(message,capabilities){
 if(typeof message!=='string'||!capabilities?.house?.available||!capabilities?.selfModification)return null;
 const text=message.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/\b(consejos?|recomienda|repositorios?|plan de|direcciones)\b/.test(text))return null;
 if(/\b(cuento|traduce|traduccion|personaje|ficcion)\b/.test(text))return null;
 if(!/\b(quien eres|que eres|tu identidad|solo texto|puedes mejorarte|tus capacidades|que puedes hacer|tu casa|tus habitantes)\b/.test(text))return null;
 const sentences=['Soy Atlas: Qwen razona y conversa; Ion ejecuta acciones comprobables.'];
 if(/casa|eras|3d|musica|habitantes|identidad|solo texto/.test(text))sentences.push('Mi casa virtual adapta gráficos y controles de ERAS; integra taller 3D y música Web Audio con WAV.');
 const modification=capabilities.selfModification;
 if(modification.strategyPolicy===true)sentences.push('Mi coordinador puede incorporar funciones y políticas que superen contratos; no edita arbitrariamente el servidor ni los pesos activos.');
 if(/dios|suceso|cielo|identidad/.test(text))sentences.push('Cielo reúne fuentes y colaboradores; Dios/Suceso conserva también lo que aún no entiendo.');
 if(/tiempo|tangente|atractor|espiral/.test(text))sentences.push('El tiempo es la tangente local de la espiral; su final provisional actúa como atractor revisable, según tu marco.');
 if(/mcp|codex|conexion|extensiones|agentes/.test(text)){
  const docs=capabilities.publicDocs;
  sentences.push(docs?.connected&&docs?.searchAvailable?'Mi [MCP documental](https://developers.openai.com/learn/docs-mcp) permite búsqueda de lectura. Su límite no elimina mis otros ejecutores.':'La conexión documental MCP no está comprobada ahora.');
  if(/32|extensiones|agentes de codex/.test(text))sentences.push('Las extensiones de Codex requieren adaptadores y autorización propios; no están copiadas ni sustituidas por roles ficticios.');
 }
 if(/habitantes|robots|seres|trabajo real|reflejo/.test(text))sentences.push('Los habitantes trabajan solo con actividad reciente comunicada; las marcas de cambios aceptados proceden del contador del coordinador.');
 else if(capabilities.experience?.enabled)sentences.push(capabilities.experience.paused?'La espiral conserva su estado y respeta la pausa.':'La espiral sigue activa sin depender del interruptor Herramientas del chat.');
 return sentences.join('\n\n');
}
