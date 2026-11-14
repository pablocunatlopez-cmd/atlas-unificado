type Reflection={conclusion:string;claims:{text:string;sourceIds:string[]}[];uncertainties:string[]};
export function groundReflection<T extends Reflection>(reflection:T,sourceIds:string[]){
 const valid=new Set(sourceIds);
 if(reflection.claims.some(c=>!c.sourceIds.length||c.sourceIds.some(id=>!valid.has(id))))throw new Error('INVALID_CITATION');
 if(!reflection.claims.length)return{...reflection,grounding:'unverified' as const,unverifiedHypothesis:reflection.conclusion,conclusion:'No se ha aceptado una conclusión factual respaldada por citas en esta vuelta. La hipótesis del modelo queda separada como no verificada.'};
 return{...reflection,grounding:'source-linked' as const};
}
export function reflectionContext<T extends Reflection>(reflection:T|undefined){
 if(!reflection)return undefined;
 const {conclusion,claims,uncertainties}=reflection;
 const linked=claims.length>0&&claims.every(c=>c.sourceIds.length>0);
 return{conclusion:linked?conclusion:'La reflexión anterior no aportó afirmaciones respaldadas por citas aceptadas.',claims:linked?claims:[],uncertainties};
}
