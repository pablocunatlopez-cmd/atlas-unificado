export const ARITHMETIC_VERSION='atlas-arithmetic-1';
export class ArithmeticError extends Error {}
export function calculateExpression(input:string):number{
 if(input.length>240)throw new ArithmeticError('La expresión supera el límite de longitud.');
 const text=input.replace(/×/g,'*').replace(/÷/g,'/').replace(/(\d),(\d)/g,'$1.$2');
 const tokens=text.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|\*\*|[+*/()\-]|\S/g)||[];
 if(!tokens.length||tokens.length>96)throw new ArithmeticError('La expresión está vacía o tiene demasiados términos.');
 let index=0,operations=0;
 function bounded(value:number){
  if(!Number.isFinite(value)||Number.isInteger(value)&&!Number.isSafeInteger(value))throw new ArithmeticError('El resultado supera la precisión numérica admitida.');
  return value;
 }
 function operation(value:number){if(++operations>48)throw new ArithmeticError('Demasiadas operaciones.');return bounded(value);}
 function primary():number{
  const token=tokens[index++];
  if(token==='('){const value=expression();if(tokens[index++]!==')')throw new ArithmeticError('Falta cerrar un paréntesis.');return value;}
  if(!token||! /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token))throw new ArithmeticError('Solo se admiten números y operaciones aritméticas.');
  return bounded(Number(token));
 }
 function power():number{const base=primary();if(tokens[index]==='**'){index++;const exponent=unary();if(Math.abs(exponent)>64)throw new ArithmeticError('El exponente supera el límite.');return operation(base**exponent);}return base;}
 function unary():number{if(tokens[index]==='+'){index++;return unary();}if(tokens[index]==='-'){index++;return -unary();}return power();}
 function product():number{
  let value=unary();while(tokens[index]==='*'||tokens[index]==='/'){const op=tokens[index++],right=unary();if(op==='/'&&right===0)throw new ArithmeticError('No se puede dividir entre cero.');value=operation(op==='*'?value*right:value/right);}return value;
 }
 function expression():number{let value=product();while(tokens[index]==='+'||tokens[index]==='-'){const op=tokens[index++],right=product();value=operation(op==='+'?value+right:value-right);}return value;}
 const result=expression();if(index!==tokens.length)throw new ArithmeticError('La expresión contiene términos no admitidos.');return bounded(result);
}
export function arithmeticRequest(question:string):{expression:string;value?:number;error?:string}|null{
 let text=question.trim().replace(/^[¿¡]/,'').replace(/[?=]+$/,'').replace(/\.$/,'').trim();
 const prefix=/^(?:calcula(?:r)?|cu[aá]nto\s+(?:es|da)|resuelve|eval[uú]a)\s*:?\s*/i;
 const explicit=prefix.test(text);text=text.replace(prefix,'').trim();
 if(!text||text.length>240||!/^[\d\seE.,+*/()×÷-]+$/.test(text)||!explicit&&!/[+*/×÷-]/.test(text))return null;
 try{return{expression:text,value:calculateExpression(text)};}catch(error){return{expression:text,error:error instanceof ArithmeticError?error.message:'No se pudo calcular la expresión.'};}
}
export function arithmeticAnswer(result:NonNullable<ReturnType<typeof arithmeticRequest>>){
 return result.error?`No puedo calcular esa expresión: ${result.error}`:`${result.expression} = **${Number(result.value!.toPrecision(15))}**\n\nCalculado con la herramienta aritmética de Atlas, sin consumir inferencia. Precisión numérica limitada.`;
}
