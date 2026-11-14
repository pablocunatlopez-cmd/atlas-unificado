// Snapshot of ERAS's canonical gameplay catalog; no new characters or zones.
// Role labels are narrative/gameplay roles, not assertions of independent AI agents.
export const ERAS_CATALOG_SHA = '43ea8968dc66c453da9c29d1ca469c91e177a2bc';
export const ERAS_CATALOG_SOURCE = 'dist/core.js';
export const ERAS_CATALOG_PROVENANCE = {project: 'eras', commit_sha: ERAS_CATALOG_SHA, source: ERAS_CATALOG_SOURCE} as const;
export type ErasCatalogEntry = {id:string;name:string;kind:'character'|'zone'|'building';eraId?:string;role?:string;description:string;sourceFiles:string[]};
export const ERAS_CATALOG: ErasCatalogEntry[] = [
  {
    "id": "eras-character:ice:scout",
    "name": "Ara",
    "kind": "character",
    "eraId": "ice",
    "role": "Exploradora",
    "description": "Veloz y resistente. Recorre el valle antes de que caiga la noche.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:ice:warrior",
    "name": "Eren",
    "kind": "character",
    "eraId": "ice",
    "role": "Cazador",
    "description": "Una lanza firme y golpes contundentes. Protege al grupo.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:ice:guardian",
    "name": "Nara",
    "kind": "character",
    "eraId": "ice",
    "role": "Guardiana",
    "description": "Mayor protección. Mantiene encendida la esperanza del clan.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:bronze:scout",
    "name": "Tala",
    "kind": "character",
    "eraId": "bronze",
    "role": "Mensajera",
    "description": "Velocidad para atravesar las rutas del altiplano.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:bronze:warrior",
    "name": "Aruna",
    "kind": "character",
    "eraId": "bronze",
    "role": "Guerrero",
    "description": "Protege la caravana con una espada de bronce.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:bronze:guardian",
    "name": "Hatti",
    "kind": "character",
    "eraId": "bronze",
    "role": "Centinela",
    "description": "Escudo y resistencia para defender el paso.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:greece:scout",
    "name": "Thaleia",
    "kind": "character",
    "eraId": "greece",
    "role": "Exploradora",
    "description": "Ligera de equipo, atraviesa los caminos del Ática.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:greece:warrior",
    "name": "Damon",
    "kind": "character",
    "eraId": "greece",
    "role": "Hoplita",
    "description": "Lanza y disciplina para sostener la posición.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:greece:guardian",
    "name": "Myrto",
    "kind": "character",
    "eraId": "greece",
    "role": "Defensora",
    "description": "Especialista en proteger a sus aliados.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:rome:scout",
    "name": "Livia",
    "kind": "character",
    "eraId": "rome",
    "role": "Exploradora",
    "description": "Lee el terreno y se mueve entre los árboles.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:rome:warrior",
    "name": "Marcus",
    "kind": "character",
    "eraId": "rome",
    "role": "Legionario",
    "description": "Golpes rápidos y disciplina de campamento.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:rome:guardian",
    "name": "Dacia",
    "kind": "character",
    "eraId": "rome",
    "role": "Auxiliar",
    "description": "Resistencia al servicio de la guarnición.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:medieval:scout",
    "name": "Inés",
    "kind": "character",
    "eraId": "medieval",
    "role": "Rastreadora",
    "description": "Recorre los pasos entre aldeas.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:medieval:warrior",
    "name": "Sancho",
    "kind": "character",
    "eraId": "medieval",
    "role": "Hombre de armas",
    "description": "Fuerza para defender el camino.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:medieval:guardian",
    "name": "Yusuf",
    "kind": "character",
    "eraId": "medieval",
    "role": "Guardián",
    "description": "Escudo y paciencia frente al peligro.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:renaissance:scout",
    "name": "Alba",
    "kind": "character",
    "eraId": "renaissance",
    "role": "Exploradora",
    "description": "Agilidad entre rutas comerciales y talleres.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:renaissance:warrior",
    "name": "Luca",
    "kind": "character",
    "eraId": "renaissance",
    "role": "Mercenario",
    "description": "Un veterano con dominio de la espada.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:renaissance:guardian",
    "name": "Beatrice",
    "kind": "character",
    "eraId": "renaissance",
    "role": "Custodia",
    "description": "Resistencia para proteger el barrio.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:industrial:scout",
    "name": "Ada",
    "kind": "character",
    "eraId": "industrial",
    "role": "Exploradora",
    "description": "Movilidad entre depósitos y vías.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:industrial:warrior",
    "name": "Émile",
    "kind": "character",
    "eraId": "industrial",
    "role": "Tirador",
    "description": "Mayor potencia con la carabina.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:industrial:guardian",
    "name": "Clara",
    "kind": "character",
    "eraId": "industrial",
    "role": "Custodia",
    "description": "Protege el punto de abastecimiento.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:present:scout",
    "name": "Vera",
    "kind": "character",
    "eraId": "present",
    "role": "Exploradora",
    "description": "Rapidez para localizar suministros.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:present:warrior",
    "name": "Leo",
    "kind": "character",
    "eraId": "present",
    "role": "Defensor",
    "description": "Potencia para despejar el enclave.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:present:guardian",
    "name": "Noor",
    "kind": "character",
    "eraId": "present",
    "role": "Guardiana",
    "description": "Protección para el equipo de reconstrucción.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:orbital:scout",
    "name": "Lyra",
    "kind": "character",
    "eraId": "orbital",
    "role": "Exploradora",
    "description": "Movilidad en terreno extraterrestre.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:orbital:warrior",
    "name": "Orion",
    "kind": "character",
    "eraId": "orbital",
    "role": "Operador",
    "description": "Potencia de los emisores de pulso.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:orbital:guardian",
    "name": "Sol",
    "kind": "character",
    "eraId": "orbital",
    "role": "Custodia",
    "description": "Protección para la colonia.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:stellar:scout",
    "name": "Nova",
    "kind": "character",
    "eraId": "stellar",
    "role": "Viajera",
    "description": "Velocidad entre los restos de otra civilización.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:stellar:warrior",
    "name": "Kael",
    "kind": "character",
    "eraId": "stellar",
    "role": "Vanguardia",
    "description": "Domina la hoja de energía.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-character:stellar:guardian",
    "name": "Iris",
    "kind": "character",
    "eraId": "stellar",
    "role": "Guardiana",
    "description": "Escudo para el último horizonte.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-zone:ice",
    "name": "Edad de Hielo",
    "kind": "zone",
    "eraId": "ice",
    "role": "El último fuego",
    "description": "Europa glacial. Antes de los imperios, sobrevivir era la primera conquista. Sin metal, agricultura ni ciudades. Los refugios de piel y las lanzas recrean tecnologías paleolíticas; no conocemos sus diseños exactos en cada región.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-zone:bronze",
    "name": "Edad del Bronce",
    "kind": "zone",
    "eraId": "bronze",
    "role": "La ruta del cobre",
    "description": "Anatolia. Los caminos unen ciudades. Las ciudades levantan imperios. La fecha sitúa este escenario; las edades del metal no comenzaron al mismo tiempo en todas las regiones.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-zone:greece",
    "name": "Grecia clásica",
    "kind": "zone",
    "eraId": "greece",
    "role": "La sombra de la polis",
    "description": "Ática. Entre olivares y murallas, elige qué merece ser defendido. Una falange histórica requería formación colectiva. El combate del prototipo simplifica esa realidad para permitir el control individual.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-zone:rome",
    "name": "Imperio romano",
    "kind": "zone",
    "eraId": "rome",
    "role": "Más allá del camino",
    "description": "Frontera del Danubio. La piedra guarda el orden. La frontera pone a prueba a quienes lo sostienen. El equipo militar varió entre unidades y décadas. Los modelos del prototipo son una aproximación visual simplificada.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-zone:medieval",
    "name": "Edad Media",
    "kind": "zone",
    "eraId": "medieval",
    "role": "La frontera de piedra",
    "description": "Península ibérica. Murallas, oficios y caminos. La vida continúa entre las guerras. El combate, los uniformes de facción y la construcción instantánea son simplificaciones. No se atribuyen a personas históricas.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-zone:renaissance",
    "name": "Renacimiento",
    "kind": "zone",
    "eraId": "renaissance",
    "role": "La ciudad de los talleres",
    "description": "Italia septentrional. Entre talleres y repúblicas, la próxima conquista puede ser una idea. El prototipo se centra en la espada. No reproduce todo el armamento ni la vida urbana de la Italia renacentista.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-zone:industrial",
    "name": "Era industrial",
    "kind": "zone",
    "eraId": "industrial",
    "role": "El pulso del hierro",
    "description": "Europa occidental. El hierro, el vapor y nuevas disputas transforman el mundo. El arma y sus tiempos de recarga se simplifican. No se pretende simular un modelo militar concreto.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-zone:present",
    "name": "Mundo contemporáneo",
    "kind": "zone",
    "eraId": "present",
    "role": "El mundo que heredamos",
    "description": "Costa mediterránea · escenario ficticio. Reconstruye el refugio y protege una ruta de abastecimiento. Arquitectura y equipo son genéricos. La campaña no pretende predecir acontecimientos de 2026.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-zone:orbital",
    "name": "Era orbital",
    "kind": "zone",
    "eraId": "orbital",
    "role": "Al otro lado del cielo",
    "description": "Colonia del terminador lunar. Un nuevo horizonte. Los mismos dilemas humanos. Los trajes y el paisaje sugieren una colonia lunar, pero el prototipo no simula el vacío ni la gravedad real de la Luna.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-zone:stellar",
    "name": "Era interestelar",
    "kind": "zone",
    "eraId": "stellar",
    "role": "El eco de la humanidad",
    "description": "Asterión · mundo imaginario. Lo que un día fue una hoguera ahora ilumina otros mundos. No se reproducen personajes, facciones, naves ni mundos de otras sagas.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-building:workshop",
    "name": "Taller",
    "kind": "building",
    "role": "workshop",
    "description": "Mejora el equipo del grupo. +20 % de daño.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-building:infirmary",
    "name": "Puesto de cura",
    "kind": "building",
    "role": "infirmary",
    "description": "Recupera 3 de salud por segundo cerca del refugio, fuera de combate.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-building:store",
    "name": "Almacén",
    "kind": "building",
    "role": "store",
    "description": "La comunidad produce 2 suministros cada 18 segundos.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-building:barracks",
    "name": "Alojamiento",
    "kind": "building",
    "role": "barracks",
    "description": "Amplía la capacidad del grupo de 2 a 4 aliados.",
    "sourceFiles": [
      "dist/core.js"
    ]
  },
  {
    "id": "eras-building:tower",
    "name": "Atalaya",
    "kind": "building",
    "role": "tower",
    "description": "Defiende el refugio. Alcance 19 m; un disparo cada 2 segundos.",
    "sourceFiles": [
      "dist/core.js"
    ]
  }
];
