export const budgetKeys=["base","variable","essential","transport","leisure","debt","cushion","housing"];
export function calculateBudget(values:Record<string,string>){
 if(!budgetKeys.every(k=>typeof values[k]==="string"&&values[k].trim()!==""&&Number.isFinite(Number(values[k]))&&Number(values[k])>=0))return null;
 const n=(k:string)=>Number(values[k]);
 const expenses=n("essential")+n("transport")+n("leisure")+n("debt")+n("cushion")+n("housing");
 return {expenses,bad:n("base")+n("variable")*.5-expenses,normal:n("base")+n("variable")-expenses,good:n("base")+n("variable")*1.5-expenses};
}
