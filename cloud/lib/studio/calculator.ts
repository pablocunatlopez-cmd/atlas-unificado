// Self-contained: embedded verbatim into generated HTML and exercised by the server bench.
export function calculateOperands(av:string,bv:string,op:string):number|string{
 if(!av.trim()||!bv.trim()||!Number.isFinite(Number(av))||!Number.isFinite(Number(bv)))return 'Introduce dos números';
 if(!['+','-','*','/'].includes(op))return 'Operación no válida';
 const a=Number(av),b=Number(bv);if(op==='/'&&b===0)return 'No se puede dividir entre cero';
 const value=op==='+'?a+b:op==='-'?a-b:op==='*'?a*b:a/b;return Number.isFinite(value)?value:'Resultado fuera de rango';
}
