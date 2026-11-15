import WorldWorkshop from '../world-workshop';
import {getChatGPTUser} from '../chatgpt-auth';
import styles from './page.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'ERAS · El motor del cuerpo de Lía',description:'Diseñar, conservar y desarrollar los entornos de Lía con el motor ERAS.'};
export default async function ErasPage({searchParams}:{searchParams:Promise<{mode?:string|string[]}>}){
 const [user,parameters]=await Promise.all([getChatGPTUser(),searchParams]);
 const mode=parameters.mode==='game'?'game':'3d';
 return <main className={styles.page}>
  <header className={styles.header}><a href="/">← Casa de Lía</a><span>ION / CUERPO</span><a href="/chat/">Hablar con Lía ↗</a></header>
  <section className={styles.intro}><div><p className={styles.eyebrow}>ERAS · MOTOR GRÁFICO</p><h1>Dar cuerpo<br/>a una idea.</h1><p>Atlas piensa, Ícaro conecta conocimiento e Ion construye. ERAS es el motor con el que sus especialistas diseñan los entornos de Lía y desarrollan sus herramientas.</p></div><aside><span>DEL ENCARGO AL ENTORNO</span><ol><li><b>01</b><div><strong>Diseñar</strong><p>Describe la escena y encarga una composición al modelo disponible.</p></div></li><li><b>02</b><div><strong>Construir</strong><p>Abre el proyecto con ERAS, ajusta su configuración y conserva las revisiones.</p></div></li><li><b>03</b><div><strong>Desarrollar el motor</strong><p>Los constructores convierten problemas y referencias en cambios de código comprobados.</p></div></li></ol></aside></section>
  <nav className={styles.tabs} aria-label="Tipo de proyecto de ERAS"><a href="/eras/" aria-current={mode==='3d'?'page':undefined}>Escenas y entornos</a><a href="/eras/?mode=game" aria-current={mode==='game'?'page':undefined}>Prototipos jugables</a><a href="/taller/">Mis proyectos ↗</a></nav>
  <WorldWorkshop key={mode} mode={mode} ready={!!user}/>
  <footer className={styles.footer}><p>El juego original es una aplicación y un banco de pruebas de ERAS. El rendimiento y el aspecto se comprueban en tu dispositivo.</p><a href="https://eras-cronicas-humanidad.pablo-cunatlopez.chatgpt.site" target="_blank" rel="noopener noreferrer">Abrir el banco de pruebas original ↗</a><a href="/arquitectura/">Atlas, Ion, Ícaro y Lía →</a></footer>
 </main>;
}
