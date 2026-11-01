// Selected definitions from the owner's original LOR-ΩΣ specification, chapter 1–2.
// This is a glossary, not a new grammar or a claim that the physics is established.
export const LOR_SOURCE={title:'Atlas_Unificado_LOR-OmegaSigma.md',version:'105',date:'2026-09-12',sha256:'6f26f5a842d8088d02b4c0873e0e59c69ff5aae00490f46e6aafbd891be74609'} as const;
export const LOR_FIELDS=[
 {symbol:'O',name:'Objetos',description:'Qué se está observando.'},
 {symbol:'A',name:'Ambiente',description:'En qué entorno ocurre.'},
 {symbol:'X',name:'Estados',description:'Cómo se encuentra el objeto.'},
 {symbol:'R',name:'Relaciones',description:'Qué conexiones se están proponiendo.'},
 {symbol:'T',name:'Transformaciones',description:'Qué cambia entre estados.'},
 {symbol:'I',name:'Invariantes',description:'Qué debería conservarse.'},
 {symbol:'C',name:'Restricciones',description:'Qué límites debe respetar.'},
 {symbol:'E',name:'Escala',description:'A qué escala se observa.'},
 {symbol:'M',name:'Medida',description:'Con qué medida se contrasta.'},
 {symbol:'P',name:'Predicciones',description:'Qué resultado se espera.'},
 {symbol:'F',name:'Falsadores',description:'Qué resultado refutaría la propuesta.'},
 {symbol:'Σ',name:'Cadena semiótica',description:'Objeto → signo → interpretante.'},
] as const;
export const CORE_PHASES=[
 {id:'observe',name:'Observar',description:'Registrar fuentes, hechos y fallos con procedencia.'},
 {id:'understand',name:'Comprender',description:'Formular una interpretación que pueda ponerse a prueba.'},
 {id:'connect',name:'Conectar',description:'Relacionar perspectivas sin convertir una coincidencia en certeza.'},
 {id:'apply',name:'Aplicar',description:'Ejecutar una propuesta dentro de sus límites.'},
 {id:'refute',name:'Refutar',description:'Buscar errores, contraejemplos y regresiones.'},
 {id:'retain',name:'Aprender',description:'Guardar resultados y promover solo un cambio respaldado por pruebas nuevas.'},
] as const;
export const CORE_VERTICES=[
 {name:'Animal · Cuerpo',actor:'Ion',description:'Percepción, regulación, herramientas y recursos disponibles.'},
 {name:'Mente · Lenguaje',actor:'Atlas',description:'Modelos, distinciones, memoria y símbolos.'},
 {name:'Dios · Suceso · Unidad',actor:'Constelación',description:'Azar, totalidad, sentido y límites. No es una causa empírica automática.'},
] as const;
