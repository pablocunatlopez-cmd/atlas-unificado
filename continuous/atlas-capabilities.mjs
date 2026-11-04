import {sanitizeExperienceStatus} from './experience-status.mjs';
import {sanitizePublicDocsStatus} from './process-telemetry.mjs';

/** Reviewed application features. Availability is not proof of a turn's execution. */
export function atlasApplicationCapabilities({experience,agents={},video={},publicDocs,sharedSession=false}={}){
 return {
  identity:'Atlas es el programa completo: Qwen razona y conversa; Ion ejecuta mediante el coordinador. La casa es su interfaz virtual real.',
  house:{
   available:true,route:'/',rooms:10,kind:'Casa virtual 3D en el navegador; no una vivienda física',
   residents:{total:24,workstations:18,audience:6,archetypes:['humanos','robots','animales','aves'],independentModels:false,scope:'Representan puestos y funciones; no son 24 modelos ni agentes independientes. Los espectadores permanecen en reposo.'},
   mirror:'Los gestos de trabajo requieren actividad reciente del proceso asignado. La presencia de habitantes no mide comprensión ni añade mejoras.',
   adaptiveDesign:{available:true,automatic:true,targets:['maquette','terrace'],requires:{cases:6,passed:6,invariantsPreserved:true},qwenWeightsChanged:false,arbitraryCodeExecution:false,visualQualityVerified:false,scope:'Cuando recibe el último plan 3D validado de la espiral, el visor aplica su geometría acotada a la maqueta del taller y a una instalación de la terraza. La capacidad no demuestra que este turno haya generado o aplicado un plan; no entrena Qwen ni acredita calidad estética.'},
   source:{project:'ERAS · Crónicas de la Humanidad',revision:'8a0fea077ccf84bed54d0b5c384dfc37b6aa4a86',reused:['mobile-input.js','render-engine.js','Three.js'],atlasFiles:['public/house/scene.js','public/house/residents.js','public/house/process-creatures.js','public/house/creative-installation.js','app/atlas-house.tsx'],scope:'La casa, sus muebles y habitantes son adaptaciones para Atlas. ERAS aporta código gráfico y controles, no todo el conocimiento ni los pesos de Atlas. Mejorar el render no demuestra mejora de todas las capacidades.'},
   selfModification:'Los ejecutores generan planes/prototipos 3D y herramientas con contratos; la interfaz puede incorporar esos planes automáticamente como geometría en la maqueta y la terraza. No despliegan cambios arbitrarios en el código de la casa o del servidor.'
  },
  creation:{worlds:{available:true,route:'/taller/',method:'Planes de Qwen validados y render WebGL procedural'},games:{available:true,route:'/taller/',scope:'Prototipos 3D; calidad AAA no demostrada'},music:{available:true,route:'/?room=music',method:'Estudio Web Audio, secuenciador, sintetizador y exportación WAV; funciona en el navegador, sin modelo musical'},video:{available:video.ready===true,route:'/?room=cinema',method:'Wan2.1 local mediante cola y GPU; necesita motor listo. El navegador también puede grabar su escena.'}},
  experience:sanitizeExperienceStatus(experience),
  codingCollaborators:['native','aider','smolagents'].map(id=>({id,available:agents[id]?.ready===true,model:'Qwen local',independentModel:false})),
  memory:{conversationHistory:'Historial persistente en la interfaz; no equivale a acceso a los archivos privados del PC',ownerPrivateMemoryAccessible:sharedSession!==true},
  codexPlugins:{copied:false,scope:'Las extensiones de Codex requieren adaptadores y autorización propios. No son 32 modelos ni están conectadas por aparecer en Codex.'},
  publicDocs:publicDocs?{...sanitizePublicDocsStatus(publicDocs),invocableTools:publicDocs.connected&&publicDocs.searchAvailable?['search_openai_docs']:[],scope:'El catálogo remoto tiene herramientas descubiertas; este adaptador solo invoca búsqueda documental. Este servidor concreto es anónimo y de lectura; MCP en general puede exigir autenticación y permitir escritura. Los fragmentos no son una lectura íntegra; Atlas dispone también de su lector HTTPS público.'}:null,
  executionRule:'Un archivo o bloque de código redactado no está instalado ni ejecutado. Nunca presentar simulaciones o respuestas de prueba como evaluaciones reales. Usa los espacios existentes, no inventes otra casa textual.'
 };
}
