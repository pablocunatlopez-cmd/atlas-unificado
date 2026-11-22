type Reflection={grounding?:'source-linked'|'unverified';conclusion:string;claims:{text:string;sourceIds:string[]}[];uncertainties:string[]};
export function groundReflection<T extends Reflection>(reflection:T,sourceIds:string[]){
 const valid=new Set(sourceIds);
 if(reflection.claims.some(c=>!c.sourceIds.length||c.sourceIds.some(id=>!valid.has(id))))throw new Error('INVALID_CITATION');
 if(!reflection.claims.length)return{...reflection,grounding:'unverified' as const,unverifiedHypothesis:reflection.conclusion,conclusion:'No se ha aceptado una conclusión factual respaldada por citas en esta vuelta. La hipótesis del modelo queda separada como no verificada.'};
 return{...reflection,grounding:'source-linked' as const};
}
export function reflectionContext<T extends Reflection>(reflection:T|undefined){
 if(!reflection)return undefined;
 const {conclusion,claims,uncertainties}=reflection;
 const linked=reflection.grounding==='source-linked'&&claims.length>0&&claims.every(c=>c.sourceIds.length>0);
 return{grounding:linked?'source-linked' as const:'unverified' as const,conclusion:linked?conclusion:'La reflexión anterior no tiene procedencia de citas aceptada explícitamente; su conclusión no se reutiliza como respaldo factual.',claims:linked?claims:[],uncertainties,epistemicStatus:'source-linked sólo identifica referencias enlazadas; no demuestra verdad ni implicación lógica.'};
}
