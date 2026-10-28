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

export interface Ficha {
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
export const FICHAS: Record<string, Ficha> = {}

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
    mejillas: c.mejillas ?? (grasa - 0.3) * 0.8,
    papada: c.papada ?? clamp((grasa - 0.4) * 0.6 + edad * 0.15, 0, 1),
    arcoCejas: c.arcoCejas ?? v(0.15) * (fem ? 0.6 : 1),
    ojos: {
      tam: co.tam ?? v(0.05) * (fem ? 1.08 : 1.03),
      sep: co.sep ?? v(0.03),
      incl: co.incl ?? (r() - 0.4) * 0.12 + (fem ? 0.06 : 0),
      abierto: co.abierto ?? v(0.1) * (1 - edad * 0.12),
      parpado: co.parpado ?? clamp(edad * 0.5, 0, 1),
      hundidos: co.hundidos ?? 0,
      monoparpado: co.monoparpado ?? false,
      bolsas: co.bolsas ?? clamp(edad * 0.6 - 0.1, 0, 1),
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
    },
    orejas: { tam: cor.tam ?? v(0.08) * (1 + edad * 0.08), despegadas: cor.despegadas ?? 0.2, lobulo: cor.lobulo ?? 1 + edad * 0.2 },
  }

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
