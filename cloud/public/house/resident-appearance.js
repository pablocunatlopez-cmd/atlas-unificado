import {residentById} from './residents.js';
import {personalities} from './personalities.js';
import {HOUSE_FUNCTIONS} from './functional-world.js';

const hash=value=>{let n=2166136261;for(const c of value)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const uniforms={salon:'#527a70',music:'#916e4a',lab:'#e4e1d5',games:'#657987',cinema:'#586477',constellation:'#6f7891',mind:'#6b7d83',body:'#637a73',refutation:'#dddcd0',language:'#82758c'};
const heights={'salon-centre':1.68,'music-console':1.64,'lab-desk':1.70,'mind-desk':1.66,'refutation-candidate':1.68,'language-object':1.76,'language-meaning':1.65,'cinema-audience-1':1.74,'cinema-audience-3':1.67,'cinema-audience-5':1.77};
const male=new Set(['language-object','cinema-audience-1','cinema-audience-5']);
/** Appearance is stable identity/occupation data. It never reports a task as
 * completed, mutates personal memory or substitutes a different archetype. */
export function residentAppearance(id){
 const resident=residentById(id);if(!resident)return null;
 const seed=hash(id),hair=['#302823','#514034','#6e5540','#85705a'];
 return Object.freeze({version:'resident-appearance-1',residentId:id,name:resident.name,role:resident.role,room:resident.room,archetype:resident.archetype,template:male.has(id)?'male':'female',height:heights[id]||1.65,uniform:uniforms[resident.room]||'#637a73',hair:hair[seed%hair.length],skinTint:['#fff8f3','#fffaf6','#fff6ee'][seed%3],motionPhase:(seed%997)/997,personality:personalities[id]||resident.role,functionIds:Object.freeze(HOUSE_FUNCTIONS.filter(fn=>fn.owner===id).map(fn=>fn.id)),source:'Canonical resident ID, role, room and initial personality; scripted presentation, not inference.'});
}
