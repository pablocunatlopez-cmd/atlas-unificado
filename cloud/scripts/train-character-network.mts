import {MISSIONS} from '../lib/collaboration/missions.ts';
import {ERAS_CATALOG} from '../lib/collaboration/eras-catalog.ts';
import {features} from '../lib/collaboration/character-network.ts';
import {writeFileSync,readFileSync} from 'node:fs';
const actors=MISSIONS.filter(m=>m.kind==='resident'||m.kind==='character'),ids=actors.map(m=>m.id);
const examples=actors.flatMap((m,i)=>{
 const game=ERAS_CATALOG.find(g=>g.id===m.id);
 const fields=game?[game.name,game.role||'',game.description,m.title]:[m.name.split(' · ')[0],m.name,m.title,m.question,m.application,...m.validation];
 return fields.map(s=>({i,keys:features(s)})).filter(x=>x.keys.length);
});
const rows=new Map<string,Float64Array>();
for(const {keys} of examples)for(const k of keys)if(!rows.has(k))rows.set(k,new Float64Array(ids.length));
// Deterministic gradient descent on multiclass cross-entropy, no private examples.
for(let epoch=0;epoch<85;epoch++)for(let n=0;n<examples.length;n++){
 const {i,keys}=examples[(n+epoch)%examples.length],scale=1/Math.sqrt(keys.length);
 const logits=ids.map((_,j)=>keys.reduce((s,k)=>s+rows.get(k)![j]*scale,0)),max=Math.max(...logits);
 const exp=logits.map(x=>Math.exp(x-max)),sum=exp.reduce((a,b)=>a+b);
 for(const k of keys){const w=rows.get(k)!;for(let j=0;j<w.length;j++)w[j]+=.46*scale*((i===j?1:0)-exp[j]/sum);}
}
const json=JSON.stringify({ids,rows:Object.fromEntries([...rows].map(([k,w])=>[k,Array.from(w,n=>Math.round(n*100))]))})+'\n',file=new URL('../data/character-network.json',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(file,'utf8')!==json)throw Error('Clasificador desactualizado');}else writeFileSync(file,json);
console.log(ids.length+' personajes; '+examples.length+' ejemplos de catálogo; '+rows.size+' entradas.');
