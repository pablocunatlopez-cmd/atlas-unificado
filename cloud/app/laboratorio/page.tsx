import ProgramLab from '../program-lab';
export const metadata={title:'Atlas · Laboratorio de programas'};
export default function Page(){return <main style={{maxWidth:1040,margin:'0 auto',padding:'32px 20px'}}><nav style={{display:'flex',flexDirection:'row',flexWrap:'wrap',gap:24,marginBottom:40}}><a href="/">← Casa de Atlas</a><a href="/espiral">Espiral</a></nav><ProgramLab/></main>;}
