import core from "@/data/core.json";import recent from "@/data/archive.json";
import continuity from '@/data/continuity.json';
export type ArchiveDoc={id:string;title:string;date:string;text:string};
export const documents:ArchiveDoc[]=[...continuity.documents,...recent.slice(0,-1).reverse(),core,...recent.slice(-1)];
export function excerpts(query:string,max=4){
const terms=query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").match(/[a-z]{4,}/g)||[];
const stops=new Set(["para","como","quiero","tengo","puedo","atlas","esto","sobre","porque","ayudame"]);
const selected=terms.filter(x=>!stops.has(x));
const fragments=documents.flatMap(d=>d.text.split(/\n(?=##? )/).map((text,i)=>({id:d.id,title:d.title,date:d.date,text:text.slice(0,7000),index:i})));
return fragments.map(f=>{const plain=f.text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");return {...f,score:selected.reduce((a,t)=>a+(plain.includes(t)?1:0),0)};}).filter(f=>f.score>0).sort((a,b)=>b.score-a.score).slice(0,max);
}

