'use client';
import {useEffect,useState} from 'react';
type Profile={name:string;temperament:string;scope:string;principles:{title:string;text:string;status:string}[];error?:string};
export default function ResidentPersonality({id}:{id:string}){
 const [profile,setProfile]=useState<Profile|null>(null),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();setProfile(null);setError('');void fetch('/api/house/personality?resident='+encodeURIComponent(id),{cache:'no-store',signal:controller.signal}).then(async r=>{const value=await r.json() as Profile;if(!r.ok)throw Error(value.error||'No se pudo abrir el perfil.');setProfile(value);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[id]);
 return <details><summary>Personalidad y criterios desarrollables</summary>{error&&<p>{error}</p>}{profile&&<><p>{profile.temperament}</p>{profile.principles.map((p,i)=><p key={i}><strong>{p.title}</strong> · {p.text} <small>({p.status})</small></p>)}<a href={'/origen?view=memory&scope='+encodeURIComponent(profile.scope)}>Guardar una preferencia o regla para {profile.name.split(' · ')[0]} →</a><p>Los criterios de Talo, Zuri e Ion orientan los encargos de escenas y juegos. Los demás perfiles conservan aquí su desarrollo para su integración por especialidad.</p></>}</details>;
}
