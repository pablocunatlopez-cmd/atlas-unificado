/** Only an explicit self-review request wakes the already configured loop. */
export function requestsAtlasReview(value){
 if(typeof value!=='string')return false;
 const text=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/\b(no|deten|para|parar|pausa|pausar|cancela)\b/.test(text)||/\b(explica|ejemplo|traduce|significa)\b/.test(text))return false;
 return /\b(mejorate|automejorate|revisate|autoprogramate)\b/.test(text)||/\b(continua|sigue|empieza|comienza|ponte)\b.{0,35}\b(mejorarte|mejorandote|aprendiendo|revisandote)\b/.test(text)||/\b(revisa|mejora)\b.{0,20}\b(tu nucleo|tus capacidades|tu propio programa)\b/.test(text);
}
