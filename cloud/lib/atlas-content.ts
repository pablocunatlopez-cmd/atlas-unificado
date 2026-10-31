import type {Domain,AtlasReply} from "./atlas-types";
export const domains:{id:Domain;name:string;description:string;prompt:string;color:string}[]=[
 {id:"salud",name:"Cuerpo y bienestar",description:"Escuchar señales y cuidar hábitos.",prompt:"Quiero cuidar mi energía y mis hábitos. Ayúdame a elegir un cambio pequeño y sostenible.",color:"sage"},
 {id:"dinero",name:"Dinero y seguridad",description:"Decidir con números, sin perseguir promesas.",prompt:"Ayúdame a ordenar mis finanzas sin suponer ingresos ni gastos que no te haya confirmado.",color:"gold"},
 {id:"relaciones",name:"Vínculos y emociones",description:"Entender lo que siento y lo que observo.",prompt:"Quiero entender una situación personal sin dar por hecho lo que piensa la otra persona.",color:"rose"},
 {id:"trabajo",name:"Trabajo y proyectos",description:"Convertir posibilidades en pruebas reales.",prompt:"Tengo varias ideas para ganar ingresos. Ayúdame a probar una antes de invertir mucho tiempo o dinero.",color:"blue"},
 {id:"aprendizaje",name:"Aprender y explorar",description:"Preguntas mejores, modelos revisables.",prompt:"Quiero aprender algo nuevo. Ayúdame a distinguir una explicación útil de una afirmación demostrada.",color:"lavender"},
 {id:"creatividad",name:"Crear y expresarme",description:"Música, ideas y espacio para experimentar.",prompt:"Quiero desbloquear un proyecto creativo y salir con un primer paso que pueda hacer hoy.",color:"peach"},
 {id:"sentido",name:"Sentido y perspectiva",description:"Pensar con amplitud, sin verdades absolutas.",prompt:"Quiero explorar mis valores y lo que da sentido a mi vida, sin tratar metáforas como hechos científicos.",color:"sage"}
];
export const principles=[
 {title:"Una perspectiva situada",body:"Toda respuesta nace de un objeto, un ambiente, una perspectiva y una escala. El ojo representa ese lugar desde el que observamos."},
 {title:"Hechos con procedencia",body:"Un dato aportado, una inferencia y una hipótesis reciben etiquetas distintas. Una fuente o una etiqueta no convierten a Atlas en infalible."},
 {title:"Memoria sin borrar el pasado",body:"Las correcciones añaden una versión y una razón. Los intentos refutados siguen disponibles para evitar repetir el error."},
 {title:"Un consejo que se pueda revisar",body:"Atlas propone acciones concretas, explicita lo que falta y señala qué observación cambiaría su orientación."},
 {title:"Sin certezas por complacencia",body:"No adivina pensamientos, no inventa fuentes ni saldos y no promete resultados. Puede discrepar y también decir «no lo sé»."},
 {title:"Aprender exige un cambio",body:"Más texto no es más conocimiento. Cuenta evidencia nueva, un error, una predicción resuelta, una regla modificada o una conexión podada."}
];
export const inheritedLessons=[
 "Correlación no establece causalidad.",
 "Una semejanza verbal o visual sigue siendo metáfora hasta probar estructura o mecanismo.",
 "Un patrón recurrente no devuelve el cuerpo, el ambiente ni la historia al mismo estado.",
 "Más gasto, pagos o documentos no prueban un mejor resultado.",
 "Un promedio favorable puede ocultar daños concentrados.",
 "Prerregistrar permite enmiendas fechadas; no permite reescribir una predicción después del resultado.",
 "Un comité y un control formal no prueban independencia efectiva.",
 "Pausar por seguridad no demuestra por sí solo una causa.",
 "Q387 9/12 valida revisiones documentales, no rentabilidad.",
 "0 € desplegables no es el saldo real de Pablo.",
 "Los precios minoristas y los futuros son objetos económicos distintos.",
 "El núcleo geométrico Atlas es candidato metodológico; no unifica la física."
];
export function guidedReply(text:string,domain:Domain):AtlasReply{
 const d=domains.find(x=>x.id===domain);
 const frameworks:Record<Domain,string[]>={
 general:["Describe qué ocurrió y qué quieres cambiar.","Separa lo observado de la interpretación.","Elige una acción pequeña y una fecha de revisión."],
 salud:["Anota la señal, duración, evolución y su impacto.","Si hay una señal grave o empeoramiento rápido, busca atención urgente; esta guía no evalúa tu caso.","Concreta una pregunta para un profesional o un hábito reversible."],
 dinero:["Registra ingresos, gastos, deuda y colchón actuales.","Compara opciones por coste neto, liquidez y riesgo.","Usa la calculadora de escenarios antes de atribuir un sobrante."],
 relaciones:["Escribe lo que observaste sin atribuir intenciones.","Añade dos explicaciones alternativas a tu primera lectura.","Plantea una conversación o un límite que dependa de ti."],
 trabajo:["Define para quién resuelves un problema concreto.","Estima coste total y una forma de comprobar demanda.","Haz una prueba limitada; decide después con el resultado."],
 aprendizaje:["Formula una pregunta verificable.","Busca un ejemplo y un caso que contradiga la explicación.","Resume qué cambió en tu modelo y qué sigue abierto."],
 creatividad:["Elige el formato y el efecto que quieres crear.","Haz una versión pequeña, sin pedirle que sea perfecta.","Pruébala con un criterio concreto y conserva lo aprendido."],
 sentido:["Distingue experiencia, valor personal y afirmación empírica.","Explora qué acción expresaría el valor que te importa.","Conserva la metáfora sin presentarla como demostración."]};
 return {answer:"Esta es una guía preparada para "+(d?.name.toLowerCase()||"ordenar una pregunta")+". No interpreta libremente tu mensaje con un modelo generativo. Puedes usar estos pasos para aclarar la situación y guardar una decisión revisable.",basis:"Marco de Atlas y orientación preparada. En este modo no hay búsqueda ni evaluación personal.",confidence:"Limitada",claims:[{label:"Dato aportado",text:text.slice(0,1400),why:"Tu descripción, sin verificación independiente."}],unknowns:["El contexto concreto y los datos necesarios para aconsejar sobre este caso.","Las opciones y restricciones que más te importan."],nextSteps:frameworks[domain],wouldChange:"Datos concretos y documentos pertinentes permitirían contrastar esta orientación.",frame:{object:text.slice(0,160),environment:"Tu contexto, por concretar",perspective:"Tu relato y un marco preparado",scale:"Una decisión revisable"},semiosis:{object:"Situación descrita",sign:"Tu mensaje",interpretant:"Preguntas orientativas; no una conclusión factual"},triangle:{center:"Solo se recibió tu texto.",animal:"Lo que notas, necesitas y puedes sostener.",mind:"Tu interpretación y las opciones disponibles.",event:"Lo inesperado y lo que falta conocer."},sources:[],engine:"guided",searched:false};
}

