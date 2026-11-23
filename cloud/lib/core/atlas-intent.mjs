/** Only an explicit self-review request wakes the already configured loop. */
export function requestsAtlasReview(value){
 if(typeof value!=='string')return false;
 const text=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/\b(no|deten|para|parar|pausa|pausar|cancela)\b/.test(text)||/\b(explica|ejemplo|traduce|significa)\b/.test(text))return false;
 return /\b(mejorate|automejorate|revisate|autoprogramate)\b/.test(text)||/\b(continua|sigue|empieza|comienza|ponte)\b.{0,35}\b(mejorarte|mejorandote|aprendiendo|revisandote)\b/.test(text)||/\b(revisa|mejora)\b.{0,20}\b(tu nucleo|tus capacidades|tu propio programa)\b/.test(text);
}

/** Tool selection belongs to the explicit UI action. Describing video, music
 * or 3D capabilities in a chat question must remain a conversation. */
export function resolveCloudRequestKind({kind,message}={}){
 if(kind!==undefined)return kind;
 return requestsAtlasReview(message)?'review':'chat';
}

/** Only a direct, single creative commission runs a tool from conversation.
 * Capability questions, negations, conditional plans and mixed media stay chat. */
export function creationIntent(value){
 if(typeof value!=='string')return null;
 const s=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const command=/^(por favor[, ]+)?(crea|crear|haz|hazme|genera|generar|generame|construye|disena|compone|compon)\b/;
 const desire=/^quiero (?:que (?:crees|generes|compongas|disenes)\b|(?:un|una)\s+(?:videojuego|juego|escena|entorno|render|modelo|casa|cancion|partitura|melodia|pieza musical|video|guion|pelicula)\b)/;
 if(!(command.test(s)||desire.test(s))||/[¿?]/.test(s)||/\b(explica|analiza|cuando|si puedes|si te|como puedo|como crear)\b/.test(s))return null;
 if(/\bno\s+(?:(?:la|lo|las|los|me|te)\s+)*(?:hagas|generes|crees|ejecutes|compongas|disenes|construyas)\b/.test(s)||/^(?:por favor[, ]+)?(?:crea|crear|haz|hazme|genera|generar|generame|construye|disena)\s+(?:(?:un|una|el|la)\s+)?(?:analisis|explicacion|resumen|comparacion|inventario|descripcion|lista|codigo|script|programa|api)\b/.test(s))return null;
 const types=[];
 if(/videojuego|\bjuego\b/.test(s))types.push('game');
 else if(/\b3d\b|escena|entorno|render|modelo tridimensional/.test(s))types.push('world');
 if(/\bmusica\b|cancion|partitura|melodia|pieza musical/.test(s))types.push('music');
 if(/\bvideo\b|guion|planos de cine|pelicula/.test(s))types.push('film');
 return types.length===1?types[0]:null;
}
