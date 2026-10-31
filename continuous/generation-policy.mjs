import fs from 'node:fs/promises';
export const DEFAULT_GENERATION_POLICY=Object.freeze({standardThinkingTokens:384,complexThinkingTokens:1024,recallThinkingTokens:128,reviewThinkingTokens:384,answerTokens:2600});
const policyFile=new URL('./data/chat-generation-policy.json',import.meta.url);
export function normalizeGenerationPolicy(value={}){
 const policy={};
 for(const [key,fallback] of Object.entries(DEFAULT_GENERATION_POLICY)){
  const min=key==='answerTokens'?512:0,max=key==='answerTokens'?4096:1536;
  policy[key]=Number.isInteger(value?.[key])&&value[key]>=min&&value[key]<=max?value[key]:fallback;
 }
 return policy;
}
export async function loadGenerationPolicy(){
 try{return normalizeGenerationPolicy(JSON.parse(await fs.readFile(policyFile,'utf8')));}catch{return {...DEFAULT_GENERATION_POLICY};}
}
export function generationPlan(messages,policy=DEFAULT_GENERATION_POLICY,{structured=false,json=false,stage='draft',forceDirect=false}={}){
 const rules=normalizeGenerationPolicy(policy);
 const question=(messages.at(-1)?.content||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 let category='general',budget=rules.standardThinkingTokens;
 if(structured||json||forceDirect){category='direct';budget=0;}
 else if(stage==='review'){category='review';budget=rules.reviewThinkingTokens;}
 else if(/^(?:[¡!¿?\s]*)(?:hola|buenas|buenos dias|buenas tardes|buenas noches|gracias|muchas gracias|hey|hello|hi)(?:[!.\s]*)$/.test(question)){category='greeting';budget=0;}
 else if(question.length>800||/\b(?:codigo|programa|programar|programacion|javascript|python|typescript|rust|sql|funcion|function|script|algoritmo|depura|debug|bug|demuestra|demostracion|integral|ecuacion|probabilidad|optimiza|analiza|disena|arquitectura|refuta|contrasta|videojuego)\b/.test(question)){category='complex';budget=rules.complexThinkingTokens;}
 else if(question.length<300&&messages.some(m=>m.content?.startsWith('MEMORIA HISTÓRICA'))&&/\b(?:como se llama|cual era|que acordamos|recuerdas|nombre|acordamos)\b/.test(question)){category='recall';budget=rules.recallThinkingTokens;}
 return {category,thinkingBudgetTokens:budget,answerTokens:structured?400:rules.answerTokens,maxTokens:(structured?400:rules.answerTokens)+budget};
}
