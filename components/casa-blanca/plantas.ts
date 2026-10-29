// ──────────────────────────────────────────────────────────────
// LAS PLANTAS DE LOS EDIFICIOS: cuartos, puertas, muros y muebles
//
// Una sola fuente para el interior de cada edificio. `lugares.ts` deriva de
// aquí los rectángulos de las salas y los nodos del grafo (la simulación camina
// por ellos), la escena (escena/interiores.ts) levanta muros, pisos y muebles
// en estas mismas coordenadas, y la interfaz lista las plantas.
//
// Medidas en metros, ejes de tipos.ts (+x este, +z sur). La Residencia por
// dentro va de x −24,9 a 24,9 y de z −12,3 a 12,3 (muro exterior de 0,7 m).
// Fuente: los planos públicos de la Casa Blanca (State Floor), ajustados a la
// fachada que ya está dibujada (arquitectura.ts). Lo que se ajustó está
// escrito en docs/specs/casa-blanca-interiores.md.
//
// Una planta con `lista: false` todavía no tiene interior en la escena: sus
// salas siguen con la regla vieja (el residente entra y no se ve).
// ──────────────────────────────────────────────────────────────

export type PlantaId =
  | "res-baja"
  | "res-estado"
  | "res-segundo"
  | "res-tercero"
  | "oeste-principal"
  | "oeste-sotano"
  | "eeob-baja"
  | "eeob-alta"
  | "tesoro-baja"

export type EdificioId = "residencia" | "ala-oeste" | "eeob" | "tesoro"

export interface Planta {
  id: PlantaId
  edificio: EdificioId
  nombre: string
  /** Para la barra de plantas en el teléfono (donde no entran los cuatro nombres). */
  corto: string
  /** Altura del piso terminado. */
  y: number
  /** Altura libre hasta el techo. */
  techo: number
  /** true = la escena ya la construye y la simulación camina por ella. */
  lista: boolean
}

/** Los muros de una planta se ven cortados a esta altura sobre el piso (la fachada también). */
export const CORTE = 2.7

export const PLANTAS: Planta[] = [
  { id: "res-tercero", edificio: "residencia", nombre: "Tercer piso", corto: "3.er piso", y: 13.9, techo: 2.8, lista: true },
  { id: "res-segundo", edificio: "residencia", nombre: "Segundo piso", corto: "2.º piso", y: 8.6, techo: 4.6, lista: true },
  { id: "res-estado", edificio: "residencia", nombre: "Planta de Estado", corto: "Estado", y: 3.45, techo: 5.15, lista: true },
  { id: "res-baja", edificio: "residencia", nombre: "Planta Baja", corto: "Baja", y: 0, techo: 3.1, lista: true },
  { id: "oeste-principal", edificio: "ala-oeste", nombre: "Planta principal", corto: "Principal", y: 0, techo: 3.6, lista: false },
  { id: "oeste-sotano", edificio: "ala-oeste", nombre: "Sótano", corto: "Sótano", y: -3.4, techo: 3.0, lista: false },
  { id: "eeob-alta", edificio: "eeob", nombre: "Segundo piso", corto: "2.º piso", y: 6, techo: 5, lista: false },
  { id: "eeob-baja", edificio: "eeob", nombre: "Planta baja", corto: "Baja", y: 0, techo: 5, lista: false },
  { id: "tesoro-baja", edificio: "tesoro", nombre: "Planta principal", corto: "Principal", y: 0, techo: 6, lista: false },
]
export const PLANTA = Object.fromEntries(PLANTAS.map((p) => [p.id, p])) as Record<PlantaId, Planta>

export const NOMBRE_EDIFICIO: Record<EdificioId, string> = {
  residencia: "Residencia",
  "ala-oeste": "Ala Oeste",
  eeob: "Edificio Eisenhower",
  tesoro: "Departamento del Tesoro",
}

/** Las plantas de un edificio, de arriba hacia abajo (como un corte). */
export const plantasDe = (e: EdificioId, soloListas = true) => PLANTAS.filter((p) => p.edificio === e && (!soloListas || p.lista))

// ── Geometría en planta ──────────────────────────────────────

export interface Rect {
  x0: number
  x1: number
  z0: number
  z1: number
}
export interface Asiento {
  x: number
  z: number
  /** Hacia dónde mira sentado (Math.atan2(dx, dz)). */
  rumbo: number
}

export type EstiloPiso = "parquet" | "marmol" | "damero" | "liso" | "piedra"
export type Alfombra = { x0: number; x1: number; z0: number; z1: number; color: string; borde: string; oval?: boolean }

export type TipoMueble =
  | "mesaComedor"
  | "mesaRedonda"
  | "mesita"
  | "silla"
  | "butaca"
  | "sofa"
  | "banco"
  | "consola"
  | "aparador"
  | "chimenea"
  | "piano"
  | "cuadro"
  | "palmera"
  | "columna"
  | "ascensor"
  | "mostrador"
  | "busto"
  | "cama"
  | "escritorio"
  | "estante"
  | "vitrina"
  | "estufa"
  | "billar"
  | "cinta"
  | "mapa"

/**
 * Un mueble: centro (x, z), `rumbo` = hacia dónde mira su frente (0 = sur),
 * `w` ancho y `d` fondo en su sistema (si no, los del tipo). Un cuadro o una
 * chimenea va contra un muro y mira hacia la sala.
 */
export interface Mueble {
  t: TipoMueble
  x: number
  z: number
  rumbo?: number
  w?: number
  d?: number
  /** Color principal (tapiz, madera, mármol). */
  color?: string
  /** Para un cuadro: el tono dominante de la pintura. */
  tono?: string
  /** Alto sobre el piso (cuadros: borde de abajo). */
  y?: number
  alto?: number
}

/** Medidas por defecto (ancho, fondo) de cada tipo. */
export const MEDIDA: Record<TipoMueble, [number, number]> = {
  mesaComedor: [1.4, 10.8],
  mesaRedonda: [1.2, 1.2],
  mesita: [1.1, 0.6],
  silla: [0.5, 0.52],
  butaca: [0.78, 0.78],
  sofa: [2.1, 0.86],
  banco: [1.7, 0.5],
  consola: [1.4, 0.45],
  aparador: [2.4, 0.6],
  chimenea: [1.9, 0.5],
  piano: [1.6, 2.75],
  cuadro: [1.2, 0.08],
  palmera: [0.7, 0.7],
  columna: [0.7, 0.7],
  ascensor: [1.9, 1.9],
  mostrador: [3.2, 0.7],
  busto: [0.5, 0.5],
  cama: [1.9, 2.2],
  escritorio: [1.7, 0.85],
  estante: [2.0, 0.42],
  vitrina: [1.5, 0.5],
  estufa: [2.6, 0.9],
  billar: [1.5, 2.7],
  cinta: [0.85, 1.9],
  mapa: [3.0, 0.08],
}

/** Los muebles que no se atraviesan (los cuadros cuelgan, las sillas son asientos). */
const SOLIDO: Partial<Record<TipoMueble, number>> = {
  mesaComedor: 0.85,
  mesaRedonda: 0.35,
  mesita: 0.3,
  sofa: 0.25,
  banco: 0.2,
  consola: 0.2,
  aparador: 0.2,
  chimenea: 0.2,
  piano: 0.35,
  palmera: 0.2,
  columna: 0.25,
  ascensor: 0.3,
  mostrador: 0.25,
  busto: 0.2,
  cama: 0.2,
  escritorio: 0.25,
  estante: 0.1,
  vitrina: 0.1,
  estufa: 0.2,
  billar: 0.5,
  cinta: 0.2,
}

export interface Cuarto {
  id: string
  planta: PlantaId
  nombre: string
  /** El rectángulo que lo envuelve. Con `ovalo`, norte y sur terminan en medio círculo. */
  rect: Rect
  /** Centros (z) de los medios círculos de un salón oval; el radio es la mitad del ancho. */
  ovalo?: { norte: number; sur: number }
  /** El lugar de lugares.ts que es este cuarto. */
  lugarId?: string
  /** Punto del grafo del cuarto (x, z): a la vista de cada puerta, lejos de los muebles. */
  nodo: [number, number]
  /** Altura del nodo si no es la de la planta (el pie de la escalinata). */
  yNodo?: number
  piso: EstiloPiso
  /** Color de las paredes (seda, pintura o mármol). */
  muro: string
  /** Color de las cortinas de sus ventanas. */
  cortina?: string
  /** Zócalo (la franja de abajo del muro). */
  zocalo?: string
  alfombras?: Alfombra[]
  muebles?: Mueble[]
  /** Un hueco en el piso (la escalinata que sube del Pórtico Norte). */
  hueco?: Rect
  /** Pasillo o servicio: se camina por él, nadie va "a" él. */
  paso?: boolean
  /** Afuera, pero de esta planta (el Balcón Truman): sin piso ni muros propios; se ve con la planta abierta. */
  exterior?: boolean
}

/** Una puerta o un paso abierto entre dos cuartos (o hacia afuera). */
export interface Puerta {
  id: string
  a: string
  b: string
  x: number
  z: number
  ancho: number
  /** El eje a lo largo del cual corre el muro donde está ("x": muro este-oeste). */
  eje: "x" | "z"
  /** Paso sin muro (columnas, el arranque de una escalera). */
  abierta?: boolean
}

/** Un muro interior: un rectángulo en planta, de piso a CORTE. Las puertas que caen en él lo cortan solas. */
export type Muro = Rect & { planta: PlantaId }

/** Un muro macizo de forma libre (el relleno entre un salón oval y sus vecinos). */
export interface Macizo {
  planta: PlantaId
  /** Puntos (x, z) en orden, sin repetir el primero. */
  pts: Array<[number, number]>
}

// ── Residencia · Planta de Estado (y 3,45) ────────────────────

const P_E: PlantaId = "res-estado"
const OVALO_AZUL = { norte: 7.3, sur: 13.0, r: 3.35 }

const MARMOL = "#d8d2c6"

/** El núcleo oeste: la escalera de servicio y el ascensor de la familia, igual en las cuatro plantas. */
const NUCLEO: Rect = { x0: -14.0, x1: -9.3, z0: -12.3, z1: -6.5 }
/** El nodo del núcleo: en la franja libre al sur de los tramos, junto a la puerta. */
const NODO_NUCLEO: [number, number] = [-10.9, -6.85]
/** La puerta del ascensor mira al sur, a la franja libre. */
const ASCENSOR: Mueble = { t: "ascensor", x: -10.5, z: -11.2, rumbo: 0, color: "#c9a15b" }

const ESTADO: Cuarto[] = [
  {
    id: "escalinata",
    planta: P_E,
    nombre: "Escalinata norte",
    rect: { x0: -2.4, x1: 2.4, z0: -12.3, z1: -6.3 },
    nodo: [0, -11.75],
    yNodo: 0.45,
    piso: "marmol",
    muro: MARMOL,
    paso: true,
  },
  {
    id: "vestibulo",
    planta: P_E,
    nombre: "Vestíbulo de entrada",
    rect: { x0: -9, x1: 9, z0: -12.3, z1: -1.4 },
    nodo: [0, -3.9],
    piso: "damero",
    muro: "#ddd7cb",
    cortina: "#b8923f",
    hueco: { x0: -2.4, x1: 2.4, z0: -12.3, z1: -6.3 },
    paso: true,
    muebles: [
      { t: "banco", x: -5.4, z: -11.95, rumbo: 0, color: "#b4433a" },
      { t: "banco", x: 5.4, z: -11.95, rumbo: 0, color: "#b4433a" },
      { t: "consola", x: -8.72, z: -8.6, rumbo: Math.PI / 2, color: "#e8e1d2" },
      { t: "consola", x: 8.72, z: -8.6, rumbo: -Math.PI / 2, color: "#e8e1d2" },
      { t: "palmera", x: -8.3, z: -2.1 },
      { t: "palmera", x: 8.3, z: -2.1 },
    ],
  },
  {
    id: "corredor",
    planta: P_E,
    nombre: "Gran Corredor",
    rect: { x0: -14, x1: 13.9, z0: -1.4, z1: 3.6 },
    nodo: [0, 1.1],
    piso: "marmol",
    muro: "#ddd7cb",
    paso: true,
    alfombras: [{ x0: -13.4, x1: 13.3, z0: 0.15, z1: 2.05, color: "#9e1f24", borde: "#d2a54a" }],
    muebles: [
      { t: "columna", x: -1.6, z: -1.4 },
      { t: "columna", x: 1.6, z: -1.4 },
      { t: "columna", x: -4.6, z: -1.4 },
      { t: "columna", x: 4.6, z: -1.4 },
      { t: "columna", x: -7.6, z: -1.4 },
      { t: "columna", x: 7.6, z: -1.4 },
      { t: "banco", x: -11.6, z: 3.28, rumbo: Math.PI, color: "#9e1f24" },
      { t: "banco", x: 11.6, z: 3.28, rumbo: Math.PI, color: "#9e1f24" },
      { t: "busto", x: -4.6, z: 3.15 },
      { t: "busto", x: 4.6, z: 3.15 },
      { t: "cuadro", x: -6.4, z: 3.55, rumbo: Math.PI, w: 1.0, alto: 1.3, y: 1.1, tono: "#3c3428" },
      { t: "cuadro", x: 6.4, z: 3.55, rumbo: Math.PI, w: 1.0, alto: 1.3, y: 1.1, tono: "#2f3440" },
    ],
  },
  {
    id: "gran-escalera",
    planta: P_E,
    nombre: "Gran Escalera",
    rect: { x0: 9.3, x1: 13.9, z0: -12.3, z1: -1.4 },
    nodo: [11.6, -2.6],
    piso: "marmol",
    muro: "#ddd7cb",
    paso: true,
  },
  {
    id: "salon-este",
    planta: P_E,
    nombre: "Salón Este",
    lugarId: "salon-este",
    rect: { x0: 14.2, x1: 24.9, z0: -12.3, z1: 12.3 },
    nodo: [16.4, 1.1],
    piso: "parquet",
    muro: "#e2dac8",
    cortina: "#d9ad48",
    zocalo: "#e7dcc4",
    muebles: [
      { t: "piano", x: 18.2, z: -8.6, rumbo: Math.PI / 2, color: "#2a1a10" },
      { t: "chimenea", x: 14.45, z: -4.4, rumbo: Math.PI / 2, color: "#efe9df" },
      { t: "chimenea", x: 14.45, z: -9.4, rumbo: Math.PI / 2, color: "#efe9df" },
      { t: "chimenea", x: 24.65, z: 7.2, rumbo: -Math.PI / 2, color: "#efe9df" },
      { t: "chimenea", x: 24.65, z: -7.2, rumbo: -Math.PI / 2, color: "#efe9df" },
      // Los retratos de cuerpo entero de George y Martha Washington.
      { t: "cuadro", x: 24.86, z: -2.4, rumbo: -Math.PI / 2, w: 1.5, alto: 2.3, y: 0.35, tono: "#2a2420" },
      { t: "cuadro", x: 24.86, z: 2.4, rumbo: -Math.PI / 2, w: 1.5, alto: 2.3, y: 0.35, tono: "#3a2c26" },
      { t: "consola", x: 14.45, z: 4.6, rumbo: Math.PI / 2, color: "#d8b45a" },
      { t: "consola", x: 14.45, z: 11.3, rumbo: Math.PI / 2, color: "#d8b45a" },
      { t: "banco", x: 19.55, z: -12.0, rumbo: 0, color: "#d9ad48" },
      { t: "banco", x: 19.55, z: 12.0, rumbo: Math.PI, color: "#d9ad48" },
      { t: "banco", x: 24.6, z: -11.0, rumbo: -Math.PI / 2, w: 1.3, color: "#d9ad48" },
      { t: "banco", x: 24.6, z: 11.0, rumbo: -Math.PI / 2, w: 1.3, color: "#d9ad48" },
    ],
  },
  {
    id: "salon-verde",
    planta: P_E,
    nombre: "Salón Verde",
    lugarId: "salon-verde",
    rect: { x0: 3.9, x1: 13.9, z0: 3.9, z1: 12.3 },
    nodo: [8.9, 5.2],
    piso: "parquet",
    muro: "#4f8a5b",
    cortina: "#2f6440",
    zocalo: "#e9e3d3",
    alfombras: [{ x0: 5.4, x1: 12.4, z0: 6.6, z1: 11.6, color: "#6e7f4a", borde: "#c9a95a" }],
    muebles: [
      { t: "chimenea", x: 11.6, z: 4.15, rumbo: 0, color: "#f0ebe2" },
      { t: "cuadro", x: 11.6, z: 3.95, rumbo: 0, w: 0.9, alto: 1.1, y: 1.45, tono: "#4a3a2a" },
      { t: "sofa", x: 8.9, z: 11.0, rumbo: Math.PI, color: "#3d7a4c" },
      { t: "mesita", x: 8.9, z: 9.3, rumbo: 0, color: "#5a3b22" },
      { t: "butaca", x: 7.0, z: 9.2, rumbo: Math.PI / 2, color: "#cfc08a" },
      { t: "butaca", x: 10.8, z: 9.2, rumbo: -Math.PI / 2, color: "#cfc08a" },
      { t: "consola", x: 13.65, z: 5.4, rumbo: -Math.PI / 2, color: "#5a3b22" },
      { t: "silla", x: 5.2, z: 11.6, rumbo: Math.PI * 0.8, color: "#3d7a4c" },
    ],
  },
  {
    id: "salon-azul",
    planta: P_E,
    nombre: "Salón Azul",
    lugarId: "salon-azul",
    rect: { x0: -OVALO_AZUL.r, x1: OVALO_AZUL.r, z0: OVALO_AZUL.norte - OVALO_AZUL.r, z1: OVALO_AZUL.sur + OVALO_AZUL.r },
    ovalo: { norte: OVALO_AZUL.norte, sur: OVALO_AZUL.sur },
    nodo: [0, 5.0],
    piso: "parquet",
    muro: "#2f62a8",
    cortina: "#1f4a8c",
    zocalo: "#e9e3d3",
    alfombras: [{ x0: -2.9, x1: 2.9, z0: 4.6, z1: 15.7, color: "#2b4f8a", borde: "#d9b45a", oval: true }],
    muebles: [
      { t: "mesaRedonda", x: 0, z: 10.4, color: "#e8dcc0" },
      { t: "silla", x: -2.75, z: 8.3, rumbo: Math.PI / 2, color: "#1f4a8c" },
      { t: "silla", x: 2.75, z: 8.3, rumbo: -Math.PI / 2, color: "#1f4a8c" },
      { t: "silla", x: -2.75, z: 11.6, rumbo: Math.PI / 2, color: "#1f4a8c" },
      { t: "silla", x: 2.75, z: 11.6, rumbo: -Math.PI / 2, color: "#1f4a8c" },
      { t: "sofa", x: 0, z: 15.25, rumbo: Math.PI, w: 1.8, color: "#1f4a8c" },
      { t: "consola", x: -3.05, z: 13.3, rumbo: Math.PI / 2, w: 1.0, color: "#d8b45a" },
      { t: "consola", x: 3.05, z: 13.3, rumbo: -Math.PI / 2, w: 1.0, color: "#d8b45a" },
    ],
  },
  {
    id: "salon-rojo",
    planta: P_E,
    nombre: "Salón Rojo",
    lugarId: "salon-rojo",
    rect: { x0: -13.7, x1: -3.9, z0: 3.9, z1: 12.3 },
    nodo: [-8.8, 5.2],
    piso: "parquet",
    muro: "#a3302b",
    cortina: "#7d1f1c",
    zocalo: "#e9e3d3",
    alfombras: [{ x0: -12.3, x1: -5.3, z0: 6.6, z1: 11.6, color: "#7a2b2a", borde: "#cfa552" }],
    muebles: [
      { t: "chimenea", x: -11.6, z: 4.15, rumbo: 0, color: "#f0ebe2" },
      { t: "cuadro", x: -11.6, z: 3.95, rumbo: 0, w: 0.9, alto: 1.1, y: 1.45, tono: "#3a2a22" },
      { t: "mesaRedonda", x: -8.8, z: 8.8, w: 1.0, d: 1.0, color: "#ece4d4" },
      { t: "sofa", x: -8.8, z: 11.0, rumbo: Math.PI, color: "#b23a32" },
      { t: "butaca", x: -10.7, z: 8.8, rumbo: Math.PI / 2, color: "#b23a32" },
      { t: "butaca", x: -6.9, z: 8.8, rumbo: -Math.PI / 2, color: "#b23a32" },
      { t: "consola", x: -13.45, z: 10.6, rumbo: Math.PI / 2, color: "#5a3b22" },
    ],
  },
  {
    id: "comedor-estado",
    planta: P_E,
    nombre: "Comedor de Estado",
    lugarId: "comedor-estado",
    rect: { x0: -24.9, x1: -14.3, z0: -2.3, z1: 12.3 },
    nodo: [-16.2, 1.1],
    piso: "parquet",
    muro: "#efe5cc",
    cortina: "#cfa443",
    zocalo: "#e2d6b8",
    alfombras: [{ x0: -23.2, x1: -16.0, z0: -1.4, z1: 11.6, color: "#c7a868", borde: "#7d5a2b" }],
    muebles: [
      { t: "mesaComedor", x: -19.6, z: 5.2, color: "#4a2c18" },
      // Sobre la chimenea, el retrato de Lincoln de G. P. A. Healy.
      { t: "chimenea", x: -24.65, z: 2.4, rumbo: Math.PI / 2, color: "#e9e2d4" },
      { t: "cuadro", x: -24.86, z: 2.4, rumbo: Math.PI / 2, w: 0.95, alto: 1.15, y: 1.45, tono: "#2c2620" },
      { t: "aparador", x: -19.6, z: -2.0, rumbo: 0, color: "#4a2c18" },
      { t: "aparador", x: -19.6, z: 12.0, rumbo: Math.PI, color: "#4a2c18" },
      { t: "palmera", x: -15.0, z: 11.6 },
      { t: "palmera", x: -15.0, z: -1.6 },
    ],
  },
  {
    id: "comedor-familiar",
    planta: P_E,
    nombre: "Comedor Familiar",
    rect: { x0: -24.9, x1: -14.3, z0: -12.3, z1: -6.0 },
    nodo: [-19.5, -6.9],
    piso: "parquet",
    muro: "#e9dfc6",
    cortina: "#b8923f",
    zocalo: "#ddd0b0",
    paso: true,
    alfombras: [{ x0: -22.6, x1: -16.6, z0: -11.2, z1: -7.6, color: "#8a6a3e", borde: "#5a3b22" }],
    muebles: [
      { t: "mesaComedor", x: -19.6, z: -9.4, rumbo: Math.PI / 2, w: 1.1, d: 2.6, color: "#5a3b22" },
      { t: "aparador", x: -24.6, z: -9.2, rumbo: Math.PI / 2, w: 2.0, color: "#5a3b22" },
    ],
  },
  {
    id: "despensa",
    planta: P_E,
    nombre: "Despensa",
    rect: { x0: -24.9, x1: -14.3, z0: -5.7, z1: -2.6 },
    nodo: [-17.2, -4.15],
    piso: "liso",
    muro: "#e6e1d6",
    paso: true,
    muebles: [
      { t: "mostrador", x: -22.8, z: -5.3, rumbo: 0, color: "#d9d4c8" },
      { t: "mostrador", x: -22.8, z: -3.0, rumbo: Math.PI, color: "#d9d4c8" },
    ],
  },
  {
    id: "paso-oeste",
    planta: P_E,
    nombre: "Paso oeste",
    rect: { x0: -14.0, x1: -9.3, z0: -6.2, z1: -1.4 },
    nodo: [-11.6, -3.9],
    piso: "marmol",
    muro: "#ddd7cb",
    paso: true,
  },
  {
    id: "nucleo-oeste",
    planta: P_E,
    nombre: "Escalera oeste",
    rect: NUCLEO,
    nodo: NODO_NUCLEO,
    piso: "liso",
    muro: "#ebe6da",
    paso: true,
    muebles: [ASCENSOR],
  },
]

const PUERTAS_ESTADO: Puerta[] = [
  // La puerta norte, en la fachada (b = "afuera": el grafo la une con ENLACES).
  { id: "norte", a: "escalinata", b: "afuera", x: 0, z: -12.7, ancho: 2.4, eje: "x" },
  { id: "vest-escal", a: "vestibulo", b: "escalinata", x: 0, z: -6.3, ancho: 4.0, eje: "x", abierta: true },
  { id: "vest-corr", a: "vestibulo", b: "corredor", x: 0, z: -1.4, ancho: 2.6, eje: "x", abierta: true },
  { id: "paso-corr", a: "paso-oeste", b: "corredor", x: -11.6, z: -1.4, ancho: 4.2, eje: "x", abierta: true },
  { id: "escal-corr", a: "gran-escalera", b: "corredor", x: 11.6, z: -1.4, ancho: 4.2, eje: "x", abierta: true },
  { id: "paso-vest", a: "paso-oeste", b: "vestibulo", x: -9.15, z: -3.9, ancho: 1.6, eje: "z" },
  { id: "paso-nucleo", a: "paso-oeste", b: "nucleo-oeste", x: -10.6, z: -6.35, ancho: 1.4, eje: "x" },
  { id: "paso-desp", a: "paso-oeste", b: "despensa", x: -14.15, z: -4.15, ancho: 1.2, eje: "z" },
  { id: "desp-fam", a: "despensa", b: "comedor-familiar", x: -19.5, z: -5.85, ancho: 1.2, eje: "x" },
  { id: "desp-com", a: "despensa", b: "comedor-estado", x: -16.2, z: -2.45, ancho: 1.3, eje: "x" },
  { id: "com-corr", a: "comedor-estado", b: "corredor", x: -14.15, z: 1.1, ancho: 2.0, eje: "z" },
  { id: "com-rojo", a: "comedor-estado", b: "salon-rojo", x: -14.0, z: 7.0, ancho: 1.4, eje: "z" },
  { id: "rojo-corr", a: "salon-rojo", b: "corredor", x: -8.8, z: 3.75, ancho: 1.6, eje: "x" },
  { id: "rojo-azul", a: "salon-rojo", b: "salon-azul", x: -3.62, z: 9.4, ancho: 1.3, eje: "z" },
  { id: "azul-corr", a: "salon-azul", b: "corredor", x: 0, z: 3.75, ancho: 1.6, eje: "x" },
  { id: "azul-verde", a: "salon-azul", b: "salon-verde", x: 3.62, z: 9.4, ancho: 1.3, eje: "z" },
  { id: "verde-corr", a: "salon-verde", b: "corredor", x: 8.9, z: 3.75, ancho: 1.6, eje: "x" },
  { id: "verde-este", a: "salon-verde", b: "salon-este", x: 14.05, z: 7.0, ancho: 1.4, eje: "z" },
  { id: "corr-este", a: "corredor", b: "salon-este", x: 14.05, z: 1.1, ancho: 2.2, eje: "z" },
]

/** Muros interiores (de piso a CORTE). Las puertas que caen dentro los cortan solas. */
const MUROS_ESTADO: Muro[] = [
  // Vestíbulo: oeste (con el Paso y el Núcleo) y este (con la Gran Escalera).
  { planta: P_E, x0: -9.3, x1: -9.0, z0: -12.3, z1: -1.4 },
  { planta: P_E, x0: 9.0, x1: 9.3, z0: -12.3, z1: -1.4 },
  // Columnas entre el Vestíbulo y el Gran Corredor: pilares en los extremos.
  { planta: P_E, x0: -9.0, x1: -8.4, z0: -1.55, z1: -1.25 },
  { planta: P_E, x0: 8.4, x1: 9.0, z0: -1.55, z1: -1.25 },
  // Paso oeste / Núcleo.
  { planta: P_E, x0: -14.0, x1: -9.3, z0: -6.5, z1: -6.2 },
  // Ala oeste: muro este del bloque de comedores (con el Paso, el Núcleo y el Corredor).
  { planta: P_E, x0: -14.3, x1: -14.0, z0: -12.3, z1: 12.3 },
  // Comedor Familiar / Despensa / Comedor de Estado.
  { planta: P_E, x0: -24.9, x1: -14.3, z0: -6.0, z1: -5.7 },
  { planta: P_E, x0: -24.9, x1: -14.3, z0: -2.6, z1: -2.3 },
  // Gran Escalera / Salón Este y Gran Corredor / Salón Este (y el Verde).
  { planta: P_E, x0: 13.9, x1: 14.2, z0: -12.3, z1: 12.3 },
  // Muro sur del Gran Corredor (el tramo del Salón Azul es macizo).
  { planta: P_E, x0: -14.0, x1: -3.9, z0: 3.6, z1: 3.9 },
  { planta: P_E, x0: 3.9, x1: 13.9, z0: 3.6, z1: 3.9 },
  // Salón Rojo / Salón Azul y Salón Azul / Salón Verde (tramos rectos del óvalo).
  { planta: P_E, x0: -3.9, x1: -3.35, z0: OVALO_AZUL.norte, z1: 12.3 },
  { planta: P_E, x0: 3.35, x1: 3.9, z0: OVALO_AZUL.norte, z1: 12.3 },
]

/** El relleno entre un salón oval y el corredor (los dos rincones del norte). */
function rinconOvalo(lado: 1 | -1): Array<[number, number]> {
  const { norte, r } = OVALO_AZUL
  const puerta = 0.8
  const pts: Array<[number, number]> = [
    [lado * puerta, 3.6],
    [lado * 3.9, 3.6],
    [lado * 3.9, norte],
    [lado * r, norte],
  ]
  // Arco desde el costado (ángulo 0) hasta el borde de la puerta.
  const aFin = Math.acos(puerta / r)
  const n = 10
  for (let i = 1; i <= n; i++) {
    const a = aFin * (i / n)
    pts.push([lado * r * Math.cos(a), norte - r * Math.sin(a)])
  }
  return pts
}
// ── Lo que se repite en las cuatro plantas de la Residencia ──────
// La misma franja de corredor (z −1,4..3,6), el óvalo al centro del lado sur
// y el núcleo oeste: los muros de carga caen uno sobre el otro.
const CORR = { z0: -1.4, z1: 3.6 }
/** Cara sur del muro norte del corredor y cara norte del muro sur. */
const N_PUERTA = -1.55
const S_PUERTA = 3.75
const pu = (id: string, a: string, b: string, x: number, z: number, ancho: number, eje: "x" | "z", abierta?: boolean): Puerta => ({ id, a, b, x, z, ancho, eje, ...(abierta ? { abierta } : {}) })
const mu = (planta: PlantaId, x0: number, x1: number, z0: number, z1: number): Muro => ({ planta, x0, x1, z0, z1 })

/** Muros comunes: los dos del corredor (el del sur se interrumpe en el óvalo), el núcleo y su paso. */
function murosComunes(p: PlantaId, conOvalo: boolean): Muro[] {
  const out: Muro[] = [mu(p, -24.9, 24.9, -1.7, -1.4)]
  if (conOvalo) {
    out.push(mu(p, -24.9, -3.9, 3.6, 3.9), mu(p, 3.9, 24.9, 3.6, 3.9))
    out.push(mu(p, -3.9, -3.35, OVALO_AZUL.norte, 12.3), mu(p, 3.35, 3.9, OVALO_AZUL.norte, 12.3))
  } else out.push(mu(p, -24.9, 24.9, 3.6, 3.9))
  // Núcleo oeste y su paso al corredor.
  out.push(mu(p, -14.3, -14.0, -12.3, -1.7), mu(p, -9.3, -9.0, -12.3, -1.7), mu(p, -14.0, -9.3, -6.5, -6.2))
  return out
}
/** El núcleo y su paso en una planta (sus ids llevan el sufijo de la planta). */
function nucleo(p: PlantaId, suf: string): Cuarto[] {
  return [
    { id: `nucleo-${suf}`, planta: p, nombre: "Escalera oeste", rect: NUCLEO, nodo: NODO_NUCLEO, piso: "liso", muro: "#ebe6da", paso: true, muebles: [ASCENSOR] },
    { id: `paso-${suf}`, planta: p, nombre: "Paso oeste", rect: { x0: -14.0, x1: -9.3, z0: -6.2, z1: -1.7 }, nodo: [-11.6, -3.9], piso: "marmol", muro: "#ddd7cb", paso: true },
  ]
}
const puertasNucleo = (suf: string, corredor: string): Puerta[] => [
  pu(`paso-corr-${suf}`, `paso-${suf}`, corredor, -11.6, N_PUERTA, 4.2, "x", true),
  pu(`paso-nucleo-${suf}`, `paso-${suf}`, `nucleo-${suf}`, -10.6, -6.35, 1.4, "x"),
]
const ovalo = { rect: { x0: -OVALO_AZUL.r, x1: OVALO_AZUL.r, z0: OVALO_AZUL.norte - OVALO_AZUL.r, z1: OVALO_AZUL.sur + OVALO_AZUL.r }, ovalo: { norte: OVALO_AZUL.norte, sur: OVALO_AZUL.sur } }

/**
 * Un dormitorio: la cama con la cabecera contra el muro de afuera, mesas de
 * noche, una butaca, una cómoda y una alfombra. `norte` = está al norte del
 * corredor (la puerta en su muro sur).
 */
function dormitorio(id: string, planta: PlantaId, nombre: string, x0: number, x1: number, norte: boolean, muro: string, colcha: string, extra: Partial<Cuarto> = {}): Cuarto {
  const z0 = norte ? -12.3 : 3.9
  const z1 = norte ? -1.7 : 12.3
  const cx = (x0 + x1) / 2
  const [, d] = MEDIDA.cama
  const zc = norte ? z0 + d / 2 : z1 - d / 2
  const rc = norte ? 0 : Math.PI
  const zm = norte ? z0 + 0.35 : z1 - 0.35
  const zPuerta = norte ? z1 - 1.2 : z0 + 1.2
  return {
    id,
    planta,
    nombre,
    rect: { x0, x1, z0, z1 },
    nodo: [cx, zPuerta],
    piso: "parquet",
    muro,
    cortina: colcha,
    zocalo: "#ece4d2",
    alfombras: [{ x0: cx - 1.7, x1: cx + 1.7, z0: norte ? z0 + 1.0 : z1 - 4.4, z1: norte ? z0 + 4.4 : z1 - 1.0, color: "#8e7a5c", borde: "#c9b07a" }],
    muebles: [
      { t: "cama", x: cx, z: zc, rumbo: rc, color: colcha },
      { t: "mesita", x: cx - 1.4, z: zm, rumbo: rc, w: 0.5, d: 0.45, color: P_MADERA },
      { t: "mesita", x: cx + 1.4, z: zm, rumbo: rc, w: 0.5, d: 0.45, color: P_MADERA },
      { t: "butaca", x: x1 - 0.8, z: norte ? -4.2 : 6.2, rumbo: -Math.PI / 2, color: colcha },
      { t: "aparador", x: x0 + 0.33, z: norte ? -6.8 : 8.8, rumbo: Math.PI / 2, w: 1.6, color: P_MADERA },
    ],
    ...extra,
  }
}
const P_MADERA = "#5a3b22"

// ── Residencia · Planta Baja (y 0) ─────────────────────────────
// Orden real (plano público, Ground Floor): al sur, Sala de Mapas, Recepción
// Diplomática (oval, puerta al Pórtico Sur) y Sala de la Porcelana; al norte,
// la Cocina, la Biblioteca y la Sala Vermeil, a los lados de la escalinata norte.
const P_B: PlantaId = "res-baja"
const BAJA: Cuarto[] = [
  {
    id: "corredor-baja",
    planta: P_B,
    nombre: "Corredor de la Planta Baja",
    rect: { x0: -24.9, x1: 24.9, ...CORR },
    nodo: [0, 1.1],
    piso: "marmol",
    muro: "#e4ddcf",
    paso: true,
    alfombras: [{ x0: -23.6, x1: 23.6, z0: 0.25, z1: 1.95, color: "#9e1f24", borde: "#d2a54a" }],
    muebles: [
      { t: "busto", x: -11.15, z: 3.3 },
      { t: "busto", x: 11.15, z: 3.3 },
      { t: "banco", x: -23.2, z: -1.13, rumbo: 0, color: "#9e1f24" },
      { t: "banco", x: 22.0, z: -1.13, rumbo: 0, color: "#9e1f24" },
      { t: "cuadro", x: -8.4, z: -1.37, rumbo: 0, w: 0.9, alto: 1.2, y: 1.0, tono: "#3c3428" },
      { t: "cuadro", x: 8.4, z: -1.37, rumbo: 0, w: 0.9, alto: 1.2, y: 1.0, tono: "#2f3440" },
      { t: "cuadro", x: 13.6, z: -1.37, rumbo: 0, w: 0.9, alto: 1.2, y: 1.0, tono: "#3a2c26" },
      { t: "cuadro", x: -15.6, z: -1.37, rumbo: 0, w: 0.9, alto: 1.2, y: 1.0, tono: "#2c2620" },
    ],
  },
  {
    id: "galeria-oeste",
    planta: P_B,
    nombre: "Galería oeste",
    rect: { x0: -24.9, x1: -21.4, z0: 3.9, z1: 12.3 },
    nodo: [-23.0, 4.8],
    piso: "marmol",
    muro: "#e4ddcf",
    paso: true,
    muebles: [
      { t: "banco", x: -21.68, z: 8.6, rumbo: -Math.PI / 2, color: "#9e1f24" },
      { t: "palmera", x: -24.3, z: 11.7 },
      { t: "palmera", x: -22.0, z: 11.7 },
    ],
  },
  {
    id: "consultorio",
    planta: P_B,
    nombre: "Consultorio médico",
    rect: { x0: -21.1, x1: -11.3, z0: 3.9, z1: 12.3 },
    nodo: [-15.5, 5.2],
    piso: "liso",
    muro: "#e6ecee",
    cortina: "#9fb3bd",
    muebles: [
      { t: "escritorio", x: -15.0, z: 8.6, rumbo: 0, color: "#6b5136" },
      { t: "silla", x: -15.0, z: 9.5, rumbo: Math.PI, color: "#5f7380" },
      { t: "cama", x: -20.0, z: 9.2, rumbo: Math.PI / 2, w: 0.9, d: 2.0, alto: 0.3, color: "#e9eef0" },
      { t: "vitrina", x: -11.55, z: 7.6, rumbo: -Math.PI / 2, color: "#e9eef0" },
      { t: "estante", x: -11.53, z: 10.6, rumbo: -Math.PI / 2, w: 1.8, color: "#d9dcdf" },
    ],
  },
  {
    id: "sala-mapas",
    planta: P_B,
    nombre: "Sala de Mapas",
    lugarId: "sala-mapas",
    rect: { x0: -11.0, x1: -3.9, z0: 3.9, z1: 12.3 },
    nodo: [-6.4, 5.4],
    piso: "parquet",
    muro: "#d8c9a2",
    cortina: "#8a6a3e",
    zocalo: "#ece4d2",
    alfombras: [{ x0: -10.3, x1: -4.6, z0: 4.6, z1: 11.6, color: "#7a5a3a", borde: "#c9a95a" }],
    muebles: [
      // El último mapa de situación de la Segunda Guerra Mundial, en el muro sur.
      { t: "mapa", x: -7.45, z: 12.26, rumbo: Math.PI, w: 3.2, alto: 1.9, y: 0.75, tono: "#cfc6a6" },
      { t: "chimenea", x: -10.75, z: 8.1, rumbo: Math.PI / 2, color: "#efe9df" },
      { t: "butaca", x: -8.9, z: 6.9, rumbo: -Math.PI / 2, color: "#8a5a3a" },
      { t: "butaca", x: -8.9, z: 9.3, rumbo: -Math.PI / 2, color: "#8a5a3a" },
      { t: "escritorio", x: -6.0, z: 9.9, rumbo: 0, w: 1.5, d: 0.8, color: "#4a2614" },
      { t: "silla", x: -6.0, z: 10.8, rumbo: Math.PI, color: "#8a5a3a" },
    ],
  },
  {
    id: "recepcion-diplomatica",
    planta: P_B,
    nombre: "Recepción Diplomática",
    lugarId: "recepcion-diplomatica",
    ...ovalo,
    nodo: [0, 8.4],
    piso: "parquet",
    // El papel panorámico «Vistas de América del Norte» (1834).
    muro: "#c9b98c",
    cortina: "#6e5a2e",
    zocalo: "#ece4d2",
    alfombras: [{ x0: -2.9, x1: 2.9, z0: 4.6, z1: 15.7, color: "#4f6688", borde: "#d9c79a", oval: true }],
    muebles: [
      { t: "sofa", x: -2.68, z: 12.3, rumbo: Math.PI / 2, w: 1.6, color: "#c9a85a" },
      { t: "sofa", x: 2.68, z: 12.3, rumbo: -Math.PI / 2, w: 1.6, color: "#c9a85a" },
      { t: "butaca", x: -1.75, z: 14.7, rumbo: Math.PI * 0.85, color: "#c9a85a" },
      { t: "butaca", x: 1.75, z: 14.7, rumbo: -Math.PI * 0.85, color: "#c9a85a" },
      { t: "consola", x: -3.05, z: 6.4, rumbo: Math.PI / 2, w: 0.9, color: "#d8b45a" },
      { t: "consola", x: 3.05, z: 6.4, rumbo: -Math.PI / 2, w: 0.9, color: "#d8b45a" },
    ],
  },
  {
    id: "sala-porcelana",
    planta: P_B,
    nombre: "Sala de la Porcelana",
    rect: { x0: 3.9, x1: 11.0, z0: 3.9, z1: 12.3 },
    nodo: [6.0, 5.2],
    piso: "parquet",
    muro: "#a8322e",
    cortina: "#7d1f1c",
    zocalo: "#ece4d2",
    alfombras: [{ x0: 4.8, x1: 10.2, z0: 5.0, z1: 11.4, color: "#8a2a28", borde: "#d9b45a" }],
    muebles: [
      { t: "chimenea", x: 7.5, z: 12.05, rumbo: Math.PI, color: "#f0ebe2" },
      { t: "cuadro", x: 7.5, z: 12.26, rumbo: Math.PI, w: 0.9, alto: 1.1, y: 1.45, tono: "#4a3a2a" },
      { t: "vitrina", x: 5.15, z: 12.03, rumbo: Math.PI, w: 1.4, color: "#e9e2d2" },
      { t: "vitrina", x: 9.85, z: 12.03, rumbo: Math.PI, w: 1.4, color: "#e9e2d2" },
      { t: "vitrina", x: 10.73, z: 6.2, rumbo: -Math.PI / 2, color: "#e9e2d2" },
      { t: "vitrina", x: 10.73, z: 9.2, rumbo: -Math.PI / 2, color: "#e9e2d2" },
      { t: "mesaRedonda", x: 7.5, z: 8.4, color: "#e8dcc0" },
      { t: "silla", x: 6.5, z: 8.4, rumbo: Math.PI / 2, color: "#9e2b2b" },
      { t: "silla", x: 8.5, z: 8.4, rumbo: -Math.PI / 2, color: "#9e2b2b" },
    ],
  },
  {
    id: "oficinas-sur-baja",
    planta: P_B,
    nombre: "Oficinas",
    rect: { x0: 11.3, x1: 24.9, z0: 3.9, z1: 12.3 },
    nodo: [17.0, 5.2],
    piso: "parquet",
    muro: "#e6e0d2",
    cortina: "#8e7a5c",
    muebles: [
      { t: "escritorio", x: 14.6, z: 8.2, rumbo: 0, color: "#5a3b22" },
      { t: "silla", x: 14.6, z: 9.1, rumbo: Math.PI, color: "#3d4a5a" },
      { t: "escritorio", x: 20.6, z: 8.2, rumbo: 0, color: "#5a3b22" },
      { t: "silla", x: 20.6, z: 9.1, rumbo: Math.PI, color: "#3d4a5a" },
      { t: "estante", x: 11.53, z: 8.0, rumbo: Math.PI / 2, color: "#5a3b22" },
    ],
  },
  {
    id: "cocina",
    planta: P_B,
    nombre: "Cocina",
    lugarId: "cocina",
    rect: { x0: -24.9, x1: -14.3, z0: -12.3, z1: -1.7 },
    nodo: [-19.5, -2.9],
    piso: "liso",
    muro: "#eef0ee",
    muebles: [
      { t: "estufa", x: -22.0, z: -11.85, rumbo: 0 },
      { t: "estufa", x: -17.2, z: -11.85, rumbo: 0 },
      { t: "mostrador", x: -19.6, z: -7.85, rumbo: 0, w: 4.2, color: "#d9dcdf" },
      { t: "mostrador", x: -19.6, z: -7.15, rumbo: Math.PI, w: 4.2, color: "#d9dcdf" },
      { t: "mostrador", x: -24.55, z: -4.3, rumbo: Math.PI / 2, w: 3.0, color: "#d9dcdf" },
      { t: "mostrador", x: -14.65, z: -4.6, rumbo: -Math.PI / 2, w: 3.0, color: "#d9dcdf" },
      { t: "vitrina", x: -14.55, z: -9.6, rumbo: -Math.PI / 2, color: "#d9dcdf" },
    ],
  },
  ...nucleo(P_B, "baja"),
  {
    id: "biblioteca-res",
    planta: P_B,
    nombre: "Biblioteca",
    rect: { x0: -9.0, x1: -2.7, z0: -12.3, z1: -1.7 },
    nodo: [-5.8, -2.9],
    piso: "parquet",
    muro: "#9a7a52",
    cortina: "#6e4a2a",
    zocalo: "#7a5a3a",
    alfombras: [{ x0: -8.2, x1: -3.4, z0: -11.4, z1: -2.6, color: "#6a4a32", borde: "#c9a95a" }],
    muebles: [
      { t: "estante", x: -8.77, z: -10.2, rumbo: Math.PI / 2, color: "#6b4a2a" },
      { t: "estante", x: -8.77, z: -3.3, rumbo: Math.PI / 2, color: "#6b4a2a" },
      { t: "estante", x: -2.93, z: -9.4, rumbo: -Math.PI / 2, color: "#6b4a2a" },
      { t: "estante", x: -2.93, z: -5.2, rumbo: -Math.PI / 2, color: "#6b4a2a" },
      { t: "estante", x: -4.4, z: -12.07, rumbo: 0, w: 1.8, color: "#6b4a2a" },
      { t: "chimenea", x: -8.75, z: -6.6, rumbo: Math.PI / 2, color: "#e9e2d4" },
      { t: "butaca", x: -7.2, z: -7.6, rumbo: -Math.PI / 2, color: "#7a3a2a" },
      { t: "butaca", x: -7.2, z: -5.6, rumbo: -Math.PI / 2, color: "#7a3a2a" },
      { t: "mesaRedonda", x: -4.8, z: -7.0, w: 1.1, d: 1.1, color: "#5a3b22" },
      { t: "silla", x: -4.8, z: -8.0, rumbo: 0, color: "#7a3a2a" },
      { t: "silla", x: -4.8, z: -6.0, rumbo: Math.PI, color: "#7a3a2a" },
    ],
  },
  {
    id: "antesala-baja",
    planta: P_B,
    nombre: "Antesala",
    rect: { x0: -2.4, x1: 2.4, z0: -6.0, z1: -1.7 },
    nodo: [0, -2.9],
    piso: "marmol",
    muro: "#e4ddcf",
    muebles: [
      { t: "busto", x: 0, z: -5.6 },
      { t: "palmera", x: -1.9, z: -5.5 },
      { t: "palmera", x: 1.9, z: -5.5 },
    ],
  },
  {
    id: "sala-vermeil",
    planta: P_B,
    nombre: "Sala Vermeil",
    rect: { x0: 2.7, x1: 9.0, z0: -12.3, z1: -1.7 },
    nodo: [5.8, -2.9],
    piso: "parquet",
    muro: "#e3cf8a",
    cortina: "#b8923f",
    zocalo: "#efe6cf",
    alfombras: [{ x0: 3.6, x1: 8.1, z0: -11.4, z1: -3.0, color: "#b89a52", borde: "#7d5a2b" }],
    muebles: [
      { t: "vitrina", x: 8.77, z: -9.6, rumbo: -Math.PI / 2, color: "#e9e2d2" },
      { t: "vitrina", x: 8.77, z: -4.4, rumbo: -Math.PI / 2, color: "#e9e2d2" },
      // Retratos de primeras damas.
      { t: "cuadro", x: 2.72, z: -4.6, rumbo: Math.PI / 2, w: 1.0, alto: 1.4, y: 0.9, tono: "#3a2c26" },
      { t: "cuadro", x: 2.72, z: -8.6, rumbo: Math.PI / 2, w: 1.0, alto: 1.4, y: 0.9, tono: "#2f3440" },
      { t: "sofa", x: 5.85, z: -11.8, rumbo: 0, color: "#c9a85a" },
      { t: "mesita", x: 5.85, z: -10.2, rumbo: 0, color: "#5a3b22" },
      { t: "butaca", x: 4.3, z: -9.9, rumbo: Math.PI / 2, color: "#c9a85a" },
      { t: "butaca", x: 7.4, z: -9.9, rumbo: -Math.PI / 2, color: "#c9a85a" },
    ],
  },
  {
    id: "oficinas-norte-baja",
    planta: P_B,
    nombre: "Oficinas",
    rect: { x0: 9.3, x1: 24.9, z0: -12.3, z1: -1.7 },
    nodo: [17.0, -2.9],
    piso: "parquet",
    muro: "#e6e0d2",
    cortina: "#8e7a5c",
    muebles: [
      { t: "escritorio", x: 13.5, z: -7.2, rumbo: 0, color: "#5a3b22" },
      { t: "silla", x: 13.5, z: -6.3, rumbo: Math.PI, color: "#3d4a5a" },
      { t: "escritorio", x: 20.5, z: -7.2, rumbo: 0, color: "#5a3b22" },
      { t: "silla", x: 20.5, z: -6.3, rumbo: Math.PI, color: "#3d4a5a" },
      { t: "estante", x: 9.53, z: -8.0, rumbo: Math.PI / 2, color: "#5a3b22" },
    ],
  },
]
const PUERTAS_BAJA: Puerta[] = [
  pu("sur", "recepcion-diplomatica", "afuera", 0, 16.7, 1.3, "x"),
  pu("oeste", "galeria-oeste", "afuera", -25.3, 4.8, 1.5, "z"),
  pu("recep-corr", "recepcion-diplomatica", "corredor-baja", 0, S_PUERTA, 1.6, "x"),
  pu("recep-mapas", "recepcion-diplomatica", "sala-mapas", -3.62, 9.4, 1.3, "z"),
  pu("recep-porc", "recepcion-diplomatica", "sala-porcelana", 3.62, 9.4, 1.3, "z"),
  pu("mapas-corr", "sala-mapas", "corredor-baja", -7.4, S_PUERTA, 1.4, "x"),
  pu("porc-corr", "sala-porcelana", "corredor-baja", 7.4, S_PUERTA, 1.4, "x"),
  pu("cons-corr", "consultorio", "corredor-baja", -15.5, S_PUERTA, 1.4, "x"),
  pu("gal-corr", "galeria-oeste", "corredor-baja", -23.15, S_PUERTA, 1.6, "x"),
  pu("ofs-corr", "oficinas-sur-baja", "corredor-baja", 17.0, S_PUERTA, 1.4, "x"),
  pu("cocina-corr", "cocina", "corredor-baja", -19.5, N_PUERTA, 1.6, "x"),
  pu("bib-corr", "biblioteca-res", "corredor-baja", -5.8, N_PUERTA, 1.4, "x"),
  pu("ante-corr", "antesala-baja", "corredor-baja", 0, N_PUERTA, 3.0, "x", true),
  pu("verm-corr", "sala-vermeil", "corredor-baja", 5.8, N_PUERTA, 1.4, "x"),
  pu("ofn-corr", "oficinas-norte-baja", "corredor-baja", 17.0, N_PUERTA, 1.4, "x"),
  ...puertasNucleo("baja", "corredor-baja"),
]
const MUROS_BAJA: Muro[] = [
  ...murosComunes(P_B, true),
  // Lado sur: Galería / Consultorio / Mapas … Porcelana / Oficinas.
  mu(P_B, -21.4, -21.1, 3.9, 12.3),
  mu(P_B, -11.3, -11.0, 3.9, 12.3),
  mu(P_B, 11.0, 11.3, 3.9, 12.3),
  // Lado norte: Biblioteca / escalinata / Vermeil / Oficinas, y la antesala bajo la escalinata.
  mu(P_B, -2.7, -2.4, -12.3, -1.7),
  mu(P_B, 2.4, 2.7, -12.3, -1.7),
  mu(P_B, 9.0, 9.3, -12.3, -1.7),
  mu(P_B, -2.4, 2.4, -6.3, -6.0),
]

// ── Residencia · Segundo piso (y 8,6): la casa de la familia ─────
// Al sur, de oeste a este: dormitorio principal, sala familiar, Sala Oval
// Amarilla (puerta al Balcón Truman), Sala de los Tratados, Dormitorio Lincoln
// y Sala Lincoln (esquina sureste). Al norte: Comedor Presidencial (noroeste),
// dormitorios de la familia y, al este, el Dormitorio y la Sala de la Reina.
const P_2: PlantaId = "res-segundo"
const SEGUNDO: Cuarto[] = [
  {
    id: "sala-central",
    planta: P_2,
    nombre: "Sala Central",
    rect: { x0: -24.9, x1: 24.9, ...CORR },
    nodo: [0, 1.1],
    piso: "parquet",
    muro: "#efe6cf",
    cortina: "#b8923f",
    zocalo: "#e7dcc4",
    paso: true,
    alfombras: [{ x0: -21.2, x1: 21.2, z0: 0.1, z1: 2.1, color: "#a8844a", borde: "#6e4a2a" }],
    muebles: [
      // Las dos salas de estar en las puntas (las ventanas oeste y este).
      { t: "sofa", x: -24.45, z: 1.1, rumbo: Math.PI / 2, color: "#c9a85a" },
      { t: "mesita", x: -23.3, z: 1.1, rumbo: Math.PI / 2, w: 0.9, d: 0.5, color: P_MADERA },
      { t: "butaca", x: -22.2, z: 0.2, rumbo: -Math.PI / 2, color: "#a8844a" },
      { t: "butaca", x: -22.2, z: 2.0, rumbo: -Math.PI / 2, color: "#a8844a" },
      { t: "sofa", x: 24.45, z: 1.1, rumbo: -Math.PI / 2, color: "#c9a85a" },
      { t: "mesita", x: 23.3, z: 1.1, rumbo: -Math.PI / 2, w: 0.9, d: 0.5, color: P_MADERA },
      { t: "butaca", x: 22.2, z: 0.2, rumbo: Math.PI / 2, color: "#a8844a" },
      { t: "butaca", x: 22.2, z: 2.0, rumbo: Math.PI / 2, color: "#a8844a" },
      { t: "estante", x: -7.4, z: -1.19, rumbo: 0, w: 1.6, color: P_MADERA },
      { t: "estante", x: 7.4, z: -1.19, rumbo: 0, w: 1.6, color: P_MADERA },
    ],
  },
  {
    id: "comedor-presidencial",
    planta: P_2,
    nombre: "Comedor Presidencial",
    rect: { x0: -24.9, x1: -14.3, z0: -12.3, z1: -1.7 },
    nodo: [-19.5, -2.9],
    piso: "parquet",
    muro: "#c9b98c",
    cortina: "#6e5a2e",
    zocalo: "#ece4d2",
    alfombras: [{ x0: -22.8, x1: -16.4, z0: -9.4, z1: -4.6, color: "#7a5a3a", borde: "#c9a95a" }],
    muebles: [
      { t: "mesaComedor", x: -19.6, z: -7.0, rumbo: Math.PI / 2, w: 1.2, d: 3.4, color: "#4a2c18" },
      { t: "aparador", x: -24.6, z: -7.0, rumbo: Math.PI / 2, w: 2.0, color: "#4a2c18" },
      { t: "chimenea", x: -14.55, z: -7.0, rumbo: -Math.PI / 2, color: "#efe9df" },
    ],
  },
  ...nucleo(P_2, "segundo"),
  dormitorio("dormitorio-familia-o", P_2, "Dormitorio de la familia", -9.0, -0.15, true, "#dfe6ec", "#7d93a8"),
  dormitorio("dormitorio-familia-e", P_2, "Dormitorio de la familia", 0.15, 9.0, true, "#ece0d2", "#a87d6a"),
  {
    id: "escalera-este-2",
    planta: P_2,
    nombre: "Gran Escalera",
    rect: { x0: 9.3, x1: 13.9, z0: -12.3, z1: -1.7 },
    nodo: [12.6, -2.55],
    piso: "marmol",
    muro: "#ddd7cb",
    paso: true,
    muebles: [{ t: "consola", x: 11.6, z: -12.07, rumbo: 0, color: "#d8b45a" }],
  },
  dormitorio("dormitorio-reina", P_2, "Dormitorio de la Reina", 14.2, 17.9, true, "#e7c9c9", "#b5606a"),
  {
    id: "sala-reina",
    planta: P_2,
    nombre: "Sala de la Reina",
    rect: { x0: 18.2, x1: 24.9, z0: -12.3, z1: -1.7 },
    nodo: [21.5, -2.9],
    piso: "parquet",
    muro: "#e7c9c9",
    cortina: "#b5606a",
    zocalo: "#ece4d2",
    alfombras: [{ x0: 19.4, x1: 23.7, z0: -11.2, z1: -7.6, color: "#a8606a", borde: "#e3c9a0" }],
    muebles: [
      { t: "sofa", x: 21.55, z: -11.85, rumbo: 0, color: "#b5606a" },
      { t: "mesita", x: 21.55, z: -10.0, rumbo: 0, w: 0.9, d: 0.5, color: P_MADERA },
      { t: "butaca", x: 20.1, z: -9.5, rumbo: Math.PI / 2, color: "#e3c9a0" },
      { t: "butaca", x: 23.0, z: -9.5, rumbo: -Math.PI / 2, color: "#e3c9a0" },
      { t: "escritorio", x: 24.4, z: -5.0, rumbo: -Math.PI / 2, w: 1.3, d: 0.6, color: P_MADERA },
    ],
  },
  dormitorio("dormitorio-principal", P_2, "Dormitorio principal", -24.9, -14.3, false, "#e9e2d2", "#5b6f8c", {
    muebles: [
      { t: "cama", x: -23.8, z: 7.2, rumbo: Math.PI / 2, color: "#5b6f8c" },
      { t: "mesita", x: -24.55, z: 5.85, rumbo: Math.PI / 2, w: 0.5, d: 0.45, color: P_MADERA },
      { t: "mesita", x: -24.55, z: 8.55, rumbo: Math.PI / 2, w: 0.5, d: 0.45, color: P_MADERA },
      { t: "sofa", x: -16.6, z: 11.85, rumbo: Math.PI, color: "#c9b48a" },
      { t: "butaca", x: -18.3, z: 9.7, rumbo: Math.PI / 2, color: "#5b6f8c" },
      { t: "aparador", x: -14.63, z: 8.0, rumbo: -Math.PI / 2, w: 1.8, color: P_MADERA },
    ],
    alfombras: [{ x0: -23.6, x1: -17.0, z0: 5.0, z1: 10.4, color: "#4d5e78", borde: "#c9b07a" }],
  }),
  {
    id: "sala-familiar",
    planta: P_2,
    nombre: "Sala de estar de la familia",
    rect: { x0: -14.0, x1: -3.9, z0: 3.9, z1: 12.3 },
    nodo: [-9.0, 5.2],
    piso: "parquet",
    muro: "#e6dcc6",
    cortina: "#8a6a3e",
    zocalo: "#ece4d2",
    alfombras: [{ x0: -12.2, x1: -5.6, z0: 7.4, z1: 11.6, color: "#8e7a5c", borde: "#c9b07a" }],
    muebles: [
      { t: "sofa", x: -9.0, z: 11.85, rumbo: Math.PI, color: "#8a6a3e" },
      { t: "mesita", x: -9.0, z: 10.0, rumbo: 0, w: 1.0, d: 0.55, color: P_MADERA },
      { t: "butaca", x: -10.9, z: 9.7, rumbo: Math.PI / 2, color: "#c9a85a" },
      { t: "butaca", x: -7.1, z: 9.7, rumbo: -Math.PI / 2, color: "#c9a85a" },
      { t: "estante", x: -13.77, z: 8.4, rumbo: Math.PI / 2, color: P_MADERA },
      { t: "escritorio", x: -12.6, z: 5.0, rumbo: Math.PI, w: 1.4, d: 0.7, color: P_MADERA },
    ],
  },
  {
    id: "sala-oval-amarilla",
    planta: P_2,
    nombre: "Sala Oval Amarilla",
    lugarId: "sala-oval-amarilla",
    ...ovalo,
    nodo: [0, 8.4],
    piso: "parquet",
    muro: "#e3c24e",
    cortina: "#c99a2e",
    zocalo: "#efe6cf",
    alfombras: [{ x0: -2.9, x1: 2.9, z0: 4.6, z1: 15.7, color: "#c9a24a", borde: "#7d5a2b", oval: true }],
    muebles: [
      { t: "sofa", x: -2.68, z: 12.3, rumbo: Math.PI / 2, w: 1.6, color: "#e8d9a6" },
      { t: "sofa", x: 2.68, z: 12.3, rumbo: -Math.PI / 2, w: 1.6, color: "#e8d9a6" },
      { t: "butaca", x: -1.75, z: 14.7, rumbo: Math.PI * 0.85, color: "#c99a2e" },
      { t: "butaca", x: 1.75, z: 14.7, rumbo: -Math.PI * 0.85, color: "#c99a2e" },
      { t: "consola", x: -3.05, z: 6.4, rumbo: Math.PI / 2, w: 0.9, color: "#d8b45a" },
      { t: "consola", x: 3.05, z: 6.4, rumbo: -Math.PI / 2, w: 0.9, color: "#d8b45a" },
    ],
  },
  {
    // El Balcón Truman, bajo el Pórtico Sur: es de esta planta (se sale por la ventana francesa del óvalo).
    id: "balcon-truman",
    planta: P_2,
    nombre: "Balcón Truman",
    lugarId: "balcon-truman",
    rect: { x0: -3.6, x1: 3.6, z0: 16.9, z1: 21.0 },
    nodo: [0, 18.4],
    piso: "piedra",
    muro: "#f4f1ea",
    exterior: true,
    muebles: [
      { t: "butaca", x: -2.1, z: 18.3, rumbo: 0.2, color: "#e9e2d2" },
      { t: "butaca", x: 2.1, z: 18.3, rumbo: -0.2, color: "#e9e2d2" },
    ],
  },
  {
    id: "sala-tratados",
    planta: P_2,
    nombre: "Sala de los Tratados",
    rect: { x0: 3.9, x1: 11.5, z0: 3.9, z1: 12.3 },
    nodo: [6.4, 5.0],
    piso: "parquet",
    muro: "#5f6f52",
    cortina: "#7a2a2a",
    zocalo: "#e9e3d3",
    alfombras: [{ x0: 5.0, x1: 10.4, z0: 6.4, z1: 10.6, color: "#6e3a2a", borde: "#c9a95a" }],
    muebles: [
      { t: "mesaComedor", x: 7.6, z: 8.5, rumbo: Math.PI / 2, w: 1.4, d: 3.2, color: "#3d2716" },
      { t: "chimenea", x: 11.25, z: 8.5, rumbo: -Math.PI / 2, color: "#efe9df" },
      { t: "cuadro", x: 11.46, z: 8.5, rumbo: -Math.PI / 2, w: 0.9, alto: 1.1, y: 1.45, tono: "#2c2620" },
    ],
  },
  {
    id: "dormitorio-lincoln",
    planta: P_2,
    nombre: "Dormitorio Lincoln",
    lugarId: "dormitorio-lincoln",
    rect: { x0: 11.8, x1: 17.9, z0: 3.9, z1: 12.3 },
    nodo: [14.85, 5.0],
    piso: "parquet",
    muro: "#5d6e57",
    cortina: "#7a2a2a",
    zocalo: "#e9e3d3",
    alfombras: [{ x0: 12.6, x1: 17.1, z0: 5.6, z1: 11.6, color: "#7a2a2a", borde: "#c9a95a" }],
    muebles: [
      // La cama de palisandro de 2,6 m con la cabecera alta.
      { t: "cama", x: 14.3, z: 11.0, rumbo: Math.PI, d: 2.6, alto: 2.3, color: "#e9dfc6" },
      { t: "chimenea", x: 12.05, z: 7.4, rumbo: Math.PI / 2, color: "#efe9df" },
      { t: "butaca", x: 13.5, z: 6.4, rumbo: -Math.PI / 2, color: "#7a2a2a" },
      { t: "butaca", x: 13.5, z: 8.4, rumbo: -Math.PI / 2, color: "#7a2a2a" },
      { t: "mesaRedonda", x: 16.0, z: 8.0, w: 0.9, d: 0.9, color: "#3d2716" },
      // El escritorio con la copia manuscrita del Discurso de Gettysburg.
      { t: "escritorio", x: 17.55, z: 5.5, rumbo: -Math.PI / 2, w: 1.2, d: 0.6, color: "#3d2716" },
      { t: "silla", x: 16.85, z: 5.5, rumbo: Math.PI / 2, color: "#7a2a2a" },
    ],
  },
  {
    id: "sala-lincoln",
    planta: P_2,
    nombre: "Sala Lincoln",
    rect: { x0: 18.2, x1: 24.9, z0: 3.9, z1: 12.3 },
    nodo: [21.5, 5.2],
    piso: "parquet",
    muro: "#b9a27a",
    cortina: "#7a2a2a",
    zocalo: "#e9e3d3",
    alfombras: [{ x0: 19.4, x1: 23.7, z0: 7.4, z1: 11.4, color: "#7a2a2a", borde: "#c9a95a" }],
    muebles: [
      { t: "sofa", x: 21.55, z: 11.85, rumbo: Math.PI, color: "#7a2a2a" },
      { t: "mesita", x: 21.55, z: 10.0, rumbo: 0, w: 0.9, d: 0.5, color: P_MADERA },
      { t: "butaca", x: 20.0, z: 9.7, rumbo: Math.PI / 2, color: "#b9a27a" },
      { t: "butaca", x: 23.1, z: 9.7, rumbo: -Math.PI / 2, color: "#b9a27a" },
    ],
  },
]
const PUERTAS_SEGUNDO: Puerta[] = [
  pu("balcon", "sala-oval-amarilla", "balcon-truman", 0, 16.7, 1.3, "x"),
  pu("oval-central", "sala-oval-amarilla", "sala-central", 0, S_PUERTA, 1.6, "x"),
  pu("oval-familiar", "sala-oval-amarilla", "sala-familiar", -3.62, 9.4, 1.3, "z"),
  pu("oval-tratados", "sala-oval-amarilla", "sala-tratados", 3.62, 9.4, 1.3, "z"),
  pu("principal-central", "dormitorio-principal", "sala-central", -19.5, S_PUERTA, 1.4, "x"),
  pu("familiar-central", "sala-familiar", "sala-central", -9.0, S_PUERTA, 1.4, "x"),
  pu("tratados-central", "sala-tratados", "sala-central", 6.4, S_PUERTA, 1.4, "x"),
  pu("lincoln-central", "dormitorio-lincoln", "sala-central", 14.85, S_PUERTA, 1.4, "x"),
  pu("lincoln-sala", "dormitorio-lincoln", "sala-lincoln", 18.05, 9.0, 1.0, "z"),
  pu("salalincoln-central", "sala-lincoln", "sala-central", 21.5, S_PUERTA, 1.4, "x"),
  pu("comedorp-central", "comedor-presidencial", "sala-central", -19.5, N_PUERTA, 1.4, "x"),
  pu("famo-central", "dormitorio-familia-o", "sala-central", -4.575, N_PUERTA, 1.2, "x"),
  pu("fame-central", "dormitorio-familia-e", "sala-central", 4.575, N_PUERTA, 1.2, "x"),
  pu("escalera-central", "escalera-este-2", "sala-central", 11.6, N_PUERTA, 4.2, "x", true),
  pu("reina-central", "dormitorio-reina", "sala-central", 16.05, N_PUERTA, 1.2, "x"),
  pu("reina-sala", "dormitorio-reina", "sala-reina", 18.05, -6.0, 1.0, "z"),
  pu("salareina-central", "sala-reina", "sala-central", 21.5, N_PUERTA, 1.4, "x"),
  ...puertasNucleo("segundo", "sala-central"),
]
const MUROS_SEGUNDO: Muro[] = [
  ...murosComunes(P_2, true),
  mu(P_2, -14.3, -14.0, 3.9, 12.3),
  mu(P_2, 11.5, 11.8, 3.9, 12.3),
  mu(P_2, 17.9, 18.2, 3.9, 12.3),
  mu(P_2, -0.15, 0.15, -12.3, -1.7),
  mu(P_2, 9.0, 9.3, -12.3, -1.7),
  mu(P_2, 13.9, 14.2, -12.3, -1.7),
  mu(P_2, 17.9, 18.2, -12.3, -1.7),
]

// ── Residencia · Tercer piso (y 13,9): huéspedes, el Solario y el gimnasio ──
const P_3: PlantaId = "res-tercero"
const TERCERO: Cuarto[] = [
  {
    id: "pasillo-3",
    planta: P_3,
    nombre: "Pasillo del tercer piso",
    rect: { x0: -24.9, x1: 24.9, ...CORR },
    nodo: [0, 1.1],
    piso: "parquet",
    muro: "#efe9dc",
    zocalo: "#e7dcc4",
    paso: true,
    alfombras: [{ x0: -24.0, x1: 24.0, z0: 0.3, z1: 1.9, color: "#5b6f8c", borde: "#c9b07a" }],
    muebles: [
      { t: "banco", x: -23.6, z: 3.33, rumbo: Math.PI, color: "#5b6f8c" },
      { t: "banco", x: 23.6, z: 3.33, rumbo: Math.PI, color: "#5b6f8c" },
      { t: "cuadro", x: -2.6, z: -1.37, rumbo: 0, w: 0.8, alto: 1.0, y: 1.1, tono: "#3a4a3a" },
      { t: "cuadro", x: 2.6, z: -1.37, rumbo: 0, w: 0.8, alto: 1.0, y: 1.1, tono: "#4a3a2a" },
    ],
  },
  dormitorio("huespedes-1", P_3, "Habitación de huéspedes", -24.9, -14.3, true, "#e6ddcb", "#7d93a8"),
  ...nucleo(P_3, "tercero"),
  dormitorio("huespedes-2", P_3, "Habitación de huéspedes", -9.0, -0.15, true, "#dfe6ec", "#8a6a3e"),
  dormitorio("huespedes-3", P_3, "Habitación de huéspedes", 0.15, 9.0, true, "#ece0d2", "#5b6f8c"),
  dormitorio("huespedes-4", P_3, "Habitación de huéspedes", 9.3, 17.0, true, "#e6ddcb", "#a87d6a"),
  dormitorio("huespedes-5", P_3, "Habitación de huéspedes", 17.3, 24.9, true, "#dfe6ec", "#6e7f4a"),
  {
    id: "sala-juegos",
    planta: P_3,
    nombre: "Sala de juegos",
    rect: { x0: -24.9, x1: -14.3, z0: 3.9, z1: 12.3 },
    nodo: [-19.5, 5.2],
    piso: "parquet",
    muro: "#d9cfb8",
    zocalo: "#7a5a3a",
    muebles: [
      { t: "billar", x: -19.6, z: 8.6, rumbo: Math.PI / 2 },
      { t: "sofa", x: -24.45, z: 8.6, rumbo: Math.PI / 2, color: "#7a3a2a" },
      { t: "estante", x: -19.6, z: 12.07, rumbo: Math.PI, color: P_MADERA },
    ],
  },
  {
    id: "sala-musica",
    planta: P_3,
    nombre: "Sala de música",
    rect: { x0: -14.0, x1: -6.3, z0: 3.9, z1: 12.3 },
    nodo: [-10.2, 5.2],
    piso: "parquet",
    muro: "#e2d8c2",
    zocalo: "#ece4d2",
    alfombras: [{ x0: -13.0, x1: -7.3, z0: 6.8, z1: 11.4, color: "#6e3a2a", borde: "#c9a95a" }],
    muebles: [
      { t: "piano", x: -10.2, z: 9.6, rumbo: Math.PI, color: "#15120f" },
      { t: "butaca", x: -13.2, z: 7.4, rumbo: Math.PI / 2, color: "#8a5a3a" },
      { t: "butaca", x: -7.2, z: 7.4, rumbo: -Math.PI / 2, color: "#8a5a3a" },
    ],
  },
  {
    id: "solario",
    planta: P_3,
    nombre: "Solario",
    lugarId: "solario",
    rect: { x0: -6.0, x1: 6.0, z0: 3.9, z1: 12.3 },
    nodo: [0, 5.2],
    piso: "liso",
    muro: "#eef3ef",
    alfombras: [{ x0: -4.2, x1: 4.2, z0: 7.0, z1: 11.4, color: "#9aa77a", borde: "#e8e2c8" }],
    muebles: [
      { t: "sofa", x: 0, z: 11.85, rumbo: Math.PI, w: 2.4, color: "#d9c79a" },
      { t: "mesita", x: 0, z: 10.0, rumbo: 0, w: 1.0, d: 0.55, color: "#c9b48a" },
      { t: "butaca", x: -2.2, z: 9.4, rumbo: Math.PI / 2, color: "#d9c79a" },
      { t: "butaca", x: 2.2, z: 9.4, rumbo: -Math.PI / 2, color: "#d9c79a" },
      { t: "palmera", x: -5.4, z: 11.7 },
      { t: "palmera", x: 5.4, z: 11.7 },
      { t: "palmera", x: -5.4, z: 4.6 },
      { t: "palmera", x: 5.4, z: 4.6 },
      { t: "mesaRedonda", x: -3.6, z: 6.6, w: 0.9, d: 0.9, color: "#e8e2c8" },
      { t: "silla", x: -4.55, z: 6.6, rumbo: Math.PI / 2, color: "#c9b48a" },
      { t: "silla", x: -2.65, z: 6.6, rumbo: -Math.PI / 2, color: "#c9b48a" },
    ],
  },
  {
    // El arco del pórtico sigue hasta la cornisa: en el Tercer piso es el mirador del Solario.
    id: "mirador-solario",
    planta: P_3,
    nombre: "Mirador del Solario",
    rect: { x0: -OVALO_AZUL.r, x1: OVALO_AZUL.r, z0: 12.3, z1: OVALO_AZUL.sur + OVALO_AZUL.r },
    ovalo: { norte: 12.3, sur: OVALO_AZUL.sur },
    nodo: [0, 13.4],
    piso: "liso",
    muro: "#eef3ef",
    muebles: [
      { t: "palmera", x: -2.2, z: 14.6 },
      { t: "palmera", x: 2.2, z: 14.6 },
      { t: "butaca", x: 0, z: 14.9, rumbo: 0, color: "#d9c79a" },
    ],
  },
  dormitorio("huespedes-6", P_3, "Habitación de huéspedes", 6.3, 14.0, false, "#ece0d2", "#7d93a8"),
  {
    id: "gimnasio-res",
    planta: P_3,
    nombre: "Gimnasio",
    rect: { x0: 14.3, x1: 24.9, z0: 3.9, z1: 12.3 },
    nodo: [19.5, 5.2],
    piso: "liso",
    muro: "#e2e6e8",
    muebles: [
      { t: "cinta", x: 16.2, z: 10.9, rumbo: Math.PI },
      { t: "cinta", x: 17.6, z: 10.9, rumbo: Math.PI },
      { t: "banco", x: 21.8, z: 8.6, rumbo: Math.PI / 2, color: "#2a2c2e" },
      { t: "estante", x: 24.67, z: 8.0, rumbo: -Math.PI / 2, w: 1.6, color: "#3a3d40" },
    ],
  },
]
const PUERTAS_TERCERO: Puerta[] = [
  pu("h1-pasillo", "huespedes-1", "pasillo-3", -19.6, N_PUERTA, 1.2, "x"),
  pu("h2-pasillo", "huespedes-2", "pasillo-3", -4.575, N_PUERTA, 1.2, "x"),
  pu("h3-pasillo", "huespedes-3", "pasillo-3", 4.575, N_PUERTA, 1.2, "x"),
  pu("h4-pasillo", "huespedes-4", "pasillo-3", 13.15, N_PUERTA, 1.2, "x"),
  pu("h5-pasillo", "huespedes-5", "pasillo-3", 21.1, N_PUERTA, 1.2, "x"),
  pu("juegos-pasillo", "sala-juegos", "pasillo-3", -19.5, S_PUERTA, 1.4, "x"),
  pu("musica-pasillo", "sala-musica", "pasillo-3", -10.2, S_PUERTA, 1.4, "x"),
  pu("solario-pasillo", "solario", "pasillo-3", 0, S_PUERTA, 2.4, "x"),
  pu("h6-pasillo", "huespedes-6", "pasillo-3", 10.15, S_PUERTA, 1.2, "x"),
  pu("solario-mirador", "solario", "mirador-solario", 0, 12.3, 6.7, "x", true),
  pu("gim-pasillo", "gimnasio-res", "pasillo-3", 19.5, S_PUERTA, 1.4, "x"),
  ...puertasNucleo("tercero", "pasillo-3"),
]
const MUROS_TERCERO: Muro[] = [
  ...murosComunes(P_3, false),
  mu(P_3, -14.3, -14.0, 3.9, 12.3),
  mu(P_3, -6.3, -6.0, 3.9, 12.3),
  mu(P_3, 6.0, 6.3, 3.9, 12.3),
  mu(P_3, 14.0, 14.3, 3.9, 12.3),
  mu(P_3, -0.15, 0.15, -12.3, -1.7),
  mu(P_3, 9.0, 9.3, -12.3, -1.7),
  mu(P_3, 17.0, 17.3, -12.3, -1.7),
]

export const CUARTOS: Cuarto[] = [...BAJA, ...ESTADO, ...SEGUNDO, ...TERCERO]
export const CUARTO: Record<string, Cuarto> = Object.fromEntries(CUARTOS.map((c) => [c.id, c]))
export const PUERTAS: Puerta[] = [...PUERTAS_BAJA, ...PUERTAS_ESTADO, ...PUERTAS_SEGUNDO, ...PUERTAS_TERCERO]
export const MUROS: Muro[] = [...MUROS_BAJA, ...MUROS_ESTADO, ...MUROS_SEGUNDO, ...MUROS_TERCERO]

// ── Escaleras entre plantas ─────────────────────────────────────
/**
 * Una escalera en U: el primer tramo sube desde `zA` (en la franja `sube`)
 * hasta el descanso, a media altura, y el segundo vuelve a `zA` (en la franja
 * `llega`) en la planta de arriba. Las de cada planta se apilan en la misma caja.
 */
export interface Escalera {
  id: string
  nombre: string
  abajo: string
  arriba: string
  sube: [number, number]
  llega: [number, number]
  /** Donde arranca el primer tramo y termina el segundo. */
  zA: number
  /** Hacia dónde suben los tramos desde zA (−1 = al norte). */
  dir: 1 | -1
  huella: number
  /** El borde lejano del descanso. */
  zFin: number
}
export const ESCALERAS: Escalera[] = [
  { id: "oeste-1", nombre: "Escalera oeste", abajo: "nucleo-baja", arriba: "nucleo-oeste", sube: [-12.75, -11.65], llega: [-13.9, -12.8], zA: -7.2, dir: -1, huella: 0.28, zFin: -12.25 },
  { id: "oeste-2", nombre: "Escalera oeste", abajo: "nucleo-oeste", arriba: "nucleo-segundo", sube: [-12.75, -11.65], llega: [-13.9, -12.8], zA: -7.2, dir: -1, huella: 0.28, zFin: -12.25 },
  { id: "oeste-3", nombre: "Escalera oeste", abajo: "nucleo-segundo", arriba: "nucleo-tercero", sube: [-12.75, -11.65], llega: [-13.9, -12.8], zA: -7.2, dir: -1, huella: 0.28, zFin: -12.25 },
  { id: "gran", nombre: "Gran Escalera", abajo: "gran-escalera", arriba: "escalera-este-2", sube: [11.7, 13.7], llega: [9.5, 11.5], zA: -3.4, dir: -1, huella: 0.3, zFin: -10.0 },
]

/** Las medidas que salen de una escalera: alturas, escalones por tramo y dónde termina el tramo. */
export function medidasEscalera(e: Escalera) {
  const y0 = PLANTA[CUARTO[e.abajo].planta].y
  const y1 = PLANTA[CUARTO[e.arriba].planta].y
  const n = Math.max(2, Math.round((y1 - y0) / 2 / 0.175))
  const zB = e.zA + e.dir * n * e.huella
  return { y0, y1, ym: (y0 + y1) / 2, n, zB }
}

/** El hueco en el piso de un cuarto por donde llega la escalera de abajo (y, en la última planta, la caja entera). */
export function pozosDe(c: Cuarto): Rect[] {
  const out: Rect[] = []
  for (const e of ESCALERAS) {
    if (e.arriba !== c.id) continue
    const sale = ESCALERAS.some((o) => o.abajo === c.id)
    const za = Math.min(e.zA, e.zFin)
    const zb = Math.max(e.zA, e.zFin)
    const x0 = sale ? e.llega[0] : Math.min(e.sube[0], e.llega[0])
    const x1 = sale ? e.llega[1] : Math.max(e.sube[1], e.llega[1])
    out.push({ x0, x1, z0: za, z1: zb })
  }
  return out
}

/** Los tres salones ovales (Recepción Diplomática, Azul y Oval Amarilla) están uno encima del otro. */
export const MACIZOS: Macizo[] = (["res-baja", "res-estado", "res-segundo"] as PlantaId[]).flatMap((planta) => [
  { planta, pts: rinconOvalo(1) },
  { planta, pts: rinconOvalo(-1) },
])

/**
 * Uniones con el afuera, todas a la vista: la puerta norte (escalinata), la
 * del Pórtico Sur (Recepción Diplomática) y la de la Columnata Oeste. El
 * Balcón Truman es un cuarto del Segundo piso (`exterior`).
 */
export const ENLACES: Array<{ nodo: string; cuarto: string; oculto?: boolean; texto: string }> = [
  { nodo: "puerta-res-norte", cuarto: "escalinata", texto: "Entra por la puerta norte de la Residencia" },
  { nodo: "puerta-res-sur", cuarto: "recepcion-diplomatica", texto: "Entra por el Pórtico Sur, a la Recepción Diplomática" },
  { nodo: "col-e", cuarto: "galeria-oeste", texto: "Entra desde la Columnata Oeste" },
]

/** Ventanas de la fachada que dan a una planta: (x, z) del centro sobre la cara interior, ancho y alto del alféizar sobre el piso. */
export interface Ventana {
  x: number
  z: number
  ancho: number
  /** "x": está en un muro norte o sur. */
  eje: "x" | "z"
  alfeizar: number
}
const EJES_LADO = [0, 1, 2, 3].map((i) => 10.5 + ((25.6 - 10.5) * (i + 0.5)) / 4)
export const VENTANAS: Partial<Record<PlantaId, Ventana[]>> = {
  "res-estado": [
    // Norte: once ejes (el del centro es la puerta, en la escalinata).
    ...[...EJES_LADO, 7].flatMap((e) => [-e, e]).map((x): Ventana => ({ x, z: -12.3, ancho: 1.6, eje: "x", alfeizar: 0 })),
    // Sur: cuatro ejes a cada lado del óvalo.
    ...EJES_LADO.flatMap((e) => [-e, e]).map((x): Ventana => ({ x, z: 12.3, ancho: 1.6, eje: "x", alfeizar: 0.85 })),
    // Este y oeste: cinco ejes.
    ...[-9.6, -4.8, 0, 4.8, 9.6].flatMap((z) => [24.9, -24.9].map((x): Ventana => ({ x, z, ancho: z === 0 ? 1.8 : 1.6, eje: "z", alfeizar: 0.85 }))),
  ],
  // Planta Baja: al norte las ventanas arrancan a 1,85 m (el jardín norte está más alto en la real); la puerta oeste da a la Columnata.
  "res-baja": [
    ...[...EJES_LADO, 7].flatMap((e) => [-e, e]).map((x): Ventana => ({ x, z: -12.3, ancho: 1.6, eje: "x", alfeizar: 1.85 })),
    ...EJES_LADO.flatMap((e) => [-e, e]).map((x): Ventana => ({ x, z: 12.3, ancho: 1.4, eje: "x", alfeizar: 0.9 })),
    ...[-9.6, -4.8, 0, 4.8, 9.6].flatMap((z) =>
      [24.9, -24.9].map((x): Ventana => (x < 0 && z === 4.8 ? { x, z, ancho: 1.5, eje: "z", alfeizar: 0 } : { x, z, ancho: 1.4, eje: "z", alfeizar: 0.9 })),
    ),
  ],
  // Segundo piso: la del centro del norte cae en el muro entre los dos dormitorios de la familia.
  "res-segundo": [
    ...[...EJES_LADO, 7].flatMap((e) => [-e, e]).map((x): Ventana => ({ x, z: -12.3, ancho: 1.5, eje: "x", alfeizar: 1.0 })),
    ...EJES_LADO.flatMap((e) => [-e, e]).map((x): Ventana => ({ x, z: 12.3, ancho: 1.5, eje: "x", alfeizar: 1.0 })),
    ...[-9.6, -4.8, 0, 4.8, 9.6].flatMap((z) => [24.9, -24.9].map((x): Ventana => ({ x, z, ancho: 1.5, eje: "z", alfeizar: 1.0 }))),
  ],
  // El tercer piso queda detrás de la balaustrada: no tiene ventanas en la fachada. El único hueco
  // es el del arco, abierto al mirador del Solario.
  "res-tercero": [{ x: 0, z: 12.3, ancho: 6.76, eje: "x", alfeizar: 0 }],
}

// ── Consultas ────────────────────────────────────────────────

export const cuartosDe = (p: PlantaId) => CUARTOS.filter((c) => c.planta === p)

/** ¿(x, z) está dentro del cuarto (con `margen` hacia adentro)? Respeta el óvalo. */
export function dentroDeCuarto(c: Cuarto, x: number, z: number, margen = 0): boolean {
  const r = c.rect
  if (x < r.x0 + margen || x > r.x1 - margen || z < r.z0 + margen || z > r.z1 - margen) return false
  if (c.ovalo) {
    const rad = (r.x1 - r.x0) / 2
    const cx = (r.x0 + r.x1) / 2
    const zc = z < c.ovalo.norte ? c.ovalo.norte : z > c.ovalo.sur ? c.ovalo.sur : null
    if (zc !== null && Math.hypot(x - cx, z - zc) > rad - margen) return false
  }
  if (c.hueco && x > c.hueco.x0 && x < c.hueco.x1 && z > c.hueco.z0 && z < c.hueco.z1) {
    // El hueco de la escalinata es de su propio cuarto.
    return false
  }
  return true
}

/** El rectángulo de una puerta (el ancho a lo largo del muro, 0,8 m de profundidad). */
export function rectPuerta(p: Puerta): Rect {
  const h = p.ancho / 2
  return p.eje === "x" ? { x0: p.x - h, x1: p.x + h, z0: p.z - 0.45, z1: p.z + 0.45 } : { x0: p.x - 0.45, x1: p.x + 0.45, z0: p.z - h, z1: p.z + h }
}

/** ¿Se puede estar parado en (x, z) en esa planta? (dentro de un cuarto o en el vano de una puerta) */
export function transitable(planta: PlantaId, x: number, z: number): boolean {
  for (const c of CUARTOS) if (c.planta === planta && dentroDeCuarto(c, x, z)) return true
  for (const p of PUERTAS) {
    if (CUARTO[p.a]?.planta !== planta) continue
    const r = rectPuerta(p)
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true
  }
  return false
}

/** El cuarto de una planta que contiene (x, z), o null. */
export function cuartoEn(planta: PlantaId, x: number, z: number): Cuarto | null {
  for (const c of CUARTOS) if (c.planta === planta && dentroDeCuarto(c, x, z)) return c
  return null
}

/** El rectángulo que ocupa un mueble en planta (girado de a 90°). */
export function huellaMueble(m: Mueble): Rect {
  const [w0, d0] = MEDIDA[m.t]
  const w = m.w ?? w0
  const d = m.d ?? d0
  const giro = Math.abs(Math.sin(m.rumbo ?? 0)) > 0.7
  const hx = (giro ? d : w) / 2
  const hz = (giro ? w : d) / 2
  return { x0: m.x - hx, x1: m.x + hx, z0: m.z - hz, z1: m.z + hz }
}

/** Lo que no se atraviesa en un cuarto: la huella de cada mueble sólido, más su margen (las sillas de una mesa). */
export function obstaculosDe(c: Cuarto): Rect[] {
  const out: Rect[] = []
  for (const m of c.muebles ?? []) {
    const extra = SOLIDO[m.t]
    if (extra === undefined) continue
    const h = huellaMueble(m)
    out.push({ x0: h.x0 - extra, x1: h.x1 + extra, z0: h.z0 - extra, z1: h.z1 + extra })
  }
  return out
}

/** Dónde se sienta la gente: sillas y butacas, dos lugares por sofá, y las sillas de cada mesa de comedor. */
export function asientosDe(c: Cuarto): Asiento[] {
  const out: Asiento[] = []
  for (const m of c.muebles ?? []) {
    const r = m.rumbo ?? 0
    if (m.t === "silla" || m.t === "butaca") out.push({ x: m.x, z: m.z, rumbo: r })
    else if (m.t === "sofa") {
      const ux = Math.cos(r)
      const uz = -Math.sin(r)
      for (const s of [-0.5, 0.5]) out.push({ x: m.x + ux * s, z: m.z + uz * s, rumbo: r })
    } else if (m.t === "mesaComedor") out.push(...sillasDeMesa(m))
  }
  return out
}

/** Las sillas de una mesa de comedor: a los dos lados largos cada 0,8 m y una en cada cabecera. */
export function sillasDeMesa(m: Mueble): Asiento[] {
  const [w0, d0] = MEDIDA.mesaComedor
  const w = m.w ?? w0
  const d = m.d ?? d0
  const giro = Math.abs(Math.sin(m.rumbo ?? 0)) > 0.7
  const n = Math.max(1, Math.floor((d - 0.4) / 0.8))
  const out: Asiento[] = []
  const lado = w / 2 + 0.42
  for (let i = 0; i < n; i++) {
    const t = (i - (n - 1) / 2) * 0.8
    for (const s of [-1, 1]) {
      // A lo largo del eje largo de la mesa (z si no está girada).
      const x = giro ? m.x + t : m.x + s * lado
      const z = giro ? m.z + s * lado : m.z + t
      const rumbo = giro ? (s < 0 ? 0 : Math.PI) : s < 0 ? Math.PI / 2 : -Math.PI / 2
      out.push({ x, z, rumbo })
    }
  }
  for (const s of [-1, 1]) {
    const cab = d / 2 + 0.42
    const x = giro ? m.x + s * cab : m.x
    const z = giro ? m.z : m.z + s * cab
    const rumbo = giro ? (s < 0 ? Math.PI / 2 : -Math.PI / 2) : s < 0 ? 0 : Math.PI
    out.push({ x, z, rumbo })
  }
  return out
}

/** Las zonas donde se para la gente: el cuarto sin el borde (0,7 m de los muros). */
export function zonasDe(c: Cuarto): Rect[] {
  const m = 0.7
  const r = c.rect
  if (c.ovalo) {
    const rad = (r.x1 - r.x0) / 2
    const cx = (r.x0 + r.x1) / 2
    const a = rad * 0.72
    return [{ x0: cx - a, x1: cx + a, z0: c.ovalo.norte - a, z1: c.ovalo.sur + a }]
  }
  return [{ x0: r.x0 + m, x1: r.x1 - m, z0: r.z0 + m, z1: r.z1 - m }]
}

/**
 * "Habitaciones" (donde duermen los residentes): los dormitorios de huéspedes
 * del Tercer piso. Se llega a la vista hasta la puerta de uno; adentro, con la
 * puerta cerrada, no se ve a nadie (el lugar no tiene planta propia).
 */
export const HABITACIONES = { planta: "res-tercero" as PlantaId, rect: { x0: -9.0, x1: 24.9, z0: -12.3, z1: -1.7 }, puerta: "h3-pasillo" }

/** La planta de entrada de un lugar de edificio (la sala misma o, para "habitaciones", la Planta de Estado). */
export function plantaDeLugar(lugarId: string): PlantaId | null {
  const c = CUARTOS.find((x) => x.lugarId === lugarId && PLANTA[x.planta].lista)
  if (c) return c.planta
  if (lugarId === "habitaciones") return "res-estado"
  return null
}

/** El cuarto que es un lugar (si su planta ya existe). */
export const cuartoDeLugar = (lugarId: string): Cuarto | null => CUARTOS.find((c) => c.lugarId === lugarId && PLANTA[c.planta].lista) ?? null

// ── Vista de la cámara dentro de una planta ──────────────────

/** Dónde corta (parámetro 0..1) el segmento a→b el segmento p→q en planta, o null. */
function cruceSegmentos(ax: number, az: number, bx: number, bz: number, px: number, pz: number, qx: number, qz: number): number | null {
  const rx = bx - ax
  const rz = bz - az
  const sx = qx - px
  const sz = qz - pz
  const den = rx * sz - rz * sx
  if (Math.abs(den) < 1e-9) return null
  const t = ((px - ax) * sz - (pz - az) * sx) / den
  const u = ((px - ax) * rz - (pz - az) * rx) / den
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null
}

/** El interior de la Residencia (la cara de adentro de la fachada), para la cámara. */
export const INTERIOR_RESIDENCIA: Rect = { x0: -24.9, x1: 24.9, z0: -12.3, z1: 12.3 }

/**
 * ¿Un muro de la planta (cortado a CORTE) tapa la línea de `a` (la cabeza de
 * alguien) a `b` (la cámara)? Cuenta los muros interiores (sin descontar las
 * puertas: ante la duda, la cámara sube), los macizos y la fachada.
 */
export function vistaTapada(planta: PlantaId, a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): boolean {
  const tope = PLANTA[planta].y + CORTE
  const debajo = (t: number) => a.y + (b.y - a.y) * t < tope - 0.05
  const lados = (r: Rect): Array<[number, number, number, number]> => [
    [r.x0, r.z0, r.x1, r.z0],
    [r.x1, r.z0, r.x1, r.z1],
    [r.x1, r.z1, r.x0, r.z1],
    [r.x0, r.z1, r.x0, r.z0],
  ]
  const prueba = (segs: Array<[number, number, number, number]>) => {
    for (const [px, pz, qx, qz] of segs) {
      const t = cruceSegmentos(a.x, a.z, b.x, b.z, px, pz, qx, qz)
      if (t !== null && t > 0.02 && debajo(t)) return true
    }
    return false
  }
  for (const m of MUROS) if (m.planta === planta && prueba(lados(m))) return true
  for (const mz of MACIZOS) {
    if (mz.planta !== planta) continue
    const segs: Array<[number, number, number, number]> = mz.pts.map(([x, z], i) => {
      const [x2, z2] = mz.pts[(i + 1) % mz.pts.length]
      return [x, z, x2, z2]
    })
    if (prueba(segs)) return true
  }
  if (PLANTA[planta].edificio === "residencia") {
    const r = INTERIOR_RESIDENCIA
    // La fachada, salvo el arco del Salón Azul (al sur, |x| < 3,4).
    if (
      prueba([
        [r.x0, r.z0, r.x1, r.z0],
        [r.x1, r.z0, r.x1, r.z1],
        [r.x1, r.z1, 3.4, r.z1],
        [-3.4, r.z1, r.x0, r.z1],
        [r.x0, r.z1, r.x0, r.z0],
      ])
    )
      return true
  }
  return false
}
