/** Only explicit retrieval from user-owned Atlas threads, never external or cross-user data. */
export function retrieveSavedUserMessages(question,threads,{limit=3}={}){
 if(typeof question!=='string'||!Array.isArray(threads))return [];
 const normalized=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const words=normalized(question).match(/[a-z0-9]{3,}/g)||[];
 const ignored=new Set(['que','dije','sobre','antes','recuerdas','hablamos','quiero','saber','cual','fue','con','para','como','mis','tus','una','del','los','las','por','mas','algo','esto','este','esta','recuerdo','conversacion']);
 const terms=[...new Set(words.filter(word=>!ignored.has(word)))].slice(0,12);
 if(!terms.length)return [];
 const matches=[];
 for(const thread of threads.slice(-100)){
  if(!thread||!Array.isArray(thread.messages))continue;
  for(const message of thread.messages.slice(-150)){
   if(message?.role!=='user'||typeof message.text!=='string')continue;
   const haystack=normalized(message.text);
   const score=terms.filter(term=>haystack.includes(term)).length;
   if(score>0)matches.push({threadId:String(thread.id||'').slice(0,100),title:String(thread.title||'').slice(0,150),excerpt:message.text.slice(0,600),score});
  }
 }
 return matches.sort((a,b)=>b.score-a.score).slice(0,Math.max(0,Math.min(limit,5)));
}
