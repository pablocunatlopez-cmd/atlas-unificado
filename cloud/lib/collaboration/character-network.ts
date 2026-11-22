// Sparse one-layer neural classifier. Class labels are canonical mission IDs.
const stop=new Set('para como este esta esos esas desde puede sobre entre tiene hacer quiero ayudar ayuda mejorar caso Lía comprobar permite cambiar quieren necesita cuanto antes trabajo tras hasta cada cuando cual cuales puede debe donde mis una uno los las con por que del sin sus como una unos tarea dame algo este hola'.toLowerCase().split(' '));
export function features(text:string){return [...new Set((text.slice(0,800).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]+/g)||[]).filter(t=>t.length>=3&&!stop.has(t)))];}
export type Network={ids:string[];rows:Record<string,number[]>};
export function rankCharacters(net:Network,text:string){
 const keys=features(text).filter(k=>Object.hasOwn(net.rows,k));if(!keys.length)return [];
 const scores=net.ids.map((id,i)=>({id,score:keys.reduce((s,k)=>s+net.rows[k][i],0)/(100*Math.sqrt(keys.length))}));
 scores.sort((a,b)=>b.score-a.score);
 if(scores[0].score<1.4)return [];
 return scores.filter(r=>r.score>=1.4&&r.score>=scores[0].score*.54).slice(0,3).map(r=>r.id);
}
