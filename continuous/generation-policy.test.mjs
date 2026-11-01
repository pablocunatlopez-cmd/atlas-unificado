import test from 'node:test';
import assert from 'node:assert/strict';
import {generationPlan,normalizeGenerationPolicy,DEFAULT_GENERATION_POLICY} from './generation-policy.mjs';
import {chat} from './chat.mjs';
const messages=content=>[{role:'user',content}];
const response=content=>({ok:true,json:async()=>({choices:[{message:{content},finish_reason:'stop'}],usage:{completion_tokens:8}})});
test('saludos directos, código con razonamiento y presupuesto separado para la respuesta',()=>{
 assert.equal(generationPlan(messages('¡Hola!')).thinkingBudgetTokens,0);
 const code=generationPlan(messages('Implementa una función JavaScript que quite duplicados'));
 assert.equal(code.category,'complex');assert.equal(code.thinkingBudgetTokens,1024);assert.equal(code.maxTokens-code.thinkingBudgetTokens,2600);
});
test('las preguntas de memoria reciben un presupuesto breve sin desactivar el razonamiento general',()=>{
 const history=[{role:'user',content:'MEMORIA HISTÓRICA: un nombre'},{role:'assistant',content:'Recibido'},...messages('¿Cómo se llama el motor?')];
 assert.equal(generationPlan(history).category,'recall');assert.equal(generationPlan(history).thinkingBudgetTokens,128);
 assert.equal(generationPlan(messages('Háblame sobre Marte')).thinkingBudgetTokens,384);
});
test('JSON y reintentos directos no gastan razonamiento; la revisión queda acotada',()=>{
 assert.equal(generationPlan(messages('código'),undefined,{json:true}).thinkingBudgetTokens,0);
 assert.equal(generationPlan(messages('código'),undefined,{forceDirect:true}).thinkingBudgetTokens,0);
 assert.equal(generationPlan(messages('código'),undefined,{structured:true}).maxTokens,400);
 assert.equal(generationPlan(messages('código'),undefined,{stage:'review'}).thinkingBudgetTokens,384);
});
test('la política se puede ajustar dentro de límites y los valores inválidos recuperan el valor base',()=>{
 const policy=normalizeGenerationPolicy({standardThinkingTokens:128,complexThinkingTokens:Infinity,answerTokens:2,reviewThinkingTokens:-1});
 assert.equal(policy.standardThinkingTokens,128);assert.equal(policy.complexThinkingTokens,DEFAULT_GENERATION_POLICY.complexThinkingTokens);
 assert.equal(policy.answerTokens,2600);assert.equal(policy.reviewThinkingTokens,384);
});
test('chat transmite el presupuesto de cada fase y conserva la revisión',async()=>{
 const calls=[];
 const result=await chat({messages:messages('Implementa una función JavaScript'),refute:true},[],async(_url,options)=>{calls.push(JSON.parse(options.body));return response('function solve(input) { return input; }');});
 assert.equal(calls.length,2);assert.equal(calls[0].thinking_budget_tokens,1024);assert.equal(calls[1].thinking_budget_tokens,384);
 assert.equal(calls[0].max_tokens,3624);assert.equal(result.reviewed,true);
 assert.equal(result.performance.generations.length,2);assert.equal(result.performance.generations[0].thinkingBudgetTokens,1024);
});

test('an evolved strategy changes actual generation budget and review calls without adding permission',async()=>{
 const calls=[],decisions=[];
 const cognitiveCore={async decide(question,context){decisions.push({question,context});return {strategy:'direct',thinkingTokens:64,review:false,seekEvidence:true,versionId:'measured-policy'};}};
 const result=await chat({messages:messages('¿Qué es una función de JavaScript?')},[],async(url,options)=>{assert.equal(url,'http://127.0.0.1:11435/v1/chat/completions');calls.push(JSON.parse(options.body));return response('Una función agrupa una operación reutilizable.');},'','',null,'',[],'',{sharedSession:true,cognitiveCore});
 assert.equal(calls.length,1);assert.equal(calls[0].thinking_budget_tokens,64);assert.equal(calls[0].chat_template_kwargs.enable_thinking,true);assert.equal(calls[0].max_tokens,2664);assert.equal(result.reviewed,false);
 assert.equal(decisions.length,1);assert.equal(decisions[0].context.internet,false);assert.equal(decisions[0].context.tools,false);assert.equal(decisions[0].context.hasMemory,false);
});

test('learned review requests a real second pass and an explicit refutation still overrides learned direct mode',async()=>{
 for(const [review,refute] of [[true,false],[false,true]]){
  const calls=[];const cognitiveCore={decide:async()=>({strategy:'reason',thinkingTokens:512,review})};
  const result=await chat({messages:messages('Explica la idea con precisión.'),refute},[],async(_url,options)=>{calls.push(JSON.parse(options.body));return response(calls.length===1?'Borrador.':'Respuesta revisada.');},'','',null,'',[],'',{cognitiveCore});
  assert.equal(calls.length,2);assert.equal(result.reviewed,true);assert.equal(result.answer,'Respuesta revisada.');assert.equal(calls[0].thinking_budget_tokens,512);assert.equal(calls[1].thinking_budget_tokens,512);
 }
});

test('learned strategies cannot spend thinking tokens or start a second pass inside structured transport',async()=>{
 const coreDirective={strategy:'reason',thinkingTokens:1536,review:true};
 for(const flag of ['json','structured','forceDirect']){
  const plan=generationPlan(messages('Depura un videojuego'),undefined,{[flag]:true,coreDirective});assert.equal(plan.thinkingBudgetTokens,0);
 }
 assert.equal(generationPlan(messages('Depura un videojuego'),undefined,{coreDirective:{strategy:'reason',thinkingTokens:100000}}).thinkingBudgetTokens,1024);
 const calls=[];const cognitiveCore={decide:async()=>coreDirective};
 const result=await chat({json:true,messages:messages('Diseña un videojuego y revisa el resultado')},[],async(_url,options)=>{calls.push(JSON.parse(options.body));return response('{"ok":true}');},'','',null,'',[],'',{cognitiveCore});
 assert.equal(calls.length,1);assert.equal(calls[0].thinking_budget_tokens,0);assert.deepEqual(calls[0].response_format,{type:'json_object'});assert.equal(result.reviewed,false);assert.deepEqual(JSON.parse(result.answer),{ok:true});
});
