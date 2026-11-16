/** Bounded, user-supplied context for Atlas Core; not persistent memory. */
export function recallRecentUserTurn(text,history=[]){
 if(typeof text!=='string'||!Array.isArray(history))return null;
 const query=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 if(!/^(que (te )?(dije|he dicho)( antes| anteriormente)?|recuerdas (lo que|que) (te )?dije|cual fue mi (ultima|anterior) (pregunta|mensaje))\??[.! ]*$/.test(query))return null;
 const previous=history.slice(-20).filter(item=>item&&item.role==='user'&&typeof item.text==='string'&&item.text.trim());
 if(!previous.length)return {answer:'No tengo ningún mensaje anterior tuyo en el contexto de esta sesión.',found:false};
 const last=previous.at(-1).text.trim().slice(0,1200);
 return {answer:'En esta sesión, tu último mensaje anterior fue: «'+last+'». No es memoria persistente ni demuestra que haya comprendido todo su significado.',found:true};
}
