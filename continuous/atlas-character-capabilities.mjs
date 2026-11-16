/** Proposed character-to-capability map for Atlas's inner world.
 * Non-destructive overlay: never replaces existing character IDs, personalities,
 * world state, memories, permissions or room definitions.
 * Roles are metaphors for bounded software capabilities, not autonomous agents.
 */
const entries=[
 ['atlas','Atlas','Mundo Mental','Núcleo','coordination'],
 ['lia','Lía','Interfaz','Salón','conversation'],
 ['ion','Ion','Mundo Físico','Observatorio','observations'],
 ['constelacion','Constelación','Dios/Suceso','Cúpula de lo inesperado','surprises'],
 ['da-vinci','Da Vinci','Creación','Taller de invenciones','design'],
 ['icaro','Ícaro','Exploración aérea','Torre del cielo','discovery'],
 ['galileo','Galileo','Observación','Observatorio','measurement'],
 ['darwin','Darwin','Evolución experimental','Laboratorio','experiments'],
 ['mnemosine','Mnemosine','Memoria y procedencia','Archivo','memory'],
 ['vera','Vera','Verificación','Tribunal de pruebas','verification'],
 ['noa','Noa','Sonido','Estudio','audio'],
 ['talo','Talo','Gráficos ERAS','Forja visual','rendering'],
 ['zuri','Zuri','Arte y materiales','Galería','materials'],
 ['teo','Teo','Animación','Teatro','animation'],
 ['sigma','Sigma','Escenas','Escenario','scenes'],
 ['ema','Ema','Lenguaje','Biblioteca','language'],
 ['ritmo','Ritmo','Música y tempo','Estudio','rhythm'],
 ['nilo','Nilo','Programación','Taller de código','coding'],
 ['pico','Pico','Herramientas','Taller de código','tooling'],
 ['cron os'.replace(' ',''),'Cronos','Tiempo tangente','Relojería','time'],
 ['janus','Janus','Versiones y alternativas','Sala de bifurcaciones','versions'],
 ['adversario','Adversario','Crítica y ataques','Sala de contraste','adversarial-review'],
 ['tribunal','Tribunal','Evaluación y aprobación','Tribunal de pruebas','governance'],
 ['hefest o'.replace(' ',''),'Hefesto','Construcción','Forja','building'],
 ['proteo','Proteo','Adaptación','Laboratorio','adaptation'],
 ['lethe','Lethe','Olvido controlado','Archivo','retention'],
 ['caronte','Caronte','Transiciones','Umbral','transitions'],
 ['toth','Toth','Registro y escritura','Biblioteca','records'],
 ['sabio','Sabio','Reflexión','Biblioteca','reasoning'],
 ['trickster','Trickster/Hermes','Paradojas','Sala de contraste','counterexamples'],
 ['inanna','Inanna','Descenso y transformación','Umbral','transformation'],
 ['ereshkigal','Ereshkigal','Sombra y límites','Umbral','limits'],
 ['director','Director','Orquestación narrativa','Teatro','direction'],
 ['meta-atlas','Meta-Atlas','Autoevaluación','Sala de espejos','self-review'],
 ['hum','Hum','Ambiente','Estudio','ambience']
];
export const atlasCharacterCapabilityMap=Object.freeze(entries.map(([id,name,domain,room,capability])=>Object.freeze({id,name,domain,room,capability,implementation:'proposed',autonomous:false,canGrantPermissions:false})));
export function proposeAtlasCharacterForCapability(capability){
 if(typeof capability!=='string'||!capability.trim())throw new TypeError('Invalid capability');
 const matches=atlasCharacterCapabilityMap.filter(x=>x.capability===capability);
 return Object.freeze({capability,characters:matches,implemented:false,requiresIntegrationReview:true});
}
