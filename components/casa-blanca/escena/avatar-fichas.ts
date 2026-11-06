// ──────────────────────────────────────────────────────────────
// FICHAS FÍSICAS DE LOS PERSONAJES
//
// Lo que hace reconocible a cada residente: estatura y contextura, forma de
// la cara, línea del pelo, peinado, barba, cejas, edad y tono de piel. Es un
// parecido de videojuego (proporciones, pelo, barba, edad, ropa), nunca un
// retrato fotográfico ni una caricatura.
//
// Cada ficha es OPCIONAL y parcial: lo que no dice sale de la Apariencia de
// datos/personajes.ts (complexión, estilo de pelo, barba) y de una variación
// pequeña por id. `resolverFicha` junta las dos cosas en números concretos que
// usan avatar-cuerpo, avatar-cabeza y avatar-pelo.
//
// Unidades: las medidas de la cara van en factores (1 = media) o en
// "centímetros de cara" (-1..1 ≈ ±1 cm sobre una cabeza de 23,5 cm). Las del
// cuerpo, en factores sobre un hombre medio de su estatura; las que dicen
// `ancho…` van en metros y mandan sobre el factor.
//
// Referencia del cuerpo medio (estatura 1,78 m; escala con la estatura):
//   hombros (biacromial, con deltoides) ≈ 0,44 m · pecho ≈ 0,33 m
//   cintura ≈ 0,30 m · cadera ≈ 0,34 m · cuello Ø ≈ 0,12 m
// ──────────────────────────────────────────────────────────────

import * as THREE from "three"
import type { Apariencia, Personaje } from "../tipos"
import { azar } from "./motor-texturas"
import { clamp, hashTexto } from "./avatar-geo"

// ── Lo que se puede escribir en una ficha ─────────────────────

export interface FichaCuerpo {
  /** Anchos relativos (1 = medio). */
  hombros?: number
  pecho?: number
  /** Profundidad del pecho y la espalda (de perfil). */
  profundidad?: number
  cintura?: number
  cadera?: number
  /** Anchos en metros: mandan sobre el factor (biacromial, cintura y cadera de frente). */
  anchoHombros?: number
  anchoCintura?: number
  anchoCadera?: number
  /** Vientre: cuánto sobresale de perfil (m, 0–0,09) y a qué altura (0 = ombligo, 1 = bajo el esternón). */
  panza?: number
  panzaAlta?: number
  /** Masa muscular por zona (1 = media; 1,5 = levantador de pesas, 0,85 = enjuto). */
  musculo?: { brazos?: number; antebrazos?: number; pecho?: number; espalda?: number; deltoides?: number; trapecio?: number; piernas?: number; pantorrillas?: number }
  /** Cuello: grosor (factor del radio) y largo visible (factor; 0,6 = muy corto). */
  cuello?: { grosor?: number; largo?: number }
  /** Largo de las piernas y de los brazos (factor sobre la proporción media; 1,05 = +5 %). */
  piernas?: number
  brazos?: number
  /** Grosor del muslo (factor). */
  muslo?: number
  manos?: number
  pies?: number
  /** Tamaño de la cabeza (factor). */
  cabeza?: number
  /** Espalda redondeada, hombros y cabeza adelantados (0..1). */
  encorvado?: number
}

export interface FichaCara {
  /** Ancho y alto de la cara (factores). */
  ancho?: number
  largo?: number
  /** Frente más alta (cm de cara, -1..2): sube el cráneo frontal y la línea del pelo. */
  frente?: number
  /** Mandíbula: ancho en el ángulo (factor) y definición del ángulo (0 suave, 1 marcado). */
  mandibula?: number
  anguloMandibula?: number
  /** Mentón: tamaño (factor), avance (cm), hoyuelo partido y forma cuadrada (0..1). */
  menton?: number
  mentonAvance?: number
  mentonPartido?: number
  mentonCuadrado?: number
  /** Pómulos (factor), mejillas (-1 hundidas … 1 llenas), papada y carrillos caídos (0..1). */
  pomulos?: number
  mejillas?: number
  papada?: number
  /** Arco de las cejas, el hueso (factor). */
  arcoCejas?: number
  /** Alto del tercio inferior (de la base de la nariz al mentón), factor 0,85..1,15. */
  tercioInferior?: number
  ojos?: {
    tam?: number
    sep?: number
    /** Inclinación (rad, + = esquina de afuera más alta). */
    incl?: number
    /** Abertura (factor; 0,6 = entrecerrados). */
    abierto?: number
    /** Peso del párpado superior (0..1: 1 = encapotado). */
    parpado?: number
    /** Hundidos (+) o saltones (-), en cm de cara. */
    hundidos?: number
    /** Sin pliegue del párpado superior (pliegue epicántico). */
    monoparpado?: boolean
    /** Bolsas bajo los ojos (0..1). */
    bolsas?: number
    /** Altura de los ojos en la cara (mm, + = más arriba). Cambia la distancia ojo-ceja y el tercio medio. */
    alto?: number
  }
  nariz?: {
    largo?: number
    ancho?: number
    /** Alto del dorso (0..1). */
    puente?: number
    /** Punta: tamaño del bulbo (factor). */
    punta?: number
    /** Cuánto sale de la cara (factor). */
    proy?: number
    /** Aguileña: giba en el dorso y punta que baja (0..1). */
    gancho?: number
    /** Respingada: punta que sube (0..1). */
    respingada?: number
    /** Chata: dorso hundido (0..1). */
    chata?: number
  }
  labios?: {
    ancho?: number
    /** Grosor del labio de arriba y del de abajo (factores). */
    superior?: number
    inferior?: number
    /** Labio de abajo adelantado (0..1). */
    avanceInferior?: number
    /** Comisuras: -1 hacia abajo … 1 hacia arriba (media sonrisa). */
    comisuras?: number
    /** Largo del filtrum (mm, + = boca más abajo, labio de arriba largo). */
    filtrum?: number
  }
  orejas?: { tam?: number; despegadas?: number; lobulo?: number }
}

export interface FichaPiel {
  /** Tono de la cara (el material). */
  base?: string
  /** Cuello, manos y cuerpo, si difiere de la cara. */
  cuerpo?: string
  /** Contorno de los ojos: color y cuánto (0..1). */
  ojos?: [string, number]
  /** Rubor de mejillas y nariz: color y cuánto (0..1). */
  rubor?: [string, number]
  labios?: string
  /** Manchas de la edad (0..1). */
  manchas?: number
  /** Brillo de la piel (0..1: cabeza rapada, sudor). */
  brillo?: number
  /** Delineado negro (kohl) alrededor del ojo, con la cola hacia la sien (0..1). */
  delineado?: number
  /** Sombra de color sobre el párpado móvil: color y cuánto (0..1). */
  sombraOjos?: [string, number]
}

export interface FichaPelo {
  color?: string
  /** Puntas o mechas más claras, y la capa de abajo y los costados más oscura. */
  puntas?: string
  bajo?: string
  /** Fracción de canas (0..1) y canas extra en las sienes (0..1). */
  canas?: number
  canasSienes?: number
  linea?: {
    /** Frente: + sube la línea (cm). */
    alto?: number
    /** Entradas en las sienes, forma de M (0..1). */
    entradas?: number
    /** Clareo en la coronilla (0..1). */
    coronilla?: number
    /** Calvicie en herradura: solo queda pelo en sienes y nuca (0..1). */
    calvo?: number
    /** Línea recta con esquinas en las sienes (0..1). */
    recta?: number
    /** Patillas: cuánto bajan delante de la oreja (cm, -1..2). */
    patillas?: number
    /** Nuca: cuánto baja el pelo atrás (cm; + más largo). */
    nuca?: number
    /** El pelo pasa por encima de las orejas (0..1). */
    cubreOrejas?: number
    /** Flequillo recto sobre la frente (0..1). */
    flequillo?: number
  }
  /** Grosor del pelo sobre el cuero cabelludo (m) por zona. */
  volumen?: { base?: number; arriba?: number; frente?: number; lados?: number; atras?: number }
  /** Copete: alto sobre el cuero (m) y cuánto avanza sobre la frente (m). */
  copete?: { alto?: number; avance?: number }
  /** Raya: -1 a la derecha del personaje, 1 a la izquierda, 0 al medio; null = sin raya. */
  raya?: number | null
  /** Rizos (0..1), frecuencia de los rizos (1 = media) y ondas del pelo largo (0..1). */
  rizo?: number
  frecRizo?: number
  ondas?: number
  /** Borde: 0 = canto grueso (copete, rizos), 1 = se afina hasta la piel. */
  borde?: number
  /** Pelo largo que cae (m por debajo de la oreja; 0 = no hay). */
  largo?: number
  /** Cae también por delante de los hombros (0..1). */
  adelante?: number
  /** Rapado: sin volumen, solo la sombra del pelo en la piel (densidad 0..1). */
  rapado?: number
  /** De dónde sale el pelo (las hebras se abren desde ahí). */
  remolino?: "coronilla" | "frente" | "raya"
  /** Moño en la coronilla: alto y radio (m). */
  mono?: { alto: number; radio: number } | null
  /** Pelo liso y peinado (laca, gel): las capas de afuera sin huecos entre hebras, silueta lisa (0..1). */
  liso?: number
}

export interface FichaBarba {
  color?: string
  canas?: number
  /** Densidad (0..1): por debajo de 0,35 es solo sombra de barba en la piel. */
  densidad?: number
  /** Grosor sobre la piel en el mentón (m). */
  largo?: number
  /** Zonas (0..1): bigote, perilla (mentón y bajo el labio), mandíbula, mejillas (hasta dónde sube) y cuello. */
  bigote?: number
  perilla?: number
  mandibula?: number
  mejillas?: number
  cuello?: number
  /** Ancho de la perilla (factor) y del bigote. */
  anchoPerilla?: number
  /** Barba que cuelga del mentón: largo (m), ancho (m) y partida en dos (0..1). */
  colgante?: number
  anchoColgante?: number
  partida?: number
  /** Bigote que cae por las comisuras (m). */
  bigoteCaido?: number
  rizo?: number
  /** Borde de la mejilla: 0 = recto y limpio, 1 = se degrada. */
  borde?: number
  /** Barba recortada y tupida: la capa de afuera tapa como una masa, sin escoba de hebras (0..1). */
  liso?: number
}

export interface FichaCejas {
  color?: string
  /** Grosor (factor), largo (factor), arco (0 recta .. 1 arqueada), densidad (0..1). */
  grosor?: number
  largo?: number
  arco?: number
  densidad?: number
  /** Pelos largos que sobresalen (cejas de anciano, 0..1). */
  pobladas?: number
  /** Sube la parte de adentro (gesto pensativo, + ) o la de afuera (-). */
  inclinacion?: number
  /** Más altas (+) o más bajas (-) sobre el ojo (cm). */
  alto?: number
}

/** Lo que la ficha cambia de la Apariencia (solo para armar el avatar). */
export interface FichaAp {
  piel?: string
  complexion?: Apariencia["complexion"]
  pelo?: Partial<Apariencia["pelo"]>
  /** null = sin barba en la Apariencia. */
  barba?: Apariencia["barba"] | null
  sombrero?: Apariencia["sombrero"]
  ropa?: Partial<Apariencia["ropa"]>
  accesorios?: Apariencia["accesorios"]
}

/** Detalles de la ropa que distinguen a cada uno (avatar-ropa.ts los lee). */
export interface FichaVestuario {
  /** Remera ajustada (en vez de suéter) en la ropa casual. */
  remera?: boolean
  /** Pantalón de mezclilla (jean) o de tela. */
  mezclilla?: boolean
  /** Cuello en V (suéter o camiseta). */
  cuelloV?: boolean
  /** Camisa con cuello abajo, bajo un suéter (se ve el cuello). */
  cuelloCamisa?: string
  /** Chaleco bajo el saco (color): de la camisa solo queda una franja. */
  chaleco?: string
  /** Túnica: alto del ruedo (fracción de la estatura; 0,035 = tobillo, 0,28 = rodilla). */
  ruedo?: number
  /** Mangas de la túnica: largo (m sobre el brazo; 0 = sin manga) y ancho de la boca (m). */
  manga?: number
  mangaAncha?: number
  /** Cinturón o faja de tela (color, ancho en m); null = sin cinturón. */
  cinturon?: { color: string; ancho?: number } | null
  /** Manto cruzado (himation, toga, palio): color, ancho (m), hombro (1 = izquierdo) y borde. */
  manto?: { color: string; ancho?: number; lado?: 1 | -1; borde?: string; bajo?: number } | null
  /** Capa larga sobre la espalda (color) prendida en un hombro. */
  capa?: { color: string; largo?: number } | null
  /** Capucha profunda (hábito). */
  capucha?: { color: string; ribete?: string } | null
  /** Mandil de piel blanca con ribete (masón). */
  mandil?: { color: string; ribete: string } | null
  /** Faja diagonal: color del centro y del borde. */
  faja?: { color: string; borde: string } | null
  /** Descalzo (sin sandalias). */
  descalzo?: boolean
  /** Gafas sin aro (solo el cristal, el puente y las patillas). */
  gafasSinAro?: boolean
  /** Cuello alto de la casaca o pechera más angosta (uniforme). */
  pecheraAngosta?: boolean
  /** Ribete del ruedo de la túnica (color); null = sin ribete. */
  ribete?: string | null
  /** Dos franjas verticales (clavi) del hombro al ruedo, por delante (color). */
  clavi?: string
  /** Cuello cruzado (hanfu): el ribete del cuello baja del hombro izquierdo a la axila derecha (color). */
  cuelloCruzado?: string
  /** Collar ancho en V sobre el pecho (cinta del grado masónico): color y fleco. */
  collarV?: { color: string; borde: string } | null
  /** Abrigo largo abierto hasta la rodilla, con cuello chal (holograma de Claude). */
  abrigo?: boolean
  /** Chaqueta corta entallada de cuello alto, con hombros rectos (holograma de ChatGPT). */
  chaquetaMao?: boolean
  /** Emblema flotante: "chispa" (asterisco radial detrás de la cabeza) o "nudo" (seis lazos sobre el pecho). */
  emblema?: "chispa" | "nudo"
  /** Guan: tapa laqueada sobre el moño, con un pasador horizontal (color del pasador). Requiere pelo.mono. */
  guan?: { color: string; pasador: string }
}

export interface Ficha {
  /** Cambios de la Apariencia (ropa, colores, accesorios, peinado base). */
  ap?: FichaAp
  vestuario?: FichaVestuario
  estatura?: number
  /** Edad aparente en años. */
  edad?: number
  fem?: boolean
  cuerpo?: FichaCuerpo
  cara?: FichaCara
  piel?: FichaPiel
  iris?: string
  /** Blanco del ojo (para que no sea blanco puro). */
  esclera?: string
  pelo?: FichaPelo
  barba?: FichaBarba | null
  cejas?: FichaCejas
}

/**
 * Las fichas por id. Se completan una por una: un personaje sin ficha sale
 * de su Apariencia como antes. Un banco de pruebas puede registrar fichas
 * de ensayo con `FICHAS["id"] = {...}` antes de crear el avatar.
 */
export const FICHAS: Record<string, Ficha> = {
  // Donald Trump: 1,90 m, corpulento con el vientre alto contenido por el saco;
  // cara ancha con papada, ojos entrecerrados; el copete rubio hacia adelante
  // y los costados peinados hacia atrás, sobre las orejas.
  trump: {
    estatura: 1.9,
    edad: 79,
    ap: { piel: "#E6A97E", ropa: { color: "#1B2340", color2: "#F4F4F2", corbata: "#C8102E" } },
    cuerpo: { anchoHombros: 0.53, pecho: 1.0, profundidad: 1.1, cintura: 1.18, panza: 0.065, panzaAlta: 0.55, cuello: { grosor: 1.25, largo: 0.95 }, piernas: 0.97, muslo: 0.95 },
    cara: {
      ancho: 1.1, largo: 1.03, mandibula: 1.12, menton: 1.05, mejillas: 0.05, papada: 0.15, tercioInferior: 1.04, arcoCejas: 1.1,
      ojos: { abierto: 0.88, parpado: 0.6, tam: 0.95, bolsas: 0.25 },
      nariz: { ancho: 1.1, punta: 1.05 },
      labios: { superior: 0.8, inferior: 1.0, avanceInferior: 0.1, ancho: 0.9, comisuras: -0.05 },
      orejas: { tam: 1.15, lobulo: 1.35 },
    },
    piel: { base: "#E6A97E", ojos: ["#EDBF9C", 0.25], rubor: ["#D98F70", 0.3], cuerpo: "#EBBC98" },
    iris: "#6f8aa0",
    pelo: { color: "#D9A45E", puntas: "#F2CF8E", bajo: "#B9834A", volumen: { base: 0.006, arriba: 0.012, lados: 0.008 }, copete: { alto: 0.032, avance: 0.022 }, linea: { alto: 0.6, entradas: 0.5, nuca: -0.3, cubreOrejas: 0 }, borde: 0.15, remolino: "coronilla", largo: 0, liso: 0.85 },
    barba: { densidad: 0 },
    cejas: { color: "#CDAE78", grosor: 0.6, densidad: 0.45, largo: 0.85, arco: 0.25 },
  },

  // Sun Tzu: general erudito, delgado; moño alto en la coronilla y barba de
  // tres mechones (bigote caído y perilla larga, mejillas afeitadas).
  suntzu: {
    estatura: 1.7,
    edad: 55,
    ap: { piel: "#D6B086", pelo: { estilo: "peinado_atras", color: "#1C1A18" }, ropa: { color: "#34452F", color2: "#B08D57" } },
    vestuario: { guan: { color: "#141414", pasador: "#B08D57" }, cinturon: { color: "#6B1E1E", ancho: 0.05 }, mangaAncha: 0.06, manto: null, ribete: "#B08D57", cuelloCruzado: "#B08D57" },
    cuerpo: { anchoHombros: 0.38, anchoCintura: 0.27, musculo: { brazos: 0.85, piernas: 0.9 } },
    cara: {
      ancho: 0.94, largo: 1.06, frente: 0.8, pomulos: 1.25, mejillas: -0.1, mandibula: 0.95, menton: 0.95,
      ojos: { monoparpado: true, incl: 0.16, abierto: 0.64, tam: 0.86, parpado: 0.45, hundidos: -0.4, bolsas: 0.3 },
      nariz: { puente: 0.05, ancho: 1.08, punta: 0.95, proy: 0.85 },
      labios: { superior: 0.75, inferior: 0.8 },
    },
    piel: { base: "#D6B086" },
    iris: "#2a1d15",
    pelo: { color: "#2A2119", canasSienes: 0.2, largo: 0, mono: { alto: 0.06, radio: 0.026 }, volumen: { base: 0.003, arriba: 0.003, lados: 0.001, frente: 0, atras: 0 }, raya: null, remolino: "frente", linea: { entradas: 0, recta: 0.5, alto: 0.6, cubreOrejas: 0 }, borde: 0.6, ondas: 0, adelante: 0 },
    // Barba de tres mechones: bigote fino y perilla larga y angosta (el bigote
    // caído salía como dos alambres negros).
    barba: { color: "#2E2620", canas: 0.08, densidad: 0.9, largo: 0.004, bigote: 0.55, perilla: 0.8, mandibula: 0, mejillas: 0, cuello: 0, anchoPerilla: 0.55, colgante: 0.11, anchoColgante: 0.022, bigoteCaido: 0, borde: 0.2, liso: 1 },
    cejas: { color: "#2A2119", grosor: 0.75, largo: 1.15, arco: 0.1, inclinacion: -0.2 },
  },

  // Peter Thiel: frente alta con entradas en M, raya al costado, cara larga
  // con mentón fuerte; traje con la camisa abierta.
  thiel: {
    estatura: 1.78,
    edad: 59,
    ap: { piel: "#EAC4A4", ropa: { color: "#1E2A44", color2: "#C2D2E6" } },
    cuerpo: { anchoHombros: 0.43, panza: 0.012 },
    cara: {
      ancho: 0.91, largo: 1.08, frente: 1.2, mandibula: 0.95, anguloMandibula: 0.6, menton: 1.2, mentonAvance: 0.3, mentonCuadrado: 0.2, mejillas: -0.45, tercioInferior: 1.05, pomulos: 1.1,
      ojos: { alto: -2, abierto: 0.85, parpado: 0.5, tam: 0.95 },
      nariz: { largo: 1.08, puente: 0.6 },
      labios: { superior: 0.78, inferior: 0.88, ancho: 0.94, comisuras: -0.05 },
    },
    piel: { base: "#EAC4A4", rubor: ["#E0AE90", 0.25] },
    iris: "#7C8C9A",
    pelo: { color: "#8E7154", puntas: "#A88B6C", canas: 0.35, volumen: { base: 0.004, arriba: 0.008, frente: 0.004 }, linea: { entradas: 0.85, alto: 0.8 }, raya: 1, remolino: "raya", borde: 0.5, liso: 0.6 },
    barba: { densidad: 0 },
    cejas: { color: "#8A6E52", grosor: 0.75, arco: 0.15 },
  },

  // Sam Altman: bajo y delgado, cara juvenil y ojos grandes e intensos;
  // pelo corto despeinado hacia adelante. Suéter y jeans.
  altman: {
    estatura: 1.73,
    edad: 41,
    ap: { piel: "#EFC8A8", ropa: { color: "#8A8F96", color2: "#2F3E55" } },
    cuerpo: { anchoHombros: 0.4, anchoCintura: 0.28, cuello: { grosor: 0.9, largo: 0.85 }, musculo: { brazos: 0.85, piernas: 0.88 }, cabeza: 1.06 },
    cara: {
      ancho: 0.9, largo: 0.98, tercioInferior: 0.92, mandibula: 0.85, menton: 0.82, mejillas: -0.1, papada: 0, pomulos: 0.95,
      ojos: { alto: 2, tam: 1.1, abierto: 1.15, parpado: 0.1, bolsas: 0.25, hundidos: -0.1 },
      nariz: { largo: 0.92, ancho: 0.9, puente: 0.4 },
      labios: { superior: 0.62, inferior: 0.75, ancho: 0.92 },
      orejas: { despegadas: 0.55 },
    },
    piel: { base: "#EFC8A8", ojos: ["#D9AE92", 0.2] },
    iris: "#6E7C5A",
    pelo: { color: "#6B5442", puntas: "#8C735C", canasSienes: 0.3, volumen: { base: 0.0035, arriba: 0.008, frente: 0.005, lados: 0.0005 }, linea: { entradas: 0.45, alto: 0.35 }, remolino: "coronilla", rizo: 0.25, borde: 0.75 },
    barba: { densidad: 0.1 },
    cejas: { color: "#5A4A3C", grosor: 0.8, arco: 0.3, alto: 0.15 },
  },

  // Elon Musk: grande y pesado, hombros redondeados, cuello grueso, mandíbula
  // ancha; pelo corto y tupido peinado hacia arriba y atrás. Remera negra.
  musk: {
    estatura: 1.88,
    edad: 55,
    ap: { piel: "#EDC6A8", ropa: { color: "#141518", color2: "#2A2F38" } },
    vestuario: { remera: true, mezclilla: true },
    cuerpo: { anchoHombros: 0.51, pecho: 1.15, profundidad: 1.1, cintura: 1.18, panza: 0.03, panzaAlta: 0.5, cuello: { grosor: 1.3, largo: 0.8 }, encorvado: 0.25, musculo: { brazos: 1.3, deltoides: 1.2, antebrazos: 1.15, piernas: 1.05 } },
    cara: {
      ancho: 1.06, largo: 1.07, mandibula: 1.15, anguloMandibula: 0.5, menton: 1.15, mentonCuadrado: 0.5, mentonAvance: 0.35, mejillas: 0.15, papada: 0.2, tercioInferior: 1.04,
      ojos: { tam: 0.88, abierto: 0.85, parpado: 0.8, hundidos: 0.3, sep: 1.04, bolsas: 0.35 },
      nariz: { puente: 0.6, punta: 1.08, ancho: 1.05 },
      labios: { superior: 0.6, inferior: 1.1, comisuras: 0.3, filtrum: 1.5 },
    },
    piel: { base: "#EDC6A8", rubor: ["#E4B394", 0.25] },
    iris: "#5f7a80",
    pelo: { color: "#45342A", puntas: "#66503E", canasSienes: 0.25, volumen: { base: 0.0025, arriba: 0.016, frente: 0.006, lados: 0, atras: 0.001 }, copete: { alto: 0.02, avance: 0.0 }, liso: 0.4, linea: { entradas: 0.45, alto: 0.45, flequillo: 0 }, raya: null, remolino: "frente", borde: 0.4, rizo: 0.15 },
    barba: { densidad: 0.15, color: "#6A5A50" },
    cejas: { color: "#3E2E24", grosor: 1.05, arco: 0.15, alto: -0.25 },
  },

  // Alex Hormozi: espalda en V de levantador, cuello grueso, cabeza rapada y
  // barba oscura completa y recortada. Remera negra ajustada.
  hormozi: {
    estatura: 1.8,
    edad: 37,
    ap: { piel: "#D6A47E", ropa: { color: "#141414", color2: "#1E1E1E" } },
    vestuario: { remera: true, mezclilla: false },
    cuerpo: { anchoHombros: 0.53, anchoCintura: 0.34, pecho: 1.15, profundidad: 1.12, panza: 0, cuello: { grosor: 1.35, largo: 0.8 }, musculo: { brazos: 1.9, antebrazos: 1.6, pecho: 1.8, espalda: 1.7, deltoides: 1.8, trapecio: 1, piernas: 1.25 } },
    cara: { ancho: 1.04, mandibula: 1.15, anguloMandibula: 0.9, mentonCuadrado: 0.7, arcoCejas: 1.2, ojos: { hundidos: 0.3 }, nariz: { ancho: 1.12 } },
    piel: { base: "#D6A47E", brillo: 0.6 },
    iris: "#2E2018",
    pelo: { rapado: 0.18, color: "#3A2E26", linea: { entradas: 0.3 } },
    // (borde de la mejilla en degradé y un castaño muy oscuro, no negro: con borde 0,05
    // la barba se leía como una máscara negra pegada; el color, apenas más cálido)
    barba: { color: "#1c130f", densidad: 1, largo: 0.014, bigote: 1, perilla: 1, mandibula: 1, mejillas: 0.6, cuello: 0.55, borde: 0.32, liso: 0.8 },
    cejas: { color: "#1E1612", grosor: 1.3, arco: 0.1, densidad: 1 },
  },

  // Dario Amodei: cara redonda y llena, gafas, mata de rizos oscuros. Suéter en V.
  amodei: {
    estatura: 1.78,
    edad: 43,
    ap: { piel: "#ECC6A6", ropa: { color: "#5A7394", color2: "#2E3440" } },
    vestuario: { cuelloV: true },
    cuerpo: { anchoHombros: 0.42, panza: 0.015, encorvado: 0.2 },
    cara: {
      ancho: 1.06, largo: 0.97, mejillas: 0.5, papada: 0.15, mandibula: 0.95, anguloMandibula: 0.15, menton: 0.95,
      nariz: { punta: 1.1 },
      labios: { superior: 1.1, inferior: 1.2, comisuras: 0.2 },
    },
    piel: { base: "#ECC6A6", rubor: ["#E2B496", 0.25] },
    iris: "#4A3828",
    pelo: { color: "#3A2A20", puntas: "#5A4232", bajo: "#24180F", rizo: 0.9, frecRizo: 1.2, volumen: { base: 0.012, arriba: 0.022, lados: 0.013, atras: 0.012, frente: 0.014 }, linea: { cubreOrejas: 0.5, entradas: 0.1 }, borde: 0.2 },
    barba: { densidad: 0.25, color: "#4A3A30" },
    cejas: { color: "#2E2018", grosor: 1.25, densidad: 1, arco: 0.3 },
  },

  // Sundar Pichai: frente alta por las entradas, pelo negro con canas peinado
  // atrás, mejillas suaves, sonrisa cálida, gafas finas. Suéter sobre camisa.
  pichai: {
    estatura: 1.75,
    edad: 54,
    ap: { piel: "#A6724F", ropa: { color: "#6B7280", color2: "#8C8576" } },
    vestuario: { cuelloV: true, cuelloCamisa: "#E8ECF2", mezclilla: false },
    cuerpo: { anchoHombros: 0.42, panza: 0.01, musculo: { brazos: 0.88 } },
    cara: {
      ancho: 1.0, frente: 1.0, mejillas: 0.4, mandibula: 0.95, anguloMandibula: 0.2, menton: 0.95, pomulos: 1.05,
      ojos: { abierto: 0.9, bolsas: 0.3 },
      nariz: { ancho: 1.18, punta: 1.15, puente: 0.35 },
      labios: { superior: 1.1, inferior: 1.2, comisuras: 0.35 },
    },
    piel: { base: "#A6724F", labios: "#8A5544" },
    iris: "#3A2A20",
    pelo: { color: "#2B231E", canas: 0.05, canasSienes: 0.3, volumen: { base: 0.004, arriba: 0.007, frente: 0.003 }, linea: { entradas: 0.85, alto: 0.9, coronilla: 0.2 }, remolino: "frente", raya: null, liso: 0.3 },
    barba: { densidad: 0.1, color: "#4a3a30" },
    cejas: { color: "#2B221C", grosor: 1.2, arco: 0.55, densidad: 1 },
  },

  // El Gran Maestro: anciano distinguido, pelo blanco hacia atrás, barba blanca
  // completa en pala, cejas largas; traje negro con mandil y faja blanca.
  mason: {
    estatura: 1.78,
    edad: 74,
    ap: { piel: "#E6C2A4", pelo: { estilo: "peinado_atras", color: "#E4E1DA" }, barba: { estilo: "completa", color: "#ECE8E0" }, ropa: { color: "#111111", color2: "#F2EFE6", corbata: "#0E0E10" }, accesorios: [] },
    vestuario: { mandil: { color: "#F4F1EA", ribete: "#C9A040" }, collarV: { color: "#F2EFE6", borde: "#C9A040" } },
    cuerpo: { anchoHombros: 0.43, panza: 0.03, panzaAlta: 0.45, encorvado: 0.35 },
    cara: {
      ancho: 1.0, largo: 1.06, frente: 1.0, mandibula: 1.05, mentonCuadrado: 0.4, mejillas: -0.1, papada: 0.25,
      ojos: { parpado: 0.85, bolsas: 0.7, abierto: 0.8, tam: 0.95 },
      nariz: { largo: 1.15, gancho: 0.25, puente: 0.75 },
      orejas: { tam: 1.12, lobulo: 1.3 },
    },
    piel: { base: "#E6C2A4", rubor: ["#D9A58C", 0.3], manchas: 0.35 },
    iris: "#5f6f7a",
    pelo: { color: "#E2DACB", puntas: "#ECE6DA", bajo: "#C8C4BC", volumen: { base: 0.006, arriba: 0.012, frente: 0.008, atras: 0.006 }, linea: { entradas: 0.75, coronilla: 0.35, nuca: 1.2 }, ondas: 0.4, remolino: "frente", raya: null, borde: 0.4 },
    barba: { color: "#E6DDCC", canas: 0.1, densidad: 1, largo: 0.02, bigote: 1, perilla: 1, mandibula: 1, mejillas: 0.75, cuello: 0.6, colgante: 0.04, anchoColgante: 0.1, borde: 0.5 },
    cejas: { color: "#E2DACB", grosor: 1.3, pobladas: 0.9, densidad: 1 },
  },

  // El Iluminado: alto y delgado, hábito negro con capucha profunda; de la cara
  // solo se ve el mentón afilado.
  iluminado: {
    estatura: 1.84,
    edad: 45,
    ap: { piel: "#D6C0AE", pelo: { estilo: "peinado_atras", color: "#121212" }, ropa: { tipo: "tunica", color: "#17151D", color2: "#C9A43A" }, accesorios: [], sombrero: null },
    vestuario: { capucha: { color: "#17151D", ribete: "#C9A43A" }, cinturon: { color: "#C9A43A", ancho: 0.01 }, mangaAncha: 0.08, manto: null, ruedo: 0.012, ribete: "#C9A43A" },
    cuerpo: { anchoHombros: 0.4, anchoCintura: 0.28 },
    cara: {
      ancho: 0.9, largo: 1.08, mandibula: 0.95, anguloMandibula: 0.75, menton: 1.0, mentonAvance: 0.1, mejillas: -0.3,
      nariz: { largo: 1.12, ancho: 0.88 },
      labios: { superior: 0.6, inferior: 0.7 },
    },
    // Piel en la sombra de la capucha (la tela no siempre la sombrea con el sol alto).
    piel: { base: "#8C7A70", cuerpo: "#C9B6A8", ojos: ["#2a2226", 0.9] },
    // Bajo la capucha no hay pelo (rapado = sin geometría: ~3.800 triángulos menos).
    pelo: { color: "#121212", rapado: 0.4 },
    barba: { densidad: 0 },
  },

  // Jesús de Nazaret: delgado, cara alargada y serena, pelo largo ondulado con
  // raya al medio, barba castaña de largo medio. Túnica clara y manto rojo.
  jesus: {
    estatura: 1.7,
    edad: 33,
    ap: { piel: "#C49C78", ropa: { color: "#ECE4D2", color2: "#8E2B2B" } },
    vestuario: { cinturon: { color: "#8C6A4A", ancho: 0.018 }, manto: { color: "#8E2B2B", ancho: 0.38, lado: 1, borde: "#6E1F1F", bajo: 0.52 }, ribete: null, mangaAncha: 0.03 },
    cuerpo: { anchoHombros: 0.42, anchoCintura: 0.28, musculo: { brazos: 0.95 } },
    cara: {
      ancho: 0.93, largo: 1.08, pomulos: 1.15, mejillas: -0.15, mandibula: 0.95,
      ojos: { tam: 1.04, abierto: 0.95, parpado: 0.35 },
      nariz: { largo: 1.08, ancho: 0.95, puente: 0.7 },
      labios: { superior: 0.95, inferior: 1.05, comisuras: 0.12 },
    },
    piel: { base: "#C49C78" },
    iris: "#3B2618",
    pelo: { color: "#3E2B1E", puntas: "#5A4030", largo: 0.15, ondas: 0.6, raya: 0, adelante: 0.4, linea: { cubreOrejas: 0.6, entradas: 0.1 }, volumen: { base: 0.004, arriba: 0.006, lados: 0.002 }, remolino: "raya", borde: 0.5 },
    barba: { color: "#3E2B1E", densidad: 0.95, largo: 0.016, bigote: 1, perilla: 1, mandibula: 1, mejillas: 0.6, cuello: 0.5, colgante: 0.04, partida: 0.6, anchoColgante: 0.07, rizo: 0.5, borde: 0.8 },
    cejas: { color: "#3A2A1E", grosor: 0.95, arco: 0.35, densidad: 0.85 },
  },

  // Alex Karp: enjuto y nervudo, nube enorme de rizos grises, nariz fuerte,
  // pómulos altos.
  karp: {
    estatura: 1.76,
    edad: 59,
    ap: { piel: "#E7C09E", ropa: { color: "#374151", color2: "#1F2937" } },
    cuerpo: { anchoHombros: 0.41, anchoCintura: 0.27, cuello: { grosor: 0.85, largo: 1.12 }, piernas: 1.02, musculo: { brazos: 0.82, piernas: 0.88 } },
    cara: {
      ancho: 0.92, largo: 1.1, pomulos: 1.3, mejillas: -0.6, mandibula: 0.95, menton: 1.1, anguloMandibula: 0.6,
      ojos: { hundidos: 0.4, abierto: 1.05 },
      nariz: { largo: 1.15, proy: 1.15, gancho: 0.35, puente: 0.8 },
      labios: { ancho: 1.1 },
    },
    piel: { base: "#E7C09E", rubor: ["#DDB08C", 0.25] },
    iris: "#4A3E36",
    pelo: { color: "#A49D93", bajo: "#6E6860", puntas: "#C4BCAE", canas: 0.25, rizo: 0.55, frecRizo: 1.0, ondas: 0.6, volumen: { base: 0.016, arriba: 0.026, lados: 0.02, atras: 0.02, frente: 0.012 }, linea: { cubreOrejas: 0.7, entradas: 0.3 }, borde: 0.2 },
    barba: { densidad: 0 },
    cejas: { color: "#4A4440", grosor: 1.3, densidad: 1, arco: 0.45, alto: 0.15, pobladas: 0.3 },
  },

  // Marco Aurelio: cara larga, ojos grandes de párpado pesado, rizos apretados
  // y barba rizada de filósofo; túnica a la rodilla y manto púrpura.
  marco: {
    estatura: 1.72,
    edad: 52,
    // Sin laurel: con hojas sueltas se leía como una línea punteada verde, no
    // como una corona (los bustos de Marco Aurelio lo muestran sin ella).
    ap: { piel: "#E2BC98", ropa: { color: "#EDE6D6", color2: "#5B1E4E" }, sombrero: null },
    vestuario: { ruedo: 0.27, manga: 0.15, mangaAncha: 0.012, manto: null, clavi: "#5B1A4A", capa: { color: "#5B1E4E", largo: 0.66 }, cinturon: { color: "#9a7a3a", ancho: 0.012 } },
    cuerpo: { anchoHombros: 0.42, musculo: { antebrazos: 1.05, pantorrillas: 1.1 } },
    cara: {
      ancho: 0.94, largo: 1.1, frente: 0.5, pomulos: 0.95,
      ojos: { tam: 1.12, abierto: 0.85, parpado: 0.85, hundidos: -0.3 },
      nariz: { largo: 1.1, puente: 0.8 },
    },
    piel: { base: "#E2BC98" },
    iris: "#4a3828",
    pelo: { color: "#6E5038", canas: 0.2, rizo: 0.55, ondas: 0.7, frecRizo: 1.6, volumen: { base: 0.014, arriba: 0.018, frente: 0.004, lados: 0.019, atras: 0.012 }, linea: { cubreOrejas: 0.5, entradas: 0, recta: 0.4, alto: -0.3 }, borde: 0.2, liso: 0.5, remolino: "coronilla" },
    barba: { color: "#5A4030", canas: 0.12, densidad: 1, largo: 0.02, rizo: 0.5, bigote: 1, perilla: 1, mandibula: 1, mejillas: 0.75, cuello: 0.6, partida: 0.4, colgante: 0.04, anchoColgante: 0.09, borde: 0.5 },
    cejas: { inclinacion: 0.35, arco: 0.6, grosor: 1.05 },
  },

  // Napoleón: 1,69 m (estatura media de su época), cara lisa de rasgos
  // clásicos, mechón en la frente, bicornio de costado; casaca verde.
  napoleon: {
    estatura: 1.69,
    edad: 36,
    ap: { piel: "#DDB896", ropa: { color: "#2E4A32", color2: "#EDEAE0" } },
    vestuario: { pecheraAngosta: true, chaleco: "#A3202A" },
    cuerpo: { anchoHombros: 0.41, panza: 0.015, piernas: 0.97, manos: 0.92 },
    cara: {
      ancho: 0.97, largo: 1.0, frente: 1.0, mejillas: -0.1, mandibula: 1.0, anguloMandibula: 0.35, menton: 1.15, mentonAvance: 0, papada: 0, pomulos: 1.0,
      ojos: { tam: 1.05, abierto: 0.95, parpado: 0.3, hundidos: 0.1 },
      nariz: { puente: 1.0, largo: 1.1, proy: 1.18, ancho: 0.95 },
      labios: { superior: 0.8, inferior: 0.9, ancho: 0.85, comisuras: -0.15 },
    },
    piel: { base: "#DDB896" },
    iris: "#6E7E8C",
    pelo: { color: "#3A2A1E", volumen: { base: 0.004, arriba: 0.006, frente: 0.006 }, linea: { flequillo: 0.35, entradas: 0.35 }, remolino: "coronilla", rizo: 0.1, borde: 0.6 },
    barba: { densidad: 0 },
    cejas: { color: "#4A3626", grosor: 0.9, arco: 0.2 },
  },

  // Andrew Tate (solo físico y ropa): peleador ancho, cabeza rapada, barba
  // corta completa, cuello grueso. Traje negro con camisa negra abierta.
  tate: {
    estatura: 1.9,
    edad: 39,
    ap: { piel: "#C4916A", barba: { estilo: "corta", color: "#2B2119" }, ropa: { color: "#121212", color2: "#1A1A1A" } },
    cuerpo: { anchoHombros: 0.5, anchoCintura: 0.34, pecho: 1.12, profundidad: 1.08, panza: 0, cuello: { grosor: 1.3, largo: 0.85 }, manos: 1.08, musculo: { brazos: 1.35, antebrazos: 1.25, pecho: 1.4, espalda: 1.4, deltoides: 1.35, trapecio: 0.9, piernas: 1.12 } },
    cara: {
      ancho: 1.04, largo: 1.05, mandibula: 1.18, anguloMandibula: 0.95, mentonCuadrado: 0.75, menton: 1.1, mentonAvance: 0.25, arcoCejas: 1.15, mejillas: -0.1,
      ojos: { abierto: 0.75, parpado: 0.55, hundidos: 0.25 },
      nariz: { ancho: 1.12, puente: 0.6 },
    },
    piel: { base: "#C4916A", brillo: 0.5 },
    iris: "#3A2416",
    pelo: { rapado: 0.03, color: "#2A2522" },
    barba: { color: "#2B2119", densidad: 1, largo: 0.003, bigote: 1, perilla: 1, mandibula: 1, mejillas: 0.5, cuello: 0.35, borde: 0.3, liso: 1 },
    cejas: { color: "#241C16", grosor: 1.25, arco: 0.1 },
  },

  // Iman Gadzhi: 25 años, delgado y erguido, cara alargada de pómulos altos,
  // pelo castaño hacia atrás con volumen. Remera negra ajustada y pantalón beige.
  gadzhi: {
    estatura: 1.8,
    edad: 25,
    ap: { piel: "#E6C2A0", ropa: { color: "#151515", color2: "#CBB89E" }, accesorios: ["reloj"] },
    vestuario: { remera: true, mezclilla: false },
    cuerpo: { anchoHombros: 0.42, anchoCintura: 0.28, piernas: 1.02, cuello: { grosor: 0.95 }, musculo: { brazos: 0.95, antebrazos: 1.0 } },
    cara: {
      ancho: 0.94, largo: 1.03, pomulos: 1.12, mejillas: -0.3, mandibula: 1.0, anguloMandibula: 1.0, tercioInferior: 1.04, menton: 0.95, papada: 0,
      ojos: { abierto: 0.92, parpado: 0.3, bolsas: 0 },
      nariz: { ancho: 0.88, puente: 0.7, largo: 1.02 },
      labios: { superior: 0.75, inferior: 0.9, filtrum: -2 },
    },
    piel: { base: "#E6C2A0" },
    iris: "#3B2A1E",
    // (con el remolino al frente, de frente se leía como un casco con flequillo:
    // va peinado hacia atrás desde la coronilla, frente libre y algo de volumen)
    pelo: { color: "#3E2B1F", puntas: "#5A4030", volumen: { base: 0.0045, arriba: 0.015, frente: 0.006, lados: 0.001, atras: 0.006 }, copete: { alto: 0.006, avance: -0.005 }, ondas: 0.3, rizo: 0.15, remolino: "coronilla", linea: { recta: 0.2, entradas: 0.05, alto: 0.8 }, borde: 0.35, raya: null, liso: 0.7 },
    barba: { color: "#3A2A1E", densidad: 0.3 },
    cejas: { color: "#2E2018", grosor: 1.2, arco: 0.15 },
  },

  // Kobe Bryant (#24): el más alto, escolta atlético de brazos largos, cabeza
  // rapada con la línea recta, barba de candado corta. Camiseta de los Lakers.
  kobe: {
    estatura: 1.98,
    edad: 34,
    ap: { piel: "#7A4E34", barba: { estilo: "candado", color: "#141414" } },
    vestuario: { cuelloV: true },
    cuerpo: { anchoHombros: 0.48, anchoCintura: 0.31, brazos: 1.065, piernas: 1.02, cuello: { grosor: 1.1, largo: 0.85 }, manos: 1.12, musculo: { brazos: 1.45, antebrazos: 1.35, deltoides: 1.4, pecho: 1.15, piernas: 1.15, pantorrillas: 1.2 } },
    cara: {
      ancho: 0.97, largo: 1.06, pomulos: 1.25, mandibula: 1.08, anguloMandibula: 0.7, menton: 1.1, mentonAvance: 0.15, mejillas: 0,
      ojos: { tam: 0.95, abierto: 0.9 },
      nariz: { ancho: 1.25, puente: 0.3, punta: 1.15 },
      labios: { superior: 1.25, inferior: 1.3, ancho: 1.05 },
      orejas: { despegadas: 0.55 },
    },
    piel: { base: "#7A4E34" },
    iris: "#2A1A12",
    esclera: "#E8E0D6",
    pelo: { rapado: 0.85, color: "#141414", linea: { recta: 1, entradas: 0 } },
    barba: { color: "#231A14", densidad: 0.9, largo: 0.003, bigote: 0.9, perilla: 1, mandibula: 0.1, mejillas: 0, cuello: 0, borde: 0.2, anchoPerilla: 0.9 },
    cejas: { color: "#141414", grosor: 1.0, arco: 0.3 },
  },

  // Sócrates: bajo y robusto, cara ancha de Sileno (nariz chata y respingada,
  // ojos saltones), calvo con corona de rizos blancos, barba blanca en pala;
  // descalzo, con el manto de lana sin teñir.
  socrates: {
    estatura: 1.66,
    edad: 68,
    ap: { piel: "#CDA27C", ropa: { color: "#C4B08C", color2: "#9C8A68" } },
    vestuario: { manga: 0.1, mangaAncha: 0.01, ribete: null, manto: { color: "#B8A47E", ancho: 0.42, lado: 1, borde: "#9C8A68", bajo: 0.5 }, cinturon: null, descalzo: true },
    cuerpo: { anchoHombros: 0.45, pecho: 1.1, profundidad: 1.12, cintura: 1.2, panza: 0.05, panzaAlta: 0.5, cuello: { grosor: 1.2, largo: 0.75 }, piernas: 0.95, encorvado: 0.2, musculo: { brazos: 1.3, piernas: 1.1 } },
    cara: {
      ancho: 1.14, largo: 0.96, frente: 1.3, mejillas: 0.6, pomulos: 1.1, papada: 0.2,
      ojos: { tam: 1.12, sep: 1.12, hundidos: -0.45, abierto: 1.05 },
      nariz: { chata: 0.8, respingada: 0.75, ancho: 1.35, punta: 1.3, puente: 0, largo: 0.9 },
      labios: { superior: 1.2, inferior: 1.35, ancho: 1.05 },
    },
    piel: { base: "#CDA27C", rubor: ["#C08A68", 0.3] },
    iris: "#4a3828",
    // Rizo < 0,6: material de hebras (con la textura de bucles la barba blanca
    // parecía pochoclo azulado).
    pelo: { color: "#CFC7BA", volumen: { lados: 0.02, atras: 0.017 }, rizo: 0.5, linea: { calvo: 0.82 } },
    barba: { color: "#D2C9BA", canas: 0.3, densidad: 1, largo: 0.024, rizo: 0.45, liso: 0.6, bigote: 1, perilla: 1, mandibula: 1, mejillas: 0.85, cuello: 0.6, colgante: 0.06, anchoColgante: 0.12, borde: 0.8 },
    cejas: { color: "#D8D2C6", grosor: 1.3, pobladas: 0.5 },
  },

  // Cleopatra VII: estatura media-baja, cara ovalada con mentón definido, nariz
  // recta de puente marcado, ojos grandes con kohl; peluca negra con flequillo.
  cleopatra: {
    estatura: 1.6,
    edad: 32,
    fem: true,
    ap: { piel: "#B3835A" },
    cuerpo: { anchoHombros: 0.36, cintura: 0.92, cadera: 1.0, cuello: { grosor: 0.8, largo: 0.88 }, musculo: { brazos: 0.95 } },
    cara: {
      ancho: 0.88, largo: 0.96, menton: 0.92, mentonAvance: 0.15, pomulos: 1.25, mejillas: -0.15, mandibula: 0.8, anguloMandibula: 0.3, papada: 0,
      ojos: { tam: 1.2, abierto: 1.05, incl: 0.12, parpado: 0.15 },
      nariz: { largo: 1.0, puente: 0.75, gancho: 0.2, ancho: 0.85, proy: 1.05 },
      labios: { superior: 1.3, inferior: 1.35, ancho: 0.95 },
    },
    piel: { base: "#B3835A", labios: "#9A5244", delineado: 1, sombraOjos: ["#2F6B4F", 0.6] },
    iris: "#2E1E14",
    pelo: { color: "#121212", puntas: "#2a2a2e", largo: 0.13, linea: { flequillo: 1, cubreOrejas: 1 }, borde: 0.1, raya: null, volumen: { base: 0.009, arriba: 0.006, lados: 0.008 } },
    cejas: { color: "#141414", grosor: 0.9, arco: 0.55 },
  },

  // Leonardo da Vinci: 65 años, frente alta, nariz aguileña, cejas pobladas;
  // pelo y barba blancos, largos y ondulados que enmarcan la cara. Túnica rosa vieja.
  leonardo: {
    estatura: 1.73,
    edad: 65,
    ap: { piel: "#D9AD8A", ropa: { color: "#A84A55", color2: "#3A2A20" }, sombrero: null },
    cuerpo: { anchoHombros: 0.4, encorvado: 0.3, musculo: { brazos: 0.9 } },
    cara: {
      ancho: 0.96, largo: 1.08, frente: 1.4, pomulos: 1.15, mejillas: -0.4, arcoCejas: 1.2,
      ojos: { hundidos: 0.45, parpado: 0.7, abierto: 0.85 },
      nariz: { largo: 1.18, gancho: 0.7, puente: 0.95, proy: 1.15 },
      labios: { comisuras: -0.4 },
    },
    piel: { base: "#D9AD8A", manchas: 0.3 },
    iris: "#5a5040",
    pelo: { color: "#DCD2C2", puntas: "#E6DED0", bajo: "#B8AE9E", largo: 0.22, ondas: 0.7, adelante: 0.7, raya: 0, linea: { entradas: 0.8, alto: 1.2, cubreOrejas: 1 }, volumen: { base: 0.005, arriba: 0.004 }, remolino: "raya", borde: 0.45 },
    barba: { color: "#E2D8C8", canas: 0.2, densidad: 0.95, largo: 0.016, bigote: 1, perilla: 1, mandibula: 1, mejillas: 0.75, cuello: 0.7, colgante: 0.26, anchoColgante: 0.11, partida: 0.15, bigoteCaido: 0.03, rizo: 0.6, borde: 0.7 },
    cejas: { color: "#CFCAC0", grosor: 1.4, pobladas: 0.7, densidad: 1 },
  },

  // Abraham Lincoln: muy alto y flaco, piernas largas, cara larga y huesuda,
  // barba de mentón sin bigote, orejas grandes; levita negra y chistera.
  lincoln: {
    estatura: 1.93,
    edad: 55,
    ap: { piel: "#D0A884", ropa: { color: "#16171B", color2: "#F2F0EA", corbata: "#0E0E10" } },
    vestuario: { chaleco: "#141418" },
    cuerpo: { hombros: 0.92, cintura: 0.88, piernas: 1.05, brazos: 1.05, manos: 1.15, pies: 1.1, encorvado: 0.5, musculo: { brazos: 0.88, piernas: 0.9 } },
    cara: {
      ancho: 0.94, largo: 1.12, tercioInferior: 1.12, pomulos: 1.35, mejillas: -0.85, mandibula: 1.05, anguloMandibula: 0.8, arcoCejas: 1.25,
      ojos: { hundidos: 0.6, parpado: 0.7, abierto: 0.85 },
      nariz: { largo: 1.18, gancho: 0.3, proy: 1.12 },
      labios: { inferior: 1.2 },
      orejas: { tam: 1.18, despegadas: 0.7 },
    },
    piel: { base: "#D0A884" },
    iris: "#4a4a48",
    pelo: { color: "#2A2119", canas: 0.12, volumen: { base: 0.008, arriba: 0.012, lados: 0.01 }, raya: 0.6, rizo: 0.25, linea: { cubreOrejas: 0.5 }, remolino: "raya" },
    barba: { color: "#2A2119", densidad: 0.95, largo: 0.014, bigote: 0, perilla: 1, mandibula: 1, mejillas: 0.12, cuello: 0.35, borde: 0.3 },
    cejas: { grosor: 1.35, densidad: 1, arco: 0.2 },
  },

  // Steve Jobs: alto y delgado, cara larga de pómulos marcados, pelo muy corto
  // y canoso con entradas, barba de pocos días; cuello alto negro, jeans y
  // gafas redondas sin aro.
  jobs: {
    estatura: 1.88,
    edad: 52,
    ap: { piel: "#D8A988", ropa: { color: "#101010", color2: "#5A6676" } },
    vestuario: { gafasSinAro: true },
    cuerpo: { anchoHombros: 0.4, anchoCintura: 0.28, piernas: 1.03, brazos: 1.03, encorvado: 0.25, cuello: { grosor: 0.88 }, musculo: { brazos: 0.82, piernas: 0.85 } },
    cara: {
      ancho: 0.92, largo: 1.08, frente: 1.2, pomulos: 1.25, mejillas: -0.55, mandibula: 0.92, menton: 0.9, anguloMandibula: 0.45,
      ojos: { tam: 0.95, abierto: 0.9, hundidos: 0.2, parpado: 0.4 },
      nariz: { largo: 1.12, punta: 1.12, puente: 0.6 },
      labios: { ancho: 1.08, superior: 0.65, inferior: 0.8, comisuras: 0.15 },
    },
    piel: { base: "#D8A988", rubor: ["#D09478", 0.25] },
    iris: "#3A2A20",
    pelo: { color: "#7A6D60", canas: 0.12, canasSienes: 0.3, volumen: { base: 0.0012, arriba: 0.002, frente: 0.001, lados: 0, atras: 0 }, linea: { entradas: 0.95, alto: 1.5, coronilla: 0.45, flequillo: 0, nuca: -1 }, raya: null, remolino: "coronilla", borde: 1, liso: 1 },
    barba: { color: "#7A7672", densidad: 0.42 },
    cejas: { color: "#3E3A36", grosor: 0.95, arco: 0.2 },
  },

  // Claude (androide, avatar-androide.ts): calvo, piel sintética gris azulada
  // con grietas finas; cara serena con media sonrisa; ojos gris azulado;
  // delgado, 1,80 m. Sudadera óxido y jeans.
  claude: {
    estatura: 1.8,
    edad: 32,
    vestuario: { mezclilla: true },
    cuerpo: { anchoHombros: 0.42, musculo: { brazos: 0.9, deltoides: 0.9 } },
    // Sudadera óxido (#5A2E22 es como se ve en la referencia): como albedo, más
    // claro y menos saturado; en la escena, a la sombra, salía negra.
    ap: { ropa: { color: "#946348" } },
    cara: { ancho: 0.95, mejillas: -0.1, mandibula: 0.95, anguloMandibula: 0.3, pomulos: 1.15, labios: { comisuras: 0.3 }, ojos: { tam: 1.0 }, nariz: { puente: 0.5 } },
    piel: { base: "#6F7F95", rubor: ["#6F7F95", 0], labios: "#7886A0" },
    iris: "#7F93A6",
    esclera: "#E2E5E9",
    pelo: { color: "#6F7F95", rapado: 0.001 },
    barba: { densidad: 0 },
    cejas: { densidad: 0 },
  },

  // ChatGPT (androide, avatar-androide.ts): calvo, panel en la coronilla y
  // costuras en las sienes y el cuello; cejas de luz blanca; ojos ámbar; cara
  // neutra, algo seria; delgado, 1,80 m. Sudadera verde oliva.
  chatgpt: {
    estatura: 1.8,
    edad: 30,
    vestuario: { mezclilla: false },
    cuerpo: { anchoHombros: 0.43, anchoCintura: 0.27 },
    // Sudadera oliva (#4B5A3C como se ve): como albedo, más clara y con menos
    // verde; con el rebote del césped, la de la referencia salía verde esmeralda.
    ap: { ropa: { color: "#838761" } },
    cara: { mandibula: 1.05, anguloMandibula: 0.7, mentonCuadrado: 0.5, pomulos: 1.15, labios: { comisuras: -0.05, filtrum: -1 }, nariz: { puente: 0.6 } },
    // (labios del tono de la piel y filtrum corto: con la luz de arriba, el labio oscuro se leía como un bigote)
    piel: { base: "#6F7F95", rubor: ["#6F7F95", 0], labios: "#7886A0" },
    iris: "#A9824E",
    esclera: "#E2E5E9",
    pelo: { color: "#6F7F95", rapado: 0.001 },
    barba: { densidad: 0 },
    cejas: { densidad: 0 },
  },
}

/** El personaje con su Apariencia corregida por la ficha (para armar el avatar). */
export function conFicha(p: Personaje): Personaje {
  const a = FICHAS[p.id]?.ap
  if (!a) return p
  const ap = p.apariencia
  const barba = a.barba === null ? undefined : a.barba ?? ap.barba
  return {
    ...p,
    apariencia: {
      ...ap,
      piel: a.piel ?? ap.piel,
      complexion: a.complexion ?? ap.complexion,
      pelo: { ...ap.pelo, ...a.pelo },
      barba,
      sombrero: a.sombrero !== undefined ? a.sombrero : ap.sombrero,
      ropa: { ...ap.ropa, ...a.ropa },
      accesorios: a.accesorios ?? ap.accesorios,
    },
  }
}

/** Detalles de vestuario de la ficha (vacío si no hay). */
export function vestuarioDe(id: string): FichaVestuario {
  return FICHAS[id]?.vestuario ?? {}
}

// ── Lo que usa el generador (todo resuelto en números) ─────────

export interface CuerpoR {
  hombros: number
  pecho: number
  prof: number
  cintura: number
  cadera: number
  panza: number
  panzaAlta: number
  mBrazos: number
  mAntebrazos: number
  mPecho: number
  mEspalda: number
  mDeltoides: number
  trapecio: number
  mPiernas: number
  mPantorrillas: number
  cuelloGrosor: number
  cuelloLargo: number
  piernas: number
  brazos: number
  muslo: number
  manos: number
  pies: number
  cabeza: number
  encorvado: number
}

export interface PeloR {
  color: string
  puntas: string
  bajo: string
  canas: number
  canasSienes: number
  alto: number
  entradas: number
  coronilla: number
  calvo: number
  recta: number
  patillas: number
  nuca: number
  cubreOrejas: number
  flequillo: number
  vBase: number
  vArriba: number
  vFrente: number
  vLados: number
  vAtras: number
  copeteAlto: number
  copeteAvance: number
  raya: number | null
  rizo: number
  frecRizo: number
  ondas: number
  borde: number
  largo: number
  adelante: number
  rapado: number
  remolino: "coronilla" | "frente" | "raya"
  mono: { alto: number; radio: number } | null
  liso: number
}

export interface BarbaR {
  color: string
  canas: number
  densidad: number
  largo: number
  bigote: number
  perilla: number
  mandibula: number
  mejillas: number
  cuello: number
  anchoPerilla: number
  colgante: number
  anchoColgante: number
  partida: number
  bigoteCaido: number
  rizo: number
  borde: number
  liso?: number
}

export interface CejasR {
  color: string
  grosor: number
  largo: number
  arco: number
  densidad: number
  pobladas: number
  inclinacion: number
  alto: number
}

export interface PielR {
  base: string
  cuerpo: string | null
  ojos: [string, number] | null
  rubor: [string, number] | null
  labios: string | null
  manchas: number
  brillo: number
  delineado: number
  sombraOjos: [string, number] | null
}

export interface FichaR {
  estatura: number
  edadAnios: number
  /** 0 = 20 años, 1 = 85 años. */
  edad: number
  fem: boolean
  cuerpo: CuerpoR
  cara: Required<Omit<FichaCara, "ojos" | "nariz" | "labios" | "orejas">> & {
    ojos: Required<NonNullable<FichaCara["ojos"]>>
    nariz: Required<NonNullable<FichaCara["nariz"]>>
    labios: Required<NonNullable<FichaCara["labios"]>>
    orejas: Required<NonNullable<FichaCara["orejas"]>>
  }
  piel: PielR
  iris: string
  esclera: string
  pelo: PeloR
  /** null = afeitado. Una barba de densidad < 0,35 solo tiñe la piel. */
  barba: BarbaR | null
  cejas: CejasR
  /** Hay ficha escrita para este id. */
  conFicha: boolean
}

// ── Presets de los estilos de la Apariencia ───────────────────

type PeloP = Partial<PeloR>
const PELO_ESTILO: Record<Apariencia["pelo"]["estilo"], PeloP> = {
  corto: { vBase: 0.004, vArriba: 0.008, vAtras: 0.002, borde: 0.55 },
  peinado_lado: { vBase: 0.006, vArriba: 0.012, vFrente: 0.003, raya: 0.6, remolino: "raya", borde: 0.5 },
  peinado_atras: { vBase: 0.006, vArriba: 0.01, vFrente: 0.006, vAtras: 0.003, remolino: "frente", borde: 0.5 },
  rubio_tupe: { vBase: 0.008, vArriba: 0.014, vLados: 0.002, copeteAlto: 0.03, copeteAvance: 0.02, borde: 0.25, nuca: 0.6, remolino: "coronilla" },
  largo: { vBase: 0.005, vArriba: 0.004, largo: 0.17, raya: 0, ondas: 0.5, remolino: "raya", cubreOrejas: 1, borde: 0.45, adelante: 0.5 },
  rizado: { vBase: 0.012, vArriba: 0.008, vAtras: 0.003, rizo: 0.5, borde: 0.3 },
  rizado_voluminoso: { vBase: 0.02, vArriba: 0.02, vLados: 0.012, vAtras: 0.01, rizo: 0.9, borde: 0.2, cubreOrejas: 0.6 },
  melena_bob: { vBase: 0.008, vArriba: 0.006, flequillo: 1, largo: 0.07, cubreOrejas: 1, borde: 0.2, raya: null },
  rapado: { rapado: 0.85 },
  calvo: { calvo: 1 },
}

type BarbaP = Partial<BarbaR>
const BARBA_ESTILO: Record<NonNullable<Apariencia["barba"]>["estilo"], BarbaP> = {
  completa: { densidad: 0.95, largo: 0.009, bigote: 1, perilla: 1, mandibula: 1, mejillas: 0.75, cuello: 0.6, borde: 0.5, rizo: 0.4 },
  corta: { densidad: 0.9, largo: 0.0045, bigote: 1, perilla: 1, mandibula: 1, mejillas: 0.7, cuello: 0.5, borde: 0.3 },
  candado: { densidad: 0.95, largo: 0.0075, bigote: 1, perilla: 1, mandibula: 0, mejillas: 0, cuello: 0, borde: 0.2, anchoPerilla: 1 },
  menton: { densidad: 0.95, largo: 0.009, bigote: 0, perilla: 1, mandibula: 1, mejillas: 0.15, cuello: 0.35, borde: 0.25 },
  larga: { densidad: 0.95, largo: 0.012, bigote: 1, perilla: 1, mandibula: 1, mejillas: 0.8, cuello: 0.7, colgante: 0.14, anchoColgante: 0.075, borde: 0.6, rizo: 0.5 },
  barba_de_dias: { densidad: 0.3, largo: 0.0015, bigote: 1, perilla: 1, mandibula: 1, mejillas: 0.7, cuello: 0.5, borde: 0.6 },
}

const hsl = (hex: string) => {
  const o = { h: 0, s: 0, l: 0 }
  new THREE.Color(hex).getHSL(o)
  return o
}

/** Un tono más claro/oscuro del mismo color. */
export function tono(hex: string, dl: number, ds = 0): string {
  const c = new THREE.Color(hex)
  const o = { h: 0, s: 0, l: 0 }
  c.getHSL(o)
  c.setHSL(o.h, clamp(o.s + ds, 0, 1), clamp(o.l + dl, 0, 1))
  return `#${c.getHexString()}`
}

/** Junta la Apariencia (lo de siempre) y la ficha (lo que la corrige) en números. */
export function resolverFicha(p: Personaje): FichaR {
  const ap = p.apariencia
  const f: Ficha = FICHAS[p.id] ?? {}
  const r = azar(hashTexto(p.id) ^ 0x5bd1e995)
  const v = (a: number) => 1 + (r() * 2 - 1) * a
  const fem = f.fem ?? ap.ropa.tipo === "vestido_egipcio"
  // Canas: pelo o barba gris claro = mayor.
  const g1 = hsl(ap.pelo.color)
  const g2 = ap.barba ? hsl(ap.barba.color) : g1
  const canasAp = Math.max(g1.s < 0.12 && g1.l > 0.5 ? (g1.l - 0.45) * 2.2 : 0, g2.s < 0.12 && g2.l > 0.45 ? (g2.l - 0.4) * 2 : 0)
  const edadAzar = clamp(0.25 + r() * 0.25 + canasAp * 0.6, 0, 1)
  const edad = f.edad !== undefined ? clamp((f.edad - 20) / 65, 0, 1) : edadAzar
  const edadAnios = f.edad ?? Math.round(20 + edad * 65)
  const grasa = { delgado: 0.1, medio: 0.3, fuerte: 0.65, atletico: 0.15 }[ap.complexion] ?? 0.3
  const fuerte = ap.complexion === "fuerte" || ap.complexion === "atletico"

  // ── Cuerpo ──
  const COMP: Record<string, Partial<CuerpoR>> = {
    delgado: { hombros: 0.95, pecho: 0.93, prof: 0.9, cintura: 0.9, cadera: 0.95, mBrazos: 0.88, mPiernas: 0.88, panza: 0 },
    medio: { panza: 0.006 },
    fuerte: { hombros: 1.08, pecho: 1.09, prof: 1.12, cintura: 1.14, cadera: 1.06, mBrazos: 1.12, mPiernas: 1.12, panza: 0.026 },
    atletico: { hombros: 1.1, pecho: 1.07, prof: 1.06, cintura: 0.95, cadera: 0.98, mBrazos: 1.16, mPiernas: 1.16, panza: 0 },
  }
  const base: CuerpoR = {
    hombros: 1, pecho: 1, prof: 1, cintura: 1, cadera: 1, panza: 0.006, panzaAlta: 0.2,
    mBrazos: 1, mAntebrazos: 1, mPecho: 1, mEspalda: 1, mDeltoides: 1, trapecio: 0, mPiernas: 1, mPantorrillas: 1,
    cuelloGrosor: v(0.05) * (fem ? 0.82 : fuerte ? 1.12 : 1) * (1 + grasa * 0.06), cuelloLargo: 1,
    piernas: 1, brazos: 1, muslo: 1, manos: 1, pies: 1, cabeza: 1, encorvado: 0,
    ...COMP[ap.complexion],
  }
  if (base.mAntebrazos === 1) base.mAntebrazos = base.mBrazos
  if (base.mPantorrillas === 1) base.mPantorrillas = base.mPiernas
  const fc = f.cuerpo ?? {}
  const H = clamp(f.estatura ?? ap.altura ?? 1.78, 1.5, 2.05)
  const s = H / 1.78
  const mu = fc.musculo ?? {}
  const cuerpo: CuerpoR = {
    ...base,
    hombros: fc.anchoHombros ? fc.anchoHombros / (0.44 * s) : fc.hombros ?? base.hombros,
    pecho: fc.pecho ?? base.pecho,
    prof: fc.profundidad ?? base.prof,
    cintura: fc.anchoCintura ? fc.anchoCintura / (0.296 * s) : fc.cintura ?? base.cintura,
    cadera: fc.anchoCadera ? fc.anchoCadera / (0.344 * s) : fc.cadera ?? base.cadera,
    panza: fc.panza ?? base.panza,
    panzaAlta: fc.panzaAlta ?? base.panzaAlta,
    mBrazos: mu.brazos ?? base.mBrazos,
    mAntebrazos: mu.antebrazos ?? mu.brazos ?? base.mAntebrazos,
    mPecho: mu.pecho ?? base.mPecho,
    mEspalda: mu.espalda ?? base.mEspalda,
    mDeltoides: mu.deltoides ?? base.mDeltoides,
    trapecio: mu.trapecio ?? base.trapecio,
    mPiernas: mu.piernas ?? base.mPiernas,
    mPantorrillas: mu.pantorrillas ?? mu.piernas ?? base.mPantorrillas,
    cuelloGrosor: fc.cuello?.grosor ?? base.cuelloGrosor,
    cuelloLargo: fc.cuello?.largo ?? base.cuelloLargo,
    piernas: fc.piernas ?? 1,
    brazos: fc.brazos ?? 1,
    muslo: fc.muslo ?? 1,
    manos: fc.manos ?? 1,
    pies: fc.pies ?? 1,
    cabeza: fc.cabeza ?? 1,
    encorvado: fc.encorvado ?? 0,
  }

  // ── Cara ──
  const c = f.cara ?? {}
  const co = c.ojos ?? {}
  const cn = c.nariz ?? {}
  const cl = c.labios ?? {}
  const cor = c.orejas ?? {}
  const cara: FichaR["cara"] = {
    ancho: c.ancho ?? v(0.04) * (fem ? 0.95 : 1) * (1 + grasa * 0.04),
    largo: c.largo ?? v(0.04) * (fem ? 0.96 : 1),
    frente: c.frente ?? 0,
    mandibula: c.mandibula ?? v(0.07) * (fem ? 0.86 : fuerte ? 1.07 : 1) * (1 + grasa * 0.05),
    anguloMandibula: c.anguloMandibula ?? (fem ? 0.15 : fuerte ? 0.55 : 0.35),
    menton: c.menton ?? v(0.15) * (fem ? 0.85 : 1),
    mentonAvance: c.mentonAvance ?? 0,
    mentonPartido: c.mentonPartido ?? 0,
    mentonCuadrado: c.mentonCuadrado ?? (fem ? 0 : 0.2),
    pomulos: c.pomulos ?? v(0.15) * (fem ? 1.1 : 1),
    mejillas: c.mejillas ?? Math.max(0, (grasa - 0.3) * 0.8),
    papada: c.papada ?? clamp((grasa - 0.4) * 0.6 + edad * 0.15, 0, 1),
    arcoCejas: c.arcoCejas ?? v(0.15) * (fem ? 0.6 : 1),
    tercioInferior: clamp(c.tercioInferior ?? 1, 0.85, 1.15),
    ojos: {
      tam: co.tam ?? v(0.05) * (fem ? 1.08 : 1.03),
      sep: co.sep ?? v(0.03),
      incl: co.incl ?? (r() - 0.4) * 0.12 + (fem ? 0.06 : 0),
      abierto: co.abierto ?? v(0.1) * (1 - edad * 0.12),
      parpado: co.parpado ?? clamp(edad * 0.5, 0, 1),
      hundidos: co.hundidos ?? 0,
      monoparpado: co.monoparpado ?? false,
      bolsas: co.bolsas ?? clamp(edad * 0.6 - 0.1, 0, 1),
      alto: clamp(co.alto ?? 0, -6, 6),
    },
    nariz: {
      largo: cn.largo ?? v(0.08) * (fem ? 0.93 : 1) * (1 + edad * 0.05),
      ancho: cn.ancho ?? v(0.1) * (fem ? 0.88 : 1),
      puente: cn.puente ?? r() * (fem ? 0.2 : 0.8),
      punta: cn.punta ?? v(0.12),
      proy: cn.proy ?? v(0.1),
      gancho: cn.gancho ?? 0,
      respingada: cn.respingada ?? 0,
      chata: cn.chata ?? 0,
    },
    labios: {
      ancho: cl.ancho ?? v(0.06),
      superior: cl.superior ?? v(0.15) * (fem ? 1.25 : 1) * (1 - edad * 0.2),
      inferior: cl.inferior ?? v(0.15) * (fem ? 1.25 : 1),
      avanceInferior: cl.avanceInferior ?? 0,
      comisuras: cl.comisuras ?? 0,
      filtrum: clamp(cl.filtrum ?? 0, -5, 5),
    },
    orejas: { tam: cor.tam ?? v(0.08) * (1 + edad * 0.08), despegadas: cor.despegadas ?? 0.2, lobulo: cor.lobulo ?? 1 + edad * 0.2 },
  }

  // ── Acento ──
  // Con los valores tal cual, las 24 caras salían del mismo molde (en pantalla
  // una cara 6 % más ancha no se nota). Se acentúa la diferencia con la media
  // —sin pasar a caricatura: cada medida tiene tope— y la nariz de todos crece
  // un poco (se leía chica a la distancia de juego).
  const ac = (x: number, k: number, lo: number, hi: number) => clamp(1 + (x - 1) * k, lo, hi)
  cara.ancho = ac(cara.ancho, 1.6, 0.84, 1.2)
  cara.largo = ac(cara.largo, 1.6, 0.86, 1.2)
  cara.mandibula = ac(cara.mandibula, 1.6, 0.75, 1.35)
  cara.menton = ac(cara.menton, 1.5, 0.7, 1.4)
  cara.pomulos = ac(cara.pomulos, 1.4, 0.75, 1.45)
  cara.mejillas = clamp(cara.mejillas * 1.25, -1, 1)
  cara.papada = clamp(cara.papada * 1.2, 0, 1)
  cara.ojos.tam = ac(cara.ojos.tam, 1.4, 0.8, 1.25)
  cara.nariz.largo = ac(cara.nariz.largo, 1.6, 0.8, 1.35) * 1.06
  cara.nariz.ancho = ac(cara.nariz.ancho, 1.5, 0.8, 1.35)
  cara.nariz.punta = ac(cara.nariz.punta, 1.4, 0.8, 1.35) * 1.05
  cara.nariz.proy = ac(cara.nariz.proy, 1.6, 0.75, 1.35) * 1.08
  cara.labios.superior = ac(cara.labios.superior, 1.4, 0.45, 1.5)
  cara.labios.inferior = ac(cara.labios.inferior, 1.4, 0.55, 1.6)

  // ── Piel y ojos ──
  const fp = f.piel ?? {}
  const piel: PielR = {
    base: fp.base ?? ap.piel,
    cuerpo: fp.cuerpo ?? null,
    ojos: fp.ojos ?? null,
    rubor: fp.rubor ?? null,
    labios: fp.labios ?? null,
    manchas: fp.manchas ?? clamp((edad - 0.6) * 1.5, 0, 0.6),
    brillo: fp.brillo ?? 0,
    delineado: fp.delineado ?? 0,
    sombraOjos: fp.sombraOjos ?? null,
  }
  const claro = g1.l > 0.42 && g1.s > 0.15 && !canasAp
  const irisClaros = ["#5f86a8", "#6b8f7a", "#7d6a45", "#4f7795"]
  const irisOscuros = ["#4a2f1d", "#3b2618", "#5a3b22", "#2f1f15"]
  const iris = f.iris ?? (claro ? irisClaros : irisOscuros)[Math.floor(r() * 4)]

  // ── Pelo ──
  const fpe = f.pelo ?? {}
  const preset = PELO_ESTILO[ap.pelo.estilo] ?? PELO_ESTILO.corto
  const barbaLargaAp = ap.barba?.estilo === "larga" || ap.barba?.estilo === "completa"
  const colorPelo = fpe.color ?? ap.pelo.color
  const pl = fpe.linea ?? {}
  const vol = fpe.volumen ?? {}
  const cp = fpe.copete ?? {}
  const calvoAp = ap.pelo.estilo === "calvo"
  const pelo: PeloR = {
    color: colorPelo,
    puntas: fpe.puntas ?? tono(colorPelo, 0.05),
    bajo: fpe.bajo ?? tono(colorPelo, -0.05),
    canas: fpe.canas ?? clamp(canasAp * 0.5, 0, 1) * 0,
    canasSienes: fpe.canasSienes ?? 0,
    alto: pl.alto ?? (preset.alto ?? 0) + edad * 0.6,
    entradas: pl.entradas ?? clamp(0.2 + edad * 0.7, 0, 1) * (fem ? 0.2 : 1),
    coronilla: pl.coronilla ?? 0,
    calvo: pl.calvo ?? (calvoAp ? (barbaLargaAp ? 1 : 1) : 0),
    recta: pl.recta ?? 0,
    patillas: pl.patillas ?? 0,
    nuca: pl.nuca ?? preset.nuca ?? 0,
    cubreOrejas: pl.cubreOrejas ?? preset.cubreOrejas ?? 0,
    flequillo: pl.flequillo ?? preset.flequillo ?? 0,
    vBase: vol.base ?? preset.vBase ?? 0.004,
    vArriba: vol.arriba ?? preset.vArriba ?? 0.008,
    vFrente: vol.frente ?? preset.vFrente ?? 0,
    vLados: vol.lados ?? preset.vLados ?? 0,
    vAtras: vol.atras ?? preset.vAtras ?? 0,
    copeteAlto: cp.alto ?? preset.copeteAlto ?? 0,
    copeteAvance: cp.avance ?? preset.copeteAvance ?? 0,
    raya: fpe.raya !== undefined ? fpe.raya : preset.raya !== undefined ? preset.raya : null,
    rizo: fpe.rizo ?? preset.rizo ?? 0,
    frecRizo: fpe.frecRizo ?? 1,
    ondas: fpe.ondas ?? preset.ondas ?? 0,
    borde: fpe.borde ?? preset.borde ?? 0.5,
    largo: fpe.largo ?? preset.largo ?? 0,
    adelante: fpe.adelante ?? preset.adelante ?? 0,
    rapado: fpe.rapado ?? preset.rapado ?? 0,
    remolino: fpe.remolino ?? preset.remolino ?? "coronilla",
    mono: fpe.mono ?? null,
    liso: clamp(fpe.liso ?? 0, 0, 1),
  }
  // Calvo sin barba de sabio: nada de pelo (solo una sombra muy leve en los lados).
  if (calvoAp && !barbaLargaAp && pl.calvo === undefined) {
    pelo.rapado = fpe.rapado ?? 0.12
  }

  // ── Barba ──
  let barba: BarbaR | null = null
  const fb = f.barba
  if (fb !== null && (fb || ap.barba)) {
    const pb = ap.barba ? BARBA_ESTILO[ap.barba.estilo] : BARBA_ESTILO.corta
    const colorB = fb?.color ?? ap.barba?.color ?? colorPelo
    const b = fb ?? {}
    barba = {
      color: colorB,
      canas: b.canas ?? 0,
      densidad: b.densidad ?? pb.densidad ?? 0.9,
      largo: b.largo ?? pb.largo ?? 0.006,
      bigote: b.bigote ?? pb.bigote ?? 1,
      perilla: b.perilla ?? pb.perilla ?? 1,
      mandibula: b.mandibula ?? pb.mandibula ?? 1,
      mejillas: b.mejillas ?? pb.mejillas ?? 0.7,
      cuello: b.cuello ?? pb.cuello ?? 0.5,
      anchoPerilla: b.anchoPerilla ?? pb.anchoPerilla ?? 1,
      colgante: b.colgante ?? pb.colgante ?? 0,
      anchoColgante: b.anchoColgante ?? pb.anchoColgante ?? 0.07,
      partida: b.partida ?? 0,
      bigoteCaido: b.bigoteCaido ?? 0,
      rizo: b.rizo ?? pb.rizo ?? 0.2,
      borde: b.borde ?? pb.borde ?? 0.4,
      liso: clamp(b.liso ?? 0, 0, 1),
    }
  }

  // ── Cejas ──
  const fce = f.cejas ?? {}
  const baseCejas = calvoAp || ap.pelo.estilo === "rapado" ? ap.barba?.color ?? "#3a2a20" : colorPelo
  const hc = hsl(baseCejas)
  const cejaAuto = new THREE.Color(baseCejas)
  cejaAuto.setHSL(hc.h, hc.s, hc.l > 0.5 ? hc.l * 0.72 : Math.min(0.5, hc.l * 1.05 + 0.03))
  const cejas: CejasR = {
    color: fce.color ?? `#${cejaAuto.getHexString()}`,
    grosor: fce.grosor ?? (fem ? 0.75 : 1) * v(0.1),
    largo: fce.largo ?? 1,
    arco: fce.arco ?? (fem ? 0.7 : 0.4),
    densidad: fce.densidad ?? 0.9,
    pobladas: fce.pobladas ?? clamp((edad - 0.7) * 2, 0, 0.6),
    inclinacion: fce.inclinacion ?? 0,
    alto: fce.alto ?? (fem ? 0.2 : 0),
  }

  return {
    estatura: H,
    edadAnios,
    edad,
    fem,
    cuerpo,
    cara,
    piel,
    iris,
    esclera: f.esclera ?? "#ece6de",
    pelo,
    barba,
    cejas,
    conFicha: !!FICHAS[p.id],
  }
}
