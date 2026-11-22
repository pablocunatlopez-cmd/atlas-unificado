/** Read-only projection of authenticated canonical chat history.
 * It is not a reasoning trace, observation or evidence of a physical event.
 */
export function projectLiaConversation(messages,{limit=30}={}){
 if(!Array.isArray(messages)||!Number.isInteger(limit)||limit<1||limit>100)throw new TypeError('Invalid conversation projection');
 const selected=messages.slice(-limit);
 return Object.freeze(selected.map((message,index)=>{
  if(!message||!['user','assistant'].includes(message.role)||typeof message.content!=='string'||!message.content.trim())throw new TypeError('Invalid canonical message');
  const time=typeof message.createdAt==='string'?Date.parse(message.createdAt):NaN;
  return Object.freeze({
   id:typeof message.id==='string'?message.id:`message-${messages.length-selected.length+index}`,
   role:message.role,
   time:Number.isFinite(time)?new Date(time).toISOString():null,
   summary:message.content.trim().slice(0,240),
   vertex:message.role==='assistant'?'mental':'unknown',
   provenance:'canonical-chat',
   verified:false,
   interpretation:message.role==='assistant'?'Texto emitido por el asistente, no razonamiento interno demostrado':'Mensaje del usuario, no observación física verificada'
  });
 }));
}
