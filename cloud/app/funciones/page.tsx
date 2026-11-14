import IcarusConsole from '../icarus-console';
import {getChatGPTUser} from '../chatgpt-auth';
export const dynamic='force-dynamic';
export const metadata={title:'Atlas · Personajes, salas y funciones'};
export default async function Page(){const user=await getChatGPTUser();return <main style={{maxWidth:1200,margin:'0 auto',padding:'32px 20px'}}><nav style={{display:'flex',flexWrap:'wrap',gap:24,marginBottom:32}}><a href="/">← Casa de Atlas</a><a href="/espiral">Memorias y espirales</a><a href="/laboratorio">Programas y pruebas</a></nav><IcarusConsole ready={!!user}/></main>;}
