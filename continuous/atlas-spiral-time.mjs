/**
 * Atlas Spiral — interpretive time model, NOT a physical law or a self-driving agent.
 * Every vertex is a viewpoint on the same recorded event, not an independent AI.
 */
export const SPIRAL_VERTICES=Object.freeze({
 mental:'Atlas · Mundo Mental: modelos, recuerdos, hipótesis y predicciones',
 physical:'Ion · Mundo Físico: observaciones y acciones realmente verificadas',
 god:'Dios · Suceso: lo inesperado que obliga a revisar el sistema; no una deidad ni un agente ejecutable'
});
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const normalize=value=>typeof value==='string'?value.trim().slice(0,2000):'';
/** Records an append-only observation; caller owns persistence and permissions. */
export function spiralEvent({id,time,mental='',physical='',unknown='',evidence=[],prediction='',outcome='',revisionOf=null}={}){
 if(typeof id!=='string'||!id.trim()||!finite(time)||time<0)throw new TypeError('Event requires id and finite nonnegative time');
 if(!Array.isArray(evidence)||evidence.length>12||evidence.some(item=>typeof item!=='string'))throw new TypeError('Invalid evidence');
 return Object.freeze({id:id.slice(0,100),time,vertices:Object.freeze({mental:normalize(mental),physical:normalize(physical),god:normalize(unknown)}),prediction:normalize(prediction),outcome:normalize(outcome),evidence:Object.freeze(evidence.map(normalize)),revisionOf:revisionOf===null?null:normalize(revisionOf),status:'user-supplied-unverified'});
}
/**
 * Discrete tangent is a local finite difference between consecutive events.
 * dt is elapsed timestamp units, NOT the length of an abstract cosmic time axis.
 * No interpolation or physical causal claim is implied.
 */
export function spiralTangent(previous,current){
 if(!previous||!current||!finite(previous.time)||!finite(current.time)||current.time<=previous.time)throw new RangeError('Tangent requires strictly increasing timestamps');
 const dt=current.time-previous.time;
 const changed=Object.keys(SPIRAL_VERTICES).filter(vertex=>previous.vertices?.[vertex]!==current.vertices?.[vertex]);
 return Object.freeze({from:previous.id,to:current.id,dt,changedVertices:Object.freeze(changed),direction:'local-change',interpretation:'La tangente representa la dirección de cambio entre dos sucesos registrados, no una ley física.'});
}
export function spiralTimeline(events,{limit=100}={}){
 if(!Array.isArray(events)||events.length>limit||events.length>1000)throw new RangeError('Too many events');
 const ids=new Set(),tangents=[];
 for(let i=0;i<events.length;i++){
  const event=events[i];
  if(!event||typeof event.id!=='string'||ids.has(event.id))throw new TypeError('Invalid or duplicate event');
  ids.add(event.id);
  if(i>0)tangents.push(spiralTangent(events[i-1],event));
 }
 return Object.freeze({events:Object.freeze([...events]),tangents:Object.freeze(tangents)});
}
/** A surprise requests revision; it never overwrites the original observation. */
export function spiralRevision(event,{id,time,unknown,evidence=[]}={}){
 if(!event||!id||!finite(time)||time<=event.time)throw new TypeError('Revision must be a later, distinct event');
 return spiralEvent({id,time,mental:event.vertices.mental,physical:event.vertices.physical,unknown,prediction:event.prediction,outcome:event.outcome,evidence,revisionOf:event.id});
}
