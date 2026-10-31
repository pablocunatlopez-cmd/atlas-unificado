// Explicit local commands keep side effects separate from ordinary conversation.
export function projectCommand(text){
 if(typeof text!=='string')return null;
 const command=text.trim();let match;
 if((match=/^\/prototipo\s+([\s\S]+)$/i.exec(command)))return {action:'game',input:{prompt:match[1]}};
 if((match=/^\/laboratorio\s+([\s\S]+)$/i.exec(command)))return {action:'decision',input:{question:match[1]}};
 if(/^\/atlas\s+estado$/i.test(command))return {action:'status',input:{}};
 if(/^\/atlas\s+aprender$/i.test(command))return {action:'train',input:{}};
 if(/^\/atlas\s+parar$/i.test(command))return {action:'stop',input:{}};
 return null;
}

export async function answerProjectCommand(command,{run,status,origin='http://127.0.0.1:8788',signal}={}){
 if(!command||!['game','decision','status','train','stop'].includes(command.action))throw Error('Acción local desconocida.');
 signal?.throwIfAborted();
 const result=command.action==='status'?await status():await run(command.action,command.input,{signal});
 signal?.throwIfAborted();
 let answer;
 if(command.action==='game'){
  const artifact=result.artifactUrl;
  if(typeof artifact!=='string'||!/^\/project\/artifacts\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(artifact))throw Error('El generador no devolvió un artefacto válido.');
  answer=`He generado un prototipo local con el componente integrado de Atlas. [Abrir el juego](${origin}${artifact}).\n\nEs un prototipo Canvas 2D basado en plantillas y reglas; su creación no acredita calidad AAA ni generación gráfica aprendida. Los archivos y el informe están en el proyecto unificado.`;
 }else if(command.action==='train')answer='El laboratorio ha recibido un experimento local acotado en CPU. Medirá un candidato del pequeño modelo de decisiones y guardará sus resultados. Qwen sigue usando tu GPU; este experimento no cambia sus pesos. Puedes consultar el avance con `/atlas estado` y solicitar la parada con `/atlas parar`.\n\n'+JSON.stringify(result,null,2);
 else if(command.action==='stop')answer='Parada solicitada al laboratorio experimental. El chat y la investigación principal siguen disponibles.\n\n'+JSON.stringify(result,null,2);
 else if(command.action==='decision')answer='Resultado del laboratorio de decisiones integrado. Es un análisis experimental limitado, no una verificación de hechos ni una respuesta de otro modelo general:\n\n```json\n'+JSON.stringify(result,null,2)+'\n```';
 else answer='Estado real del proyecto unificado:\n\n```json\n'+JSON.stringify(result,null,2)+'\n```';
 return {answer,model:'atlas-coordinator',modelName:'Atlas · coordinador local',reviewScope:'Componente local ejecutado; sin consulta a un proveedor externo',sources:[],warnings:[],webRead:false};
}
