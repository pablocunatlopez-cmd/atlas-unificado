'use client';
import {useId} from 'react';
type Props={size?:number;mode?:'exterior'|'interior';focus?:'mental'|'physical'|'god';label?:string};
const PALETTE={mental:'#a89cff',physical:'#64d9d0',god:'#f0bd82'} as const;
/** One visual identity reused at any depth. Decorative SVG, not a robot or neural process. */
export default function LiaAvatar({size=110,mode='interior',focus='mental',label='Lía'}:Props){
 const accent=PALETTE[focus];
 const gradientId=useId();
 return <svg width={size} height={size} viewBox="0 0 120 150" role="img" aria-label={`${label}, representación ${mode}`} xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#e8ecf7"/><stop offset="1" stopColor="#74849d"/></linearGradient></defs>
  <ellipse cx="60" cy="140" rx="35" ry="6" fill="#7e8bb3" opacity=".25"/>
  <path d="M33 97 Q26 104 21 137 L99 137 Q94 104 87 97 L75 90 H45Z" fill={`url(#${gradientId})`} stroke="#c9d5ef" strokeWidth="2"/>
  <path d="M43 99 L60 115 L77 99" fill="none" stroke={accent} strokeWidth="3"/>
  <rect x="51" y="80" width="18" height="20" rx="6" fill="#b6c4dc"/>
  <path d="M28 44 Q28 12 60 12 Q92 12 92 44 L88 72 Q80 91 60 92 Q40 91 32 72Z" fill="url(#lia-body)" stroke="#e8ecf7" strokeWidth="2"/>
  <path d="M33 48 Q60 37 87 48 L84 66 Q60 78 36 66Z" fill="#18283e"/>
  <path d="M42 55 Q48 52 54 55 M66 55 Q72 52 78 55" stroke={accent} strokeWidth="3" fill="none" strokeLinecap="round"/>
  <path d="M51 78 Q60 82 69 78" fill="none" stroke="#7389a6" strokeWidth="2"/>
  <circle cx="60" cy="125" r="5" fill={accent}/>
  {mode==='interior'&&<circle cx="60" cy="50" r="43" fill="none" stroke={accent} strokeDasharray="3 7" strokeWidth="1.5" opacity=".75"/>}
 </svg>;
}
