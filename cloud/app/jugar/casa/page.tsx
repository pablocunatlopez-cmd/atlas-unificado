import HousePrototype from './prototype';
import {getChatGPTUser} from '../../chatgpt-auth';
import {readState} from '@/lib/server-state';
import {residentPersonality} from '@/lib/cloud/resident-personality';
import {RESIDENTS} from '@/public/house/residents.js';
export const dynamic='force-dynamic';
export const metadata={title:'La casa de Lía · Prototipo jugable'};
export default async function HouseGamePage({searchParams}:{searchParams:Promise<{brief?:string}>}){
 const params=await searchParams,brief=typeof params.brief==='string'?params.brief.slice(0,600):'Una misión en la casa de Lía';
 const user=await getChatGPTUser();let content:string|undefined;
 if(user)try{content=JSON.stringify((await readState(user.userId)).state);}catch{}
 const profiles=Object.fromEntries(RESIDENTS.map((r:{id:string})=>[r.id,residentPersonality(r.id,content,brief)!]));
 return <HousePrototype brief={brief} profiles={profiles}/>;
}
