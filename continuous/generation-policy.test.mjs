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
