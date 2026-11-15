export type Domain="general"|"salud"|"dinero"|"relaciones"|"trabajo"|"aprendizaje"|"creatividad"|"sentido";
export type Engine="native"|"ai"|"guided";
export type Source={title:string;url:string;kind:string};
export type AtlasReply={answer:string;basis:string;confidence:"Limitada"|"Razonable"|"Alta";claims:{label:string;text:string;why:string}[];unknowns:string[];nextSteps:string[];wouldChange:string;frame:{object:string;environment:string;perspective:string;scale:string};semiosis:{object:string;sign:string;interpretant:string};triangle:{center:string;animal:string;mind:string;event:string};sources:Source[];engine:Engine;searched:boolean};
export type Message={id:string;role:"user"|"assistant";text:string;date:string;reply?:AtlasReply;disputed?:boolean};
export type Thread={id:string;title:string;domain:Domain;date:string;messages:Message[]};
export type MemoryScope="global"|`resident:${string}`|`room:${string}`|`module:${string}`;
export type Memory={id:string;title:string;text:string;kind:"Preferencia"|"Contexto"|"Objetivo"|"Regla";domain:Domain;scope?:MemoryScope;status:"Aportado"|"Por revisar"|"Confirmado"|"Retirado";date:string;versions:{text:string;date:string;reason:string}[]};
export type Decision={id:string;title:string;domain:Domain;options:string;known:string;unknown:string;criterion:string;action:string;review:string;outcome:string;status:"Abierta"|"En prueba"|"Revisada";date:string};
export type Correction={id:string;before:string;after:string;reason:string;date:string;messageId?:string};
export type CheckIn={id:string;date:string;energy:number;note:string;next:string};
export type AtlasState={threads:Thread[];memories:Memory[];decisions:Decision[];corrections:Correction[];checkins:CheckIn[];settings:{name:string;web:boolean;deep:boolean;engine:Engine}};
export const makeId=()=>crypto.randomUUID();
export function initialState():AtlasState{
 const date="2026-10-13T05:00:00.000Z";
 return {threads:[],decisions:[],corrections:[],checkins:[],settings:{name:"Pablo",web:false,deep:false,engine:"native"},memories:[
 {id:"m1",title:"Cómo quiero que me acompañes",text:"Quiero honestidad, límites explícitos y consejos que puedan revisarse. Prefiero una acción concreta y útil.",kind:"Preferencia",domain:"general",status:"Aportado",date,versions:[]},
 {id:"m2",title:"Mi entorno",text:"Mi contexto anterior incluye Gandía y Terrateig. Conviene confirmarlo cuando la ubicación cambie una decisión.",kind:"Contexto",domain:"general",status:"Por revisar",date,versions:[]},
 {id:"m3",title:"Ideas que quiero desarrollar",text:"Música, clases de guitarra, tecnología e iniciativas agrícolas forman parte de mis proyectos. Sus cifras actuales están pendientes de actualizar.",kind:"Objetivo",domain:"trabajo",status:"Por revisar",date,versions:[]},
 {id:"m4",title:"Regla económica de Atlas",text:"Mercado solo en simulación. Invertible = sobrante documentado después de gastos, deuda y colchón. El estado documental de 0 € no es mi saldo real.",kind:"Regla",domain:"dinero",status:"Aportado",date,versions:[]}
 ]};
}

